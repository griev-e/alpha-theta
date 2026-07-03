/**
 * theta — net-worth trajectory Monte Carlo.
 *
 * theta's analogue of alpha's portfolio Monte Carlo (`lib/analytics/montecarlo`),
 * but over a whole balance sheet rather than one holding. Invested assets follow
 * geometric Brownian motion at the assumed return/volatility; cash compounds
 * deterministically at its yield; net monthly savings are contributed to the
 * invested pool and grow each year with assumed income growth; liabilities are
 * held flat (a deliberately conservative floor — real paydown only helps). Net
 * worth each month is `invested + cash − liabilities`.
 *
 *   invested_{t+1} = invested_t · exp((μ − σ²/2)Δt + σ√Δt·Z) + contribution_t
 *   cash_{t+1}     = cash_t · (1 + cashYield/12)
 *
 * The RNG is seeded from the inputs (via `mulberry32`, shared with alpha) so a
 * given balance sheet always yields the same fan — it changes when the money
 * does, not on every render. Antithetic pairs halve the sampling noise.
 */

import { mulberry32 } from "@/lib/analytics/mathUtils";
import type { ThetaAssumptions } from "./assumptions";

export interface ProjectionInputs {
  /** Balance of invested (brokerage/retirement) accounts. */
  investedValue: number;
  /** Balance of cash (checking/savings) accounts. */
  cashValue: number;
  /** Total liabilities as a positive number. */
  liabilities: number;
  /** Net monthly savings added to the invested pool (income − expenses, floored at 0). */
  monthlyContribution: number;
  years: number;
  assumptions: ThetaAssumptions;
  /** Optional net-worth target; when set, the result reports the probability of reaching it. */
  target?: number | null;
  paths?: number;
  /** Salt to redraw a fresh-but-reproducible fan (the "resimulate" control). */
  seedSalt?: number;
}

export interface ProjectionBand {
  month: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface ProjectionResult {
  bands: ProjectionBand[];
  /** Terminal (horizon) net worth percentiles. */
  median: number;
  p5: number;
  p95: number;
  /** Median terminal net worth in today's dollars (deflated by assumed inflation). */
  realMedian: number;
  /** Probability of reaching `target` at the horizon, or null when no target. */
  probTarget: number | null;
  /** Total contributed over the horizon (nominal). */
  totalContributed: number;
  /** A few full sample paths for the chart backdrop. */
  samplePaths: number[][];
}

export function runProjection(inputs: ProjectionInputs): ProjectionResult {
  const {
    investedValue,
    cashValue,
    liabilities,
    monthlyContribution,
    assumptions: a,
    target,
  } = inputs;
  const years = Math.max(1, Math.min(50, inputs.years));
  const months = Math.round(years * 12);
  const paths = inputs.paths ?? 2000;
  const dt = 1 / 12;
  const sqrtDt = Math.sqrt(dt);
  const mu = a.investReturn;
  const sigma = Math.max(0, a.investVol);
  const monthlyCash = a.cashYield / 12;
  const contrib0 = Math.max(0, monthlyContribution);

  const seed =
    (Math.round(investedValue) ^
      (Math.round(cashValue) << 4) ^
      Math.round(liabilities) ^
      (months << 8) ^
      Math.round(contrib0 * 7) ^
      Math.round(mu * 10000) ^
      Math.round(sigma * 10000) ^
      Math.imul((inputs.seedSalt ?? 0) | 0, 0x9e3779b1)) >>>
    0;
  const rand = mulberry32(seed || 42);

  // Box–Muller with a cached spare.
  let spare: number | null = null;
  const normal = (): number => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    while (u === 0) u = rand();
    const v = rand();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };

  // Contribution grows once a year with assumed income growth.
  const contribAt = (month: number): number =>
    contrib0 * Math.pow(1 + a.incomeGrowth, Math.floor(month / 12));

  const halfVar = 0.5 * sigma * sigma * dt;
  const diffusion = sigma * sqrtDt;

  // Keep only the monthly cross-sections we read percentiles off.
  const cols: Float64Array[] = Array.from({ length: months + 1 }, () => new Float64Array(paths));
  const startNW = investedValue + cashValue - liabilities;
  cols[0].fill(startNW);

  const sampleCount = Math.min(24, paths);
  const sampleIdx = new Set<number>();
  for (let i = 0; i < sampleCount; i++) sampleIdx.add(Math.floor((i / sampleCount) * paths));
  const sampleMap = new Map<number, number[]>();
  for (const idx of sampleIdx) sampleMap.set(idx, [startNW]);

  const runOne = (p: number, zAt: (m: number) => number) => {
    let invested = investedValue;
    let cash = cashValue;
    const sample = sampleMap.get(p);
    for (let m = 1; m <= months; m++) {
      const z = zAt(m);
      invested = invested * Math.exp(mu * dt - halfVar + diffusion * z) + contribAt(m);
      cash = cash * (1 + monthlyCash);
      const nw = invested + cash - liabilities;
      cols[m][p] = nw;
      sample?.push(nw);
    }
  };

  // Antithetic pairs: shared shocks with mirrored sign.
  for (let p = 0; p < paths; p += 2) {
    const zs: number[] = new Array(months + 1);
    for (let m = 1; m <= months; m++) zs[m] = normal();
    runOne(p, (m) => zs[m]);
    if (p + 1 < paths) runOne(p + 1, (m) => -zs[m]);
  }

  const pctOf = (arr: Float64Array) => {
    const sorted = Float64Array.from(arr).sort();
    return (q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];
  };

  const bands: ProjectionBand[] = [];
  for (let m = 0; m <= months; m++) {
    const at = pctOf(cols[m]);
    bands.push({ month: m, p5: at(0.05), p25: at(0.25), p50: at(0.5), p75: at(0.75), p95: at(0.95) });
  }

  const terminal = cols[months];
  const at = pctOf(terminal);
  const median = at(0.5);
  const hit = target && target > 0 ? terminal.reduce((s, v) => s + (v >= target ? 1 : 0), 0) : 0;

  let totalContributed = 0;
  for (let m = 1; m <= months; m++) totalContributed += contribAt(m);

  return {
    bands,
    median,
    p5: at(0.05),
    p95: at(0.95),
    realMedian: median / Math.pow(1 + a.inflation, years),
    probTarget: target && target > 0 ? hit / paths : null,
    totalContributed,
    samplePaths: [...sampleMap.values()],
  };
}
