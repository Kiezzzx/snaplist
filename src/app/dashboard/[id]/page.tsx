import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ImageIcon } from 'lucide-react';
import { db } from '@/lib/db';
import { listings } from '@/lib/db/schema';
import { getAnonSessionId } from '@/lib/session';
import { ListingPlatformTabs } from '@/components/dashboard/listing-platform-tabs';

// CLAUDE.md constraint #3 — Drizzle's $type<> is compile-time only, so JSONB
// columns must be re-parsed at the read boundary. A historical row with
// drifted shape would otherwise crash the page instead of degrading gracefully.
const metadataSchema = z.object({
  brand: z.string().optional(),
  model: z.string().optional(),
  condition: z.string().optional(),
  category: z.string().optional(),
  suggestedPrice: z.number().optional(),
  notes: z.string().optional(),
});

const copySchema = z.object({ content: z.string() }).optional();
const generatedCopiesSchema = z.object({
  Rednote: copySchema,
  Facebook: copySchema,
  eBay: copySchema,
});

const dateFmt = new Intl.DateTimeFormat('en-AU', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const sessionId = await getAnonSessionId();
  // No session cookie → this caller can't own anything. notFound() (not 403)
  // so the response can't be used as an existence oracle for foreign ids.
  if (!sessionId) {
    notFound();
  }

  const [row] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);

  if (!row) {
    notFound();
  }

  // Ownership check: same 404 (not 403) on mismatch, for the same reason.
  if (row.anonymousSessionId !== sessionId) {
    notFound();
  }

  const parsedMetadata = row.metadata ? metadataSchema.safeParse(row.metadata) : null;
  const metadata = parsedMetadata?.success ? parsedMetadata.data : null;

  const parsedCopies = row.generatedCopies
    ? generatedCopiesSchema.safeParse(row.generatedCopies)
    : null;
  const copies = parsedCopies?.success ? parsedCopies.data : null;

  const brand = metadata?.brand ?? null;
  const model = metadata?.model ?? null;
  const category = metadata?.category ?? null;
  const condition = metadata?.condition ?? null;
  const price = metadata?.suggestedPrice ?? null;
  const notes = metadata?.notes ?? null;

  return (
    <div className="bg-grid relative min-h-screen w-full overflow-x-hidden pb-16">
      <header className="border-b border-[#D0CFC9] px-4 py-4 md:px-8 md:py-5">
        <div className="flex items-end justify-between">
          <div className="flex items-baseline gap-4">
            <Link
              href="/"
              className="text-3xl font-black uppercase tracking-tight transition-colors hover:text-[#E8421A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8421A] md:text-4xl"
            >
              SNAP.
            </Link>
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.2em] text-gray-500 md:block">
              Listing Detail
            </span>
          </div>
          <Link
            href="/dashboard"
            className="-mr-2 inline-flex min-h-11 items-center px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 transition-colors hover:text-[#E8421A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8421A]"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-16 lg:grid-cols-[45fr_55fr]">
          {/* Left column — Item info */}
          <div className="min-w-0 space-y-8">
            <div className="flex items-center justify-between border-b border-[#D0CFC9] pb-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-gray-600">
                Item
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-500">
                {dateFmt.format(row.createdAt)}
              </span>
            </div>

            {/* TEMP: replace with R2 in Phase 4 — swap the inline base64
                for an <img> sourced from the R2 CDN URL (full-size original,
                not the 100x100 thumb). */}
            {row.thumbnailBase64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.thumbnailBase64}
                alt=""
                className="h-56 w-full object-contain bg-[#FAFAFA]"
              />
            ) : (
              <div
                className="flex h-56 w-full items-center justify-center bg-[#FAFAFA] text-gray-200"
                aria-label="No image uploaded"
              >
                <ImageIcon className="h-16 w-16" aria-hidden />
              </div>
            )}

            <div className="space-y-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-400">
                Brand · Model
              </p>
              <h2 className="text-2xl font-black uppercase tracking-tight md:text-3xl">
                {brand ?? '—'}
                {model ? <span className="text-gray-400"> · </span> : null}
                {model ?? ''}
              </h2>
            </div>

            {(category || condition) && (
              <div className="flex flex-wrap gap-2">
                {category && (
                  <span className="inline-flex items-center border border-[#D0CFC9] px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-gray-600">
                    {category}
                  </span>
                )}
                {condition && (
                  <span className="inline-flex items-center border border-[#D0CFC9] px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-gray-600">
                    {condition}
                  </span>
                )}
              </div>
            )}

            <div className="border-t border-[#D0CFC9] pt-6">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-400">
                Price
              </p>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums">
                {price ? `A$${price}` : '—'}
              </p>
            </div>

            {notes && (
              <div className="border-t border-[#D0CFC9] pt-6">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-400">
                  Notes
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {notes}
                </p>
              </div>
            )}
          </div>

          {/* Right column — Generated content tabs */}
          <div className="min-w-0">
            <ListingPlatformTabs copies={copies} />
          </div>
        </div>
      </main>
    </div>
  );
}
