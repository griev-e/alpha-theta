/**
 * First-paint placeholders shown while a store hydrates from localStorage or
 * the server (`!ready`). Ghost blocks match the real layout's proportions so
 * there's no shift when content swaps in, replacing the blank flash that used
 * to precede every page.
 */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/** A generic page ghost: header bar, a hero card, then a grid of card ghosts. */
export function PageSkeleton({
  cards = 3,
  columns = "grid-cols-1 lg:grid-cols-3",
}: {
  /** Number of card ghosts below the hero. */
  cards?: number;
  /** Grid column classes for the card row. */
  columns?: string;
}) {
  return (
    <div aria-hidden="true">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="mt-2 h-6 w-40" />
        </div>
      </div>
      <div className="panel mb-5 px-6 py-6">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="mt-3 h-9 w-56" />
        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <SkeletonBlock className="h-2.5 w-14" />
              <SkeletonBlock className="mt-2 h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className={`grid gap-5 ${columns}`}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="panel px-5 py-5">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="mt-4 h-36 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A table-first page ghost: header + a card of ghost rows, for pages whose
 * primary content is a long list (the Overview holdings table, theta's
 * Transactions log) rather than a card grid. Rows fade toward the bottom so the
 * placeholder recedes like a real scroll list instead of reading as a solid slab.
 */
export function TableSkeleton({
  rows = 8,
  cols = 3,
}: {
  /** Number of ghost body rows. */
  rows?: number;
  /** Trailing numeric columns per row. */
  cols?: number;
}) {
  return (
    <div aria-hidden="true">
      <div className="mb-6">
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="mt-2 h-6 w-40" />
      </div>
      <div className="panel px-5 py-4">
        <div className="flex items-center gap-4 border-b border-edge pb-3">
          <SkeletonBlock className="h-3 w-28" />
          <div className="ml-auto flex gap-8">
            {Array.from({ length: cols }).map((_, i) => (
              <SkeletonBlock key={i} className="h-3 w-12" />
            ))}
          </div>
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="flex items-center gap-4 py-3.5"
            style={{ opacity: Math.max(0.25, 1 - r * 0.08) }}
          >
            <SkeletonBlock className="h-8 w-8 shrink-0 rounded-full" />
            <div className="min-w-0">
              <SkeletonBlock className="h-3.5 w-24" />
              <SkeletonBlock className="mt-1.5 h-2.5 w-16" />
            </div>
            <div className="ml-auto flex items-center gap-8">
              {Array.from({ length: cols }).map((_, i) => (
                <SkeletonBlock key={i} className="h-3.5 w-12" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
