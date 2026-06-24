import type { FundamentalsPatch } from "@/lib/live/types";
import { fetchFmpPatch } from "./fmp";
import { fetchYahooPatch } from "./yahoo";

/**
 * Fundamentals orchestrator: Yahoo (keyless, primary) enriched with FMP where a
 * key is configured. Yahoo wins for the fast-moving / broadly-covered fields;
 * FMP overrides ROIC, FCF growth and the region mix — the fields it sources
 * cleanly and Yahoo either can't (region mix) or only derives (ROIC, FCF growth).
 *
 * Either provider may be null (unknown symbol, outage, no FMP key); the result
 * is null only when both come back empty, which the caller treats as
 * "no live data" and degrades accordingly.
 */
export async function fetchFundamentalsPatch(
  symbol: string
): Promise<FundamentalsPatch | null> {
  const [yahoo, fmp] = await Promise.all([
    fetchYahooPatch(symbol),
    fetchFmpPatch(symbol),
  ]);

  if (!yahoo && !fmp) return null;
  if (!fmp) return yahoo;

  const base: FundamentalsPatch =
    yahoo ?? { symbol, asOf: new Date().toISOString() };

  return {
    ...base,
    // FMP is authoritative for these three; fall back to Yahoo's value otherwise.
    roic: fmp.roic ?? base.roic,
    fcfGrowth: fmp.fcfGrowth ?? base.fcfGrowth,
    regions: fmp.regions ?? base.regions,
  };
}
