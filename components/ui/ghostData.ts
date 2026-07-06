import type { MonteCarloResult } from "@/lib/analytics/montecarlo";

/**
 * Tiny synthetic datasets for the page-specific empty-state previews (§104).
 * Just enough shape to render the *real* chart component faintly behind an
 * empty panel — so the page previews the kind of thing that will live there —
 * never touched by any real analytics. Deterministic and hand-shaped; the
 * MonteCarloResult is cast because the fan only reads bands + samplePaths.
 */

/** A gently widening fan that drifts up — the silhouette of a Monte Carlo run. */
export const GHOST_FAN: { result: MonteCarloResult; target: number } = (() => {
  const n = 24;
  const bands = Array.from({ length: n + 1 }, (_, m) => {
    const t = m / n;
    const mid = 100 + 62 * t;
    const spread = 6 + 34 * t;
    return {
      month: m,
      p5: mid - spread,
      p25: mid - spread * 0.45,
      p50: mid,
      p75: mid + spread * 0.5,
      p95: mid + spread,
    };
  });
  const samplePaths = [0.15, 0.45, 0.7, 1.05].map((k) =>
    bands.map((b) => b.p50 + (k - 0.6) * (b.p95 - b.p5) * 0.55)
  );
  return { result: { bands, samplePaths } as MonteCarloResult, target: 176 };
})();

/** A small correlation block — a few tickers, symmetric, unit diagonal. */
export const GHOST_MATRIX: { symbols: string[]; matrix: number[][] } = {
  symbols: ["AA", "BB", "CC", "DD", "EE"],
  matrix: [
    [1, 0.62, 0.31, 0.18, 0.44],
    [0.62, 1, 0.28, 0.22, 0.51],
    [0.31, 0.28, 1, 0.66, 0.24],
    [0.18, 0.22, 0.66, 1, 0.2],
    [0.44, 0.51, 0.24, 0.2, 1],
  ],
};
