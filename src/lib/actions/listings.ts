'use server';

import { z } from 'zod';
import { sql, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { listings } from '@/lib/db/schema';
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

export async function createListing(metadata: CreateListingInput): Promise<string> {
  const parsed = metadataSchema.parse(metadata);

  const [row] = await db
    .insert(listings)
    .values({
      anonymousSessionId: 'test-session',
      metadata: parsed,
    })
    .returning({ id: listings.id });

  return row.id;
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
      status: 'generated',
      updatedAt: new Date(),
    })
    .where(eq(listings.id, dbId));
}

export async function deleteListing(id: string): Promise<void> {
  // CLAUDE.md constraint #2 (Two-Phase Deletion): R2 object cleanup MUST run
  // BEFORE the DB delete once R2 upload lands (Phase 4). Order matters —
  // if DB deletes first, an R2 failure leaves zombie objects with no row
  // to find them by, accumulating storage cost.
  // TODO(phase-4): delete originalImageKey + thumbnailKey from R2 here.

  await db.delete(listings).where(eq(listings.id, id));

  revalidatePath('/dashboard');
}
