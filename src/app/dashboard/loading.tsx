export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-8 py-16">
      <header className="mb-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gray-400">
          Dashboard
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Your listings</h1>
      </header>

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 border border-[#D0CFC9] bg-[#FAFAFA]/40 p-4"
          >
            <div className="h-20 w-20 bg-gray-200 motion-safe:animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 bg-gray-200 motion-safe:animate-pulse" />
              <div className="h-3 w-20 bg-gray-200 motion-safe:animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
