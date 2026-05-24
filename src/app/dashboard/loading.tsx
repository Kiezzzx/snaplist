import Link from 'next/link';

// Skeleton mirrors the real dashboard chrome + 3-row card so the swap to the
// loaded page doesn't shift layout. motion-safe:animate-pulse honors
// prefers-reduced-motion automatically — the animation is skipped entirely
// for users who request reduced motion.
export default function Loading() {
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
          <div
            className="h-3 w-16 bg-gray-200 motion-safe:animate-pulse"
            aria-hidden
          />
        </header>

        {/* role="status" lives on the wrapper, not the <ul>, so the
            sr-only label can sit alongside the list without violating
            HTML's "ul only contains li" rule. */}
        <div role="status" aria-busy="true" aria-label="Loading listings">
          <span className="sr-only">Loading your listings…</span>
          <ul className="divide-y divide-[#D0CFC9] border-t border-b border-[#D0CFC9]">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i}>
              <div className="flex items-start gap-4 py-4">
                {/* Thumbnail placeholder (48px to match real card) */}
                <div
                  className="h-12 w-12 shrink-0 bg-gray-200 motion-safe:animate-pulse"
                  aria-hidden
                />

                <div className="flex-1 min-w-0 space-y-2">
                  {/* Row 1: brand + price */}
                  <div className="flex items-baseline justify-between gap-4">
                    <div
                      className="h-4 w-40 bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                    <div
                      className="h-4 w-16 bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                  </div>

                  {/* Row 2: category + condition + date + status pill */}
                  <div className="flex items-center gap-2">
                    <div
                      className="h-4 w-16 bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                    <div
                      className="h-4 w-12 bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                    <div
                      className="h-3 w-24 bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                    <div
                      className="ml-auto h-4 w-20 bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                  </div>

                  {/* Row 3: platform indicators */}
                  <div className="flex items-center gap-4">
                    <div
                      className="h-2.5 w-10 bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                    <div
                      className="h-2.5 w-10 bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                    <div
                      className="h-2.5 w-10 bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                  </div>
                </div>

                {/* Delete button slot */}
                <div
                  className="h-11 w-16 shrink-0 bg-gray-200 motion-safe:animate-pulse"
                  aria-hidden
                />
              </div>
            </li>
          ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
