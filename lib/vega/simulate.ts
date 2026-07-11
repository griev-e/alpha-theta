import { mulberry32 } from "@/lib/analytics/mathUtils";

/**
 * The expectancy simulator — a bootstrap Monte Carlo over the trader's OWN
 * R-multiple distribution. Instead of assuming a return model, it resamples
 * the journal's actual closed-trade outcomes (with replacement) into
 * thousands of alternate futures and reads off what the *sequence risk* of
 * this exact edge looks like: the fan of equity paths, the odds of finishing
 * positive, the depth of a typical worst drawdown, and the probability of
 * hitting a chosen drawdown limit ("risk of ruin").
 *
 * This is the same philosophy as alpha's Monte Carlo (seeded, deterministic
 * per input — mulberry32 shared via lib/analytics/mathUtils) applied to trade
 * sequences instead of price paths: nothing is imputed, the distribution IS
 * the journal. Which is also its honest caveat — a small journal bootstraps a
 * small truth, so the caller surfaces the sample count alongside the fan.
 */

export interface SimBands {
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
}

export interface TradeSimResult {
  /** Simulated sequences. */
  paths: number;
  /** Trades per sequence. */
  horizon: number;
  /** Historical R-multiples that fed the bootstrap. */
  samples: number;
  /** Mean R of the sampled distribution — expectancy per trade. */
  expectancy: number;
  /** Equity quantiles per step (cumulative R), index 0 = after first trade. */
  bands: SimBands;
  /** Share of paths that end above 0 R. */
  pPositive: number;
  /** Share of paths whose max drawdown ever reaches `ddLimitR`. */
  riskOfRuin: number;
  /** The drawdown limit the ruin probability was measured against (R). */
  ddLimitR: number;
  /** Median of each path's worst peak-to-trough drawdown (R, ≤ 0). */
  medianMaxDrawdown: number;
}

export interface SimOptions {
  /** Trades per simulated sequence. */
  horizon?: number;
  /** Number of bootstrap sequences. */
  paths?: number;
  /** Drawdown depth (in R, positive number) that counts as ruin. */
  ddLimitR?: number;
  /** PRNG seed override; derived from the samples when omitted. */
  seed?: number;
}

/** Deterministic seed from the sample set — same journal, same fan. */
function hashSamples(rs: number[]): number {
  let h = 2166136261 >>> 0;
  for (const r of rs) {
    // Quantize so float noise doesn't reshuffle the seed.
    const q = Math.round(r * 1000);
    h = Math.imul(h ^ (q & 0xffff), 16777619);
    h = Math.imul(h ^ ((q >> 16) & 0xffff), 16777619);
  }
  return h >>> 0;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Minimum closed R-multiples before the simulator will speak. */
export const SIM_MIN_SAMPLES = 10;

/**
 * Run the bootstrap. Returns null below `SIM_MIN_SAMPLES` — a fan drawn from
 * a handful of trades would be noise wearing a confidence band.
 */
export function simulateTrading(
  rMultiples: number[],
  opts: SimOptions = {}
): TradeSimResult | null {
  const rs = rMultiples.filter((r) => Number.isFinite(r));
  if (rs.length < SIM_MIN_SAMPLES) return null;
  const horizon = Math.max(5, Math.min(500, Math.round(opts.horizon ?? 50)));
  const paths = Math.max(100, Math.min(10_000, Math.round(opts.paths ?? 2000)));
  const ddLimitR = Math.max(0.5, opts.ddLimitR ?? 10);
  const rand = mulberry32(opts.seed ?? hashSamples(rs) ^ (horizon * 2654435761));

  // equity[step][path] — kept step-major so quantiles slice cheaply.
  const perStep: number[][] = Array.from({ length: horizon }, () => new Array(paths));
  let ruined = 0;
  let positive = 0;
  const maxDds: number[] = new Array(paths);
  for (let p = 0; p < paths; p++) {
    let equity = 0;
    let peak = 0;
    let maxDd = 0;
    let hitLimit = false;
    for (let s = 0; s < horizon; s++) {
      equity += rs[Math.floor(rand() * rs.length)];
      if (equity > peak) peak = equity;
      const dd = equity - peak;
      if (dd < maxDd) maxDd = dd;
      if (peak - equity >= ddLimitR) hitLimit = true;
      perStep[s][p] = equity;
    }
    if (hitLimit) ruined++;
    if (equity > 0) positive++;
    maxDds[p] = maxDd;
  }

  const bands: SimBands = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  for (let s = 0; s < horizon; s++) {
    const sorted = [...perStep[s]].sort((a, b) => a - b);
    bands.p10.push(quantile(sorted, 0.1));
    bands.p25.push(quantile(sorted, 0.25));
    bands.p50.push(quantile(sorted, 0.5));
    bands.p75.push(quantile(sorted, 0.75));
    bands.p90.push(quantile(sorted, 0.9));
  }
  maxDds.sort((a, b) => a - b);

  return {
    paths,
    horizon,
    samples: rs.length,
    expectancy: rs.reduce((a, r) => a + r, 0) / rs.length,
    bands,
    pPositive: positive / paths,
    riskOfRuin: ruined / paths,
    ddLimitR,
    medianMaxDrawdown: quantile(maxDds, 0.5),
  };
}
