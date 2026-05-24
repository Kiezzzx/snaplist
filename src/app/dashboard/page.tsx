import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import Link from 'next/link';
import { AlertTriangle, Check, ImageIcon } from 'lucide-react';
import { db } from '@/lib/db';
import { listings } from '@/lib/db/schema';
import { getAnonSessionId } from '@/lib/session';
import { DashboardDeleteButton } from '@/components/dashboard/delete-button';

// Pill drives the user-visible row lifecycle. Stale-pending rows never reach
// here — they short-circuit to a dedicated "Processing Failed" row (CLAUDE.md
// constraint #8) so a stuck upload can't masquerade as a normal 'Draft'.
const statusPillClasses: Record<string, string> = {
  Generated: 'border-green-600/30 bg-green-50 text-green-700',
  Draft: 'border-gray-300 bg-gray-50 text-gray-500',
  Sold: 'border-blue-600/30 bg-blue-50 text-blue-700',
};

// Defensive runtime parse on read — Drizzle's $type<> is compile-time only,
// so historical rows or AI-drift JSON could crash rendering without this.
// CLAUDE.md constraint #3.
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

type PlatformKey = 'Rednote' | 'Facebook' | 'eBay';
const platformIndicators: Array<{ key: PlatformKey; label: string }> = [
  { key: 'Rednote', label: 'RED' },
  { key: 'Facebook', label: 'FB' },
  { key: 'eBay', label: 'EBAY' },
];

