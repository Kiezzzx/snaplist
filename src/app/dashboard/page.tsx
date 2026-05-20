import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import Link from 'next/link';
import { ImageIcon } from 'lucide-react';
import { db } from '@/lib/db';
import { listings } from '@/lib/db/schema';
import { DashboardDeleteButton } from '@/components/dashboard/delete-button';

// Status pill colors map to the imageStatus state machine. Stale 'pending'
// is surfaced as 'Processing Failed' upstream — keyed off the same red bucket.
const statusPillClasses: Record<string, string> = {
  processed: 'border-green-600/30 bg-green-50 text-green-700',
  uploaded: 'border-blue-600/30 bg-blue-50 text-blue-700',
  pending: 'border-gray-300 bg-gray-50 text-gray-500',
  failed: 'border-[#E8421A]/40 bg-[#E8421A]/10 text-[#E8421A]',
  'Processing Failed': 'border-[#E8421A]/40 bg-[#E8421A]/10 text-[#E8421A]',
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

const STALE_PENDING_MS = 2 * 60 * 1000;

const dateFmt = new Intl.DateTimeFormat('en-AU', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default async function DashboardPage() {
  const rows = await db
    .select({
      id: listings.id,
      metadata: listings.metadata,
      imageStatus: listings.imageStatus,
      status: listings.status,
      thumbnailKey: listings.thumbnailKey,
      createdAt: listings.createdAt,
      updatedAt: listings.updatedAt,
    })
    .from(listings)
    .where(eq(listings.anonymousSessionId, 'test-session'))
    .orderBy(desc(listings.createdAt));

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
        <div className="flex flex-col items-center border border-dashed border-[#D0CFC9] px-6 py-24 text-center">
          <ImageIcon className="mb-6 h-10 w-10 text-gray-300" aria-hidden />
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gray-400">
            No listings yet
          </p>
          <p className="mt-3 max-w-xs text-sm text-gray-500">
            Upload a photo to generate platform-ready listing copy.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex min-h-11 items-center border-2 border-black bg-black px-6 font-mono text-xs uppercase tracking-widest text-white transition-colors hover:border-[#E8421A] hover:bg-[#E8421A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8421A]"
          >
            Upload First Photo →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-[#D0CFC9] border-t border-b border-[#D0CFC9]">
          {rows.map((row) => {
            const parsed = row.metadata ? metadataSchema.safeParse(row.metadata) : null;
            const brand = parsed?.success ? parsed.data.brand : null;
            const model = parsed?.success ? parsed.data.model : null;
            const price = parsed?.success ? parsed.data.suggestedPrice : null;

            const isStalePending =
              row.imageStatus === 'pending' &&
              Date.now() - row.updatedAt.getTime() > STALE_PENDING_MS;

            const stateLabel = isStalePending
              ? 'Processing Failed'
              : (row.imageStatus ?? 'pending');

            const pillClass = statusPillClasses[stateLabel] ?? statusPillClasses.pending;

            return (
              <li key={row.id} className="flex items-center gap-6 py-4">
                <div
                  className={`flex h-20 w-20 shrink-0 items-center justify-center bg-[#FAFAFA] ${
                    row.thumbnailKey ? 'text-gray-400' : 'text-gray-200'
                  }`}
                  aria-label={row.thumbnailKey ? 'Listing thumbnail placeholder' : 'No image uploaded'}
                >
                  <ImageIcon className="h-7 w-7" aria-hidden />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="truncate text-base font-bold">
                    {brand ?? '—'}{model ? ` · ${model}` : ''}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-gray-400">
                    {dateFmt.format(row.createdAt)}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <p className="font-mono text-sm font-bold tabular-nums">
                    {price ? `A$${price}` : '—'}
                  </p>
                  <span
                    className={`inline-flex items-center border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${pillClass}`}
                  >
                    {stateLabel}
                  </span>
                </div>

                <div className="shrink-0">
                  <DashboardDeleteButton id={row.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      </main>
    </div>
  );
}
