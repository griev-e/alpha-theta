import type { FundamentalsPatch } from "@/lib/live/types";
import { fetchFinnhubPatch } from "./finnhub";
import { fetchYahooPatch } from "./yahoo";

/**
 * Fundamentals orchestrator. Two providers, layered by precedence:
 *
 *   1. **Yahoo** (keyless, primary) — the fast-moving, broadly-covered fields,
 *      with realized volatility and ROIC / FCF growth derived from its statement
 *      modules.
 *   2. **Finnhub** (optional, `FINNHUB_API_KEY`) — **gap-fill only**: fills the
 *      fields Yahoo left empty (common for newly-listed tickers with no
 *      statement history — margins, ROIC, growth, beta). Never overrides Yahoo.
 *
 * Either provider may be null (unknown symbol, outage, no key); the result is
 * null only when both come back empty, which the caller treats as "no live
 * data" and degrades accordingly.
 */
export async function fetchFundamentalsPatch(
  symbol: string
): Promise<FundamentalsPatch | null> {
  const [yahoo, finnhub] = await Promise.all([
    fetchYahooPatch(symbol),
    fetchFinnhubPatch(symbol),
  ]);

  if (!yahoo && !finnhub) return null;

  // Base identity: Yahoo if present, else a Finnhub-seeded stub.
  const base: FundamentalsPatch =
    yahoo ?? { symbol, asOf: new Date().toISOString() };

  if (!finnhub) return base;

  // Layer Finnhub under Yahoo: Yahoo's value wins; Finnhub fills only the gaps.
  const merged = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(finnhub)) {
    if (v !== undefined && merged[k] === undefined) merged[k] = v;
  }
  return merged as unknown as FundamentalsPatch;
}