const dateFmt = new Intl.DateTimeFormat('en-AU', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default async function DashboardPage() {
  // Scope to the caller's anon session so each browser only ever sees its own
  // listings. No cookie yet (first ever request, pre-middleware) → nothing to
  // show. Phase 0 widens this to also match the logged-in user's userId.
  const sessionId = await getAnonSessionId();
  const rows = sessionId
    ? await db
        .select({
          id: listings.id,
          metadata: listings.metadata,
          generatedCopies: listings.generatedCopies,
          imageStatus: listings.imageStatus,
          status: listings.status,
          thumbnailKey: listings.thumbnailKey,
          // TEMP: replace with R2 in Phase 4 — read from thumbnailKey instead.
          thumbnailBase64: listings.thumbnailBase64,
          createdAt: listings.createdAt,
          // CLAUDE.md constraint #8: compute staleness against the DB clock
          // (not Date.now() in render — that's an impure call during render and
          // would drift against the app server's clock). A row still 'pending'
          // 2 minutes after its last write is a dead upload.
          isStalePending: sql<boolean>`${listings.imageStatus} = 'pending' AND ${listings.updatedAt} < now() - interval '2 minutes'`,
        })
        .from(listings)
        .where(eq(listings.anonymousSessionId, sessionId))
        .orderBy(desc(listings.createdAt))
    : [];

  return (
    <div className="bg-grid relative min-h-screen w-full overflow-x-hidden pb-16">
      {/* Site chrome — mirrors the home page header for brand consistency */}
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
              Dashboard
            </span>
          </div>
          <Link
            href="/"
            className="-mr-2 inline-flex min-h-11 items-center px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 transition-colors hover:text-[#E8421A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8421A]"
          >
            + New Listing
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
        <header className="mb-8 flex items-end justify-between md:mb-12">
          <h1 className="text-2xl font-bold tracking-tight">Your listings</h1>
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">
            {rows.length} {rows.length === 1 ? 'item' : 'items'}
          </p>
        </header>

      {rows.length === 0 ? (
        // min-h-[60vh] + justify-center makes the empty state hold the page's
        // visual weight on first-load — without it, a single dashed box hugs
        // the top of the viewport and the page reads as broken/empty.
        <div className="flex min-h-[60vh] flex-col items-center justify-center border border-dashed border-[#D0CFC9] px-6 py-16 text-center">
          <ImageIcon className="mb-8 h-16 w-16 text-gray-300" aria-hidden />
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gray-400">
            No listings yet
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-500">
            Your generated listings will appear here.
            <br />
            Each upload creates a draft you can revisit.
          </p>
          <Link
            href="/"
            className="mt-10 inline-flex min-h-11 items-center border-2 border-black bg-black px-6 font-mono text-xs uppercase tracking-widest text-white transition-colors hover:border-[#E8421A] hover:bg-[#E8421A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8421A]"
          >
            Upload First Photo →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-[#D0CFC9] border-t border-b border-[#D0CFC9]">
          {rows.map((row) => {
            const parsedMetadata = row.metadata
              ? metadataSchema.safeParse(row.metadata)
              : null;
            const metadata = parsedMetadata?.success ? parsedMetadata.data : null;
            const brand = metadata?.brand ?? null;
            const model = metadata?.model ?? null;
            const category = metadata?.category ?? null;
            const condition = metadata?.condition ?? null;
            const price = metadata?.suggestedPrice ?? null;

            const parsedCopies = row.generatedCopies
              ? generatedCopiesSchema.safeParse(row.generatedCopies)
              : null;
            const copies = parsedCopies?.success ? parsedCopies.data : null;

            const isStalePending = row.isStalePending;

            const stateLabel =
              row.status === 'generated'
                ? 'Generated'
                : row.status === 'sold'
                  ? 'Sold'
                  : 'Draft';

            const pillClass = statusPillClasses[stateLabel] ?? statusPillClasses.Draft;

            // TEMP: replace with R2 in Phase 4 — swap the inline base64 for an
            // <img> sourced from the R2 CDN URL. Shared by the normal and the
            // stale-pending rows below.
            const thumbnail = row.thumbnailBase64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.thumbnailBase64}
                alt=""
                className="h-12 w-12 shrink-0 object-cover bg-[#FAFAFA]"
              />
            ) : (
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center bg-[#FAFAFA] text-gray-200"
                aria-label="No image uploaded"
              >
                <ImageIcon className="h-5 w-5" aria-hidden />
              </div>
            );

            // CLAUDE.md constraint #8: a row stuck 'pending' past the 2-minute
            // window is a dead upload. Render an explicit "Processing Failed"
            // state with a retry affordance — never a link to an empty detail
            // page, and never an infinite spinner. The row is intentionally not
            // a <Link>: there's nothing useful to navigate to.
            if (isStalePending) {
              return (
                <li key={row.id}>
                  <div className="flex items-start gap-4 py-4">
                    {thumbnail}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle
                          className="h-4 w-4 shrink-0 text-[#E8421A]"
                          aria-hidden
                        />
                        <p className="text-sm font-medium text-[#E8421A]">
                          Processing Failed
                        </p>
                      </div>
                      <p className="text-xs leading-relaxed text-gray-500">
                        This upload didn’t finish processing. Retry to upload the
                        photo again.
                      </p>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-gray-400">
                        {dateFmt.format(row.createdAt)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {/* Phase 4: once R2 stores the original image, swap this
                          re-upload link for a retryExtraction(id) action that
                          re-runs extraction against the stored image in place. */}
                      <Link
                        href="/"
                        aria-label="Retry: upload this photo again"
                        className="inline-flex min-h-11 items-center px-3 font-mono text-[10px] uppercase tracking-widest text-gray-600 transition-colors hover:text-[#E8421A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8421A]"
                      >
                        Retry
                      </Link>
                      <DashboardDeleteButton id={row.id} />
                    </div>
                  </div>
                </li>
              );
            }

            return (
              <li key={row.id}>
                <Link
                  href={`/dashboard/${row.id}`}
                  // The whole row is the click target. Inner delete button calls
                  // preventDefault + stopPropagation in its handler so Delete
                  // doesn't navigate. Outline is inset so the focus ring stays
                  // within the row's divider lines instead of straddling them.
                  className="flex items-start gap-4 py-4 cursor-pointer transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#E8421A]"
                >
                  {thumbnail}

                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Row 1: brand+model + price */}
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="truncate text-sm font-medium">
                        {brand ?? '—'}{model ? ` · ${model}` : ''}
                      </p>
                      <p className="font-mono text-sm font-bold tabular-nums shrink-0">
                        {price ? `A$${price}` : '—'}
                      </p>
                    </div>

                    {/* Row 2: category + condition badges, date, status pill */}
                    <div className="flex flex-wrap items-center gap-2">
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
                      <span className="font-mono text-[10px] uppercase tracking-widest text-gray-400">
                        {dateFmt.format(row.createdAt)}
                      </span>
                      <span
                        className={`ml-auto inline-flex items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${pillClass}`}
                      >
                        {stateLabel}
                      </span>
                    </div>

                    {/* Row 3: platform indicators */}
                    <div className="flex items-center gap-4 font-mono text-[9px] tracking-widest text-gray-400">
                      {platformIndicators.map(({ key, label }) => {
                        const has = (copies?.[key]?.content ?? '').length > 0;
                        return (
                          <span key={key} className="inline-flex items-center gap-1">
                            <span>{label}</span>
                            {has ? (
                              <Check
                                className="h-2.5 w-2.5 text-green-600"
                                aria-label={`${key} generated`}
                              />
                            ) : (
                              <span
                                className="inline-block h-1 w-1 rounded-full bg-gray-300"
                                aria-label={`${key} not generated`}
                              />
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="shrink-0">
                    <DashboardDeleteButton id={row.id} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      </main>
    </div>
  );
}
