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

/** Just the page header ghost — shared by the shape variants below. */
function HeaderGhost() {
  return (
    <div className="mb-6">
      <SkeletonBlock className="h-3 w-20" />
      <SkeletonBlock className="mt-2 h-6 w-44" />
    </div>
  );
}

/**
 * A grid of equal chart cards, for analytics pages whose body is several
 * same-sized visualizations (Risk, Quality, Correlation, Benchmark).
 */
export function ChartGridSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div aria-hidden="true">
      <HeaderGhost />
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="panel px-5 py-5">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="mt-4 h-48 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A wide hero object beside a narrow controls rail, for the simulation pages
 * (Monte Carlo, Projection, Optimizer) whose chart owns the page with its
 * assumptions in a sidebar.
 */
export function SplitSkeleton() {
  return (
    <div aria-hidden="true">
      <HeaderGhost />
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="panel px-6 py-5">
          <SkeletonBlock className="h-4 w-72" />
          <SkeletonBlock className="mt-5 h-[340px] w-full" />
        </div>
        <div className="panel h-fit px-5 py-5">
          <SkeletonBlock className="h-3 w-24" />
          <div className="mt-5 space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <SkeletonBlock className="h-2.5 w-20" />
                <SkeletonBlock className="mt-2.5 h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A left search/list rail beside a main detail panel, for the Research terminal.
 */
export function TerminalSkeleton() {
  return (
    <div aria-hidden="true">
      <HeaderGhost />
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="panel px-4 py-4">
          <SkeletonBlock className="h-8 w-full rounded-lg" />
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5"
                style={{ opacity: Math.max(0.3, 1 - i * 0.09) }}
              >
                <SkeletonBlock className="h-6 w-6 shrink-0 rounded-full" />
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="ml-auto h-3 w-10" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <div className="panel px-6 py-5">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="mt-3 h-9 w-48" />
            <SkeletonBlock className="mt-5 h-52 w-full" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="panel px-5 py-5">
                <SkeletonBlock className="h-3 w-28" />
                <SkeletonBlock className="mt-4 h-28 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
