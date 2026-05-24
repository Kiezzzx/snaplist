import Link from 'next/link';

// Mirrors the detail page's chrome + two-column grid so the swap to the loaded
// page doesn't shift layout. motion-safe:animate-pulse honors
// prefers-reduced-motion automatically.
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
        {/* role="status" on a wrapper (not the grid) so SR users hear one
            loading announcement instead of one per skeleton block. */}
        <div role="status" aria-busy="true" aria-label="Loading listing detail">
          <span className="sr-only">Loading listing detail…</span>

          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-16 lg:grid-cols-[45fr_55fr]">
            {/* Left column — item info skeleton */}
            <div className="min-w-0 space-y-8">
              <div className="flex items-center justify-between border-b border-[#D0CFC9] pb-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-gray-600">
                  Item
                </span>
                <div
                  className="h-3 w-32 bg-gray-200 motion-safe:animate-pulse"
                  aria-hidden
                />
              </div>

              {/* Thumbnail block (same h-56 footprint as the real page) */}
              <div
                className="h-56 w-full bg-gray-200 motion-safe:animate-pulse"
                aria-hidden
              />

              {/* Brand · Model section */}
              <div className="space-y-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-400">
                  Brand · Model
                </p>
                <div
                  className="h-8 w-3/4 bg-gray-200 motion-safe:animate-pulse md:h-9"
                  aria-hidden
                />
              </div>

              {/* Category + Condition badges */}
              <div className="flex flex-wrap gap-2">
                <div
                  className="h-5 w-24 bg-gray-200 motion-safe:animate-pulse"
                  aria-hidden
                />
                <div
                  className="h-5 w-20 bg-gray-200 motion-safe:animate-pulse"
                  aria-hidden
                />
              </div>

              {/* Price section */}
              <div className="border-t border-[#D0CFC9] pt-6">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-400">
                  Price
                </p>
                <div
                  className="mt-2 h-9 w-32 bg-gray-200 motion-safe:animate-pulse"
                  aria-hidden
                />
              </div>
            </div>

            {/* Right column — tabs + content skeleton */}
            <div className="min-w-0">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-[#D0CFC9] pb-2">
                  <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-gray-600">
                    Output
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-500">
                    Generated Copy
                  </span>
                </div>

                {/* Tabs skeleton — three placeholder buttons sitting on the
                    same border line the real tabs share. */}
                <div className="flex items-end gap-2 md:gap-6 border-b border-[#D0CFC9] -mx-4 px-4 md:mx-0 md:px-0">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="px-2 py-3 md:px-4">
                      <div
                        className="h-3 w-16 bg-gray-200 motion-safe:animate-pulse md:w-20"
                        aria-hidden
                      />
                    </div>
                  ))}
                </div>

                {/* Tab content skeleton */}
                <div className="border-t border-[#D0CFC9] pt-6">
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 bg-gray-200 motion-safe:animate-pulse"
                        aria-hidden
                      />
                      <div className="space-y-1.5">
                        <div
                          className="h-2.5 w-14 bg-gray-200 motion-safe:animate-pulse"
                          aria-hidden
                        />
                        <div
                          className="h-4 w-20 bg-gray-200 motion-safe:animate-pulse"
                          aria-hidden
                        />
                      </div>
                    </div>
                    {/* Copy button slot */}
                    <div
                      className="h-9 w-20 bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                  </div>

                  {/* Content lines — varied widths to read like real prose. */}
                  <div className="space-y-3">
                    <div
                      className="h-3 w-full bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                    <div
                      className="h-3 w-11/12 bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                    <div
                      className="h-3 w-10/12 bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                    <div
                      className="h-3 w-full bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                    <div
                      className="h-3 w-9/12 bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                    <div
                      className="h-3 w-11/12 bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                    <div
                      className="h-3 w-7/12 bg-gray-200 motion-safe:animate-pulse"
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
