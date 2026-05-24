'use server';

import { z } from 'zod';
import { sql, eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { listings, type ListingMetadata } from '@/lib/db/schema';
import { getAnonSessionId } from '@/lib/session';
import type { Platform } from '@/lib/types';

// Mirrors ListingMetadata $type for runtime parse — CLAUDE.md hard constraint #3
// requires Zod at the boundary because Drizzle's $type is compile-time only.
const metadataSchema = z.object({
  brand: z.string().optional(),
  model: z.string().optional(),
  condition: z.string().optional(),
  category: z.string().optional(),
  suggestedPrice: z.number().optional(),
  notes: z.string().optional(),
});

export type CreateListingInput = z.infer<typeof metadataSchema>;

// TEMP: replace with R2 in Phase 4. Optional thumbnail bag — kept as a
// second positional arg so the R2 cutover only deletes this param + the
// column write, leaving the metadata signature untouched.
export interface CreateListingOptions {
  thumbnailBase64?: string;
}

export async function createListing(
  metadata: CreateListingInput,
  options: CreateListingOptions = {},
): Promise<string> {
  const parsed = metadataSchema.parse(metadata);

  // Owner key for the row. Middleware issues this cookie on the upload request,
  // so a missing value here means the request bypassed middleware — fail loudly
  // rather than orphan a row no dashboard query can ever scope to.
  const anonymousSessionId = await getAnonSessionId();
  if (!anonymousSessionId) {
    throw new Error('Cannot create listing: no anonymous session');
  }

  const [row] = await db
    .insert(listings)
    .values({
      anonymousSessionId,
      metadata: parsed,
      // TEMP: replace with R2 in Phase 4. Once R2 is wired, drop this and
      // populate thumbnailKey from the upload result instead.
      thumbnailBase64: options.thumbnailBase64,
      // Extract succeeded by the time we reach createListing, so the image
      // is no longer 'pending'. Stale-pending detection on the dashboard
      // would otherwise mark every fresh row as "Processing Failed".
      imageStatus: 'uploaded',
    })
    .returning({ id: listings.id });

  // Without this, /dashboard's Full Route Cache serves stale HTML and new
  // uploads silently fail to appear in history. See deleteListing for the
  // same invariant on the delete path.
  revalidatePath('/dashboard');

  return row.id;
}

// Mirrors ProductMetadata (the form's shape) for the boundary parse. The form
// carries price as a string and a separate AI `suggestedPrice` reference; the
// DB stores a single numeric price in `suggestedPrice`.
const formMetadataSchema = z.object({
  category: z.string(),
  brand: z.string(),
  model: z.string(),
  condition: z.string(),
  price: z.string(),
  suggestedPrice: z.string().optional(),
  notes: z.string().optional(),
});

export type UpdateListingMetadataInput = z.infer<typeof formMetadataSchema>;

// Persists the user's reviewed/edited metadata onto the row at generate time.
// Until this runs, listings.metadata holds only the AI's extraction-time values
// (written by createListing), so any field the user corrected — condition,
// price, brand… — never reaches the dashboard or detail page. CLAUDE.md Stage 2
// "Review & Smart Merge": what the user generates with is what we save.
export async function updateListingMetadata(
  id: string,
  metadata: UpdateListingMetadataInput,
): Promise<void> {
  const sessionId = await getAnonSessionId();
  if (!sessionId) return;

  const parsed = formMetadataSchema.parse(metadata);

  // The user's asking price (form.price) is what the dashboard renders as
  // "Price"; fall back to the AI estimate only when they left it blank. Blank /
  // non-numeric → omit so the JSONB stays clean rather than storing NaN.
  const askingPrice = Number(parsed.price);
  const aiEstimate = Number(parsed.suggestedPrice);
  const price =
    Number.isFinite(askingPrice) && askingPrice > 0
      ? askingPrice
      : Number.isFinite(aiEstimate) && aiEstimate > 0
        ? aiEstimate
        : undefined;

  // Empty optional text → undefined so the dashboard's `?? '—'` fallbacks fire
  // instead of rendering blank cells.
  const dbMetadata: ListingMetadata = {
    category: parsed.category || undefined,
    brand: parsed.brand || undefined,
    model: parsed.model || undefined,
    condition: parsed.condition || undefined,
    notes: parsed.notes || undefined,
    ...(price !== undefined ? { suggestedPrice: price } : {}),
  };

  // Scope to the caller's session so one visitor can't rewrite another's row.
  // Only the metadata column is touched — generatedCopies and status are owned
  // by the generate path, so this never races their writes.
  await db
    .update(listings)
    .set({ metadata: dbMetadata, updatedAt: new Date() })
    .where(and(eq(listings.id, id), eq(listings.anonymousSessionId, sessionId)));

  revalidatePath('/dashboard');
}

// Atomic JSONB merge for 3 parallel platform writes against the same row.
// COALESCE handles the first writer (column was NULL). The `||` operator
// runs inside the UPDATE's row-level lock, so concurrent writes each merge
// against the locked value — no read-modify-write race window where one
// platform's content overwrites another's.
export async function persistGeneratedCopy(
  dbId: string,
  platform: Platform,
  content: string,
): Promise<void> {
  const fragment = JSON.stringify({ [platform]: { content } });

  await db
    .update(listings)
    .set({
      generatedCopies: sql`COALESCE(${listings.generatedCopies}, '{}'::jsonb) || ${fragment}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(listings.id, dbId));

  // The lifecycle transition to 'generated' is owned by markListingAsGenerated
  // (fired once all selected platforms succeed). Don't flip status per-platform
  // here — that would mark the row 'generated' after only one platform finished.
  revalidatePath('/dashboard');
}

// Final lifecycle transition fired by the client once every selected platform's
// stream reaches 'success'. Separates per-platform JSONB merging from the
// row-level state machine so a partial generation never claims completion.
export async function markListingAsGenerated(listingId: string): Promise<void> {
  await db
    .update(listings)
    .set({
      status: 'generated',
      imageStatus: 'processed',
      updatedAt: new Date(),
    })
    .where(eq(listings.id, listingId));

  revalidatePath('/dashboard');
}

export async function deleteListing(id: string): Promise<void> {
  const sessionId = await getAnonSessionId();
  if (!sessionId) return;

  // Scope the lookup to the caller's session so one visitor can't delete
  // another's listing by guessing its id. Fetch first to recover the R2 keys
  // the two-phase delete needs.
  const [row] = await db
    .select({
      originalImageKey: listings.originalImageKey,
      thumbnailKey: listings.thumbnailKey,
    })
    .from(listings)
    .where(and(eq(listings.id, id), eq(listings.anonymousSessionId, sessionId)))
    .limit(1);

  // Missing OR owned by another session → no-op. Same opacity as the detail
  // page's 404: we never distinguish "doesn't exist" from "not yours".
  if (!row) return;

  // CLAUDE.md constraint #2 (Two-Phase Deletion): R2 objects MUST be deleted
  // BEFORE the DB row. The order is load-bearing — if the row goes first and
  // the R2 delete then fails, the keys are gone and the objects become
  // unreachable zombies that bill forever. Do NOT rely on onDelete:'cascade'.
  // Phase 4 wires the actual S3 DeleteObjects call here, gated on the keys
  // existing, and only proceeds to the DB delete once R2 confirms:
  //   const keys = [row.originalImageKey, row.thumbnailKey].filter(Boolean);
  //   if (keys.length) await deleteR2Objects(keys);

  await db
    .delete(listings)
    .where(and(eq(listings.id, id), eq(listings.anonymousSessionId, sessionId)));

  revalidatePath('/dashboard');
}
