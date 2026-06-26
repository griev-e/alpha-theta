import { CMA as STATIC_CMA } from "@/lib/data/benchmarks";

/**
 * Live overlay for the capital-market assumptions analytics consume.
 * `primeLiveCMA()` fetches once per session; `getCMA()` returns the live
 * risk-free rate / market volatility when available, falling back to the
 * static snapshot in lib/data/benchmarks.ts otherwise. Equity risk premium
 * has no live source and always comes from the static assumption.
 */
let live: { riskFree: number; marketVolatility: number } | null = null;
let primed: Promise<void> | null = null;

export function getCMA() {
  return {
    riskFree: live?.riskFree ?? STATIC_CMA.riskFree,
    equityRiskPremium: STATIC_CMA.equityRiskPremium,
    marketVolatility: live?.marketVolatility ?? STATIC_CMA.marketVolatility,
  };
}

export function primeLiveCMA(): Promise<void> {
  if (primed) return primed;
  primed = (async () => {
    try {
      const res = await fetch("/api/cma");
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (
        typeof data.riskFree === "number" &&
        typeof data.marketVolatility === "number"
      ) {
        live = { riskFree: data.riskFree, marketVolatility: data.marketVolatility };
      }
    } catch {
      // snapshot fallback — getCMA() already covers this
    }
  })();
  return primed;
}
