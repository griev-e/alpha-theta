"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HistorySeries } from "@/lib/research/types";
import { setReturnSeries } from "./returns";

/**
 * Fetches ~1y of daily price history per symbol from `/api/history`, and primes
 * the module-scope returns singleton the covariance estimator reads
 * (`lib/live/returns.ts` → `lib/analytics/shrinkage.ts`). Mirrors the
 * `getCMA()` / `getAssumptions()` bridge: the pure analytics stay synchronous
 * and read a primed singleton, degrading to the structural factor covariance
 * whenever no history is loaded (first paint, tests, provider outage).
 *
 * Returns a version counter that increments once a batch of history resolves,
 * so the store can fold it into the portfolio memo and let the risk /
 * correlation / optimizer pages recompute against the newly-loaded sample
 * covariance. Each symbol is fetched at most once per session (daily bars, 10min
 * CDN-cached upstream); a failed fetch is marked attempted so it never loops.
 */
export function useReturnHistory(symbols: string[]): number {
  const key = useMemo(() => [...symbols].sort().join(","), [symbols]);
  const attempted = useRef<Set<string>>(new Set());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!key) return;
    const missing = key.split(",").filter((s) => s && !attempted.current.has(s));
    if (missing.length === 0) return;

    let alive = true;
    void (async () => {
      const series = await Promise.all(
        missing.map(async (symbol) => {
          try {
            const res = await fetch(
              `/api/history?symbol=${encodeURIComponent(symbol)}&range=1y`
            );
            if (!res.ok) return null;
            return (await res.json()) as HistorySeries;
          } catch {
            return null;
          }
        })
      );
      if (!alive) return;

      let primed = false;
      missing.forEach((symbol, i) => {
        attempted.current.add(symbol); // mark attempted even on failure — no retry loop
        const points = series[i]?.points;
        if (points && points.length > 1) {
          // Key by the requested symbol, not the echoed one, so lookups by
          // portfolio symbol in getReturns line up regardless of provider casing.
          setReturnSeries(symbol, points);
          primed = true;
        }
      });
      if (primed) setVersion((v) => v + 1);
    })();

    return () => {
      alive = false;
    };
  }, [key]);

  return version;
}
