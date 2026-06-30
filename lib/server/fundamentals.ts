import type { FundamentalsPatch } from "@/lib/live/types";
import { fetchFinnhubPatch } from "./finnhub";
import { fetchYahooPatch } from "./yahoo";

/**
 * A regression/sample-stats computation over a handful of days of price
 * history (typical for a newly-listed, thinly-traded security) can blow up to
 * an absurd value that no real security has — e.g. β -31, or a four-digit
 * "annualized" volatility off a couple of wild early prints. Both feed the
 * *same* shared covariance matrix (`lib/analytics/correlation.ts`): beta
 * multiplies into every pairwise covariance entry, volatility into a
 * holding's own variance and its same-sector/industry pairs. Left unchecked,
 * one such holding corrupts beta, volatility, correlation, the
 * diversification ratio, and risk contributions for the *whole* portfolio,
 * not just its own row — wildly out of proportion to its actual weight. Real
 * values, including leveraged/inverse funds and genuinely volatile small
 * caps, essentially never exceed these bounds, so anything beyond them is far
 * more likely a numerical artifact than a true reading.
 */
const PLAUSIBLE_BETA_BOUND = 5;
const PLAUSIBLE_VOLATILITY_BOUND = 3; // 300% annualized

/**
 * Drop a beta/volatility reading outside the plausible range, treating it as
 * "no data" for that field rather than a value to trust — falls through to
 * the neutral default and is correctly labeled "Estimated", the same as any
 * other gap. Generic so it works on a full `FundamentalsPatch` (Yahoo) or the
 * `Partial<FundamentalsPatch>` Finnhub returns, applied to each provider
 * independently and *before* the gap-fill merge — so a Yahoo blow-up doesn't
 * also discard a perfectly good Finnhub reading by making the field look
 * "already filled".
 */
export function sanitizeImplausibleFields<
  T extends { beta?: number; volatility?: number },
>(patch: T): T {
  let out = patch;
  if (out.beta !== undefined && Math.abs(out.beta) > PLAUSIBLE_BETA_BOUND) {
    out = { ...out };
    delete out.beta;
  }
  if (
    out.volatility !== undefined &&
    Math.abs(out.volatility) > PLAUSIBLE_VOLATILITY_BOUND
  ) {
    out = { ...out };
    delete out.volatility;
  }
  return out;
}

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
 * data" and degrades accordingly. Each provider's beta/volatility is run
 * through {@link sanitizeImplausibleFields} independently, before the merge,
 * since either can return an unstable computation for thinly-traded names.
 */
export async function fetchFundamentalsPatch(
  symbol: string
): Promise<FundamentalsPatch | null> {
  const [yahooRaw, finnhubRaw] = await Promise.all([
    fetchYahooPatch(symbol),
    fetchFinnhubPatch(symbol),
  ]);
  const yahoo = yahooRaw ? sanitizeImplausibleFields(yahooRaw) : yahooRaw;
  const finnhub = finnhubRaw ? sanitizeImplausibleFields(finnhubRaw) : finnhubRaw;

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
