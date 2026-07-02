import type { HistoryPoint } from "@/lib/research/types";

/**
 * Module-scope bridge for per-symbol return history, mirroring the primed-
 * singleton pattern used for live CMA (`getCMA`) and assumptions
 * (`getAssumptions`). The client hook `useReturnHistory` fetches ~1y of daily
 * prices per symbol from `/api/history`, and the pure covariance estimator
 * (`lib/analytics/correlation.ts` → `lib/analytics/shrinkage.ts`) reads the
 * aligned returns back through {@link getReturns} — without threading a
 * parameter through every analytics call site.
 *
 * Unit tests never prime it, so {@link getReturns} returns `null` and the
 * analytics fall back to the structural factor covariance exactly as before.
 */

/** Daily bars → ~252 trading periods a year (the range we fetch is `1y` daily). */
const TRADING_DAYS = 252;
/**
 * Minimum overlapping observations before we trust a sample covariance at all.
 * Below this the shrinkage estimator is skipped and the structural target is
 * used untouched — ~6 months of common history is the floor.
 */
const MIN_OBS = 120;

/** Per-symbol map of day → log return. */
type DateReturns = Map<string, number>;

const store = new Map<string, DateReturns>();

/** Day bucket for a bar's ISO close timestamp (YYYY-MM-DD). */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Prime (or replace) a symbol's return series from its price history. Log
 * returns are keyed by the *later* bar's day so two symbols align on shared
 * trading days. A series shorter than two usable prints clears the symbol.
 */
export function setReturnSeries(symbol: string, points: HistoryPoint[]): void {
  if (points.length < 2) {
    store.delete(symbol);
    return;
  }
  const m: DateReturns = new Map();
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].c;
    const b = points[i].c;
    if (a > 0 && b > 0) m.set(dayKey(points[i].t), Math.log(b / a));
  }
  if (m.size > 0) store.set(symbol, m);
  else store.delete(symbol);
}

/**
 * Daily change in the risk-free yield level (percent points, e.g. +0.02 = +2bp),
 * keyed by day. Primed from the ^IRX history the CMA endpoint returns; consumed
 * by {@link getRateBeta}. A +100bp move is +1.0 in these units, matching the
 * Scenarios rate-shock magnitude.
 */
let rateChanges: DateReturns | null = null;

/**
 * Prime the rate-change series from ^IRX yield levels (percent points). Stored
 * as first differences so it lines up with per-symbol return days for the
 * empirical rate-beta regression.
 */
export function setRateSeries(points: HistoryPoint[]): void {
  if (points.length < 2) {
    rateChanges = null;
    return;
  }
  const m: DateReturns = new Map();
  for (let i = 1; i < points.length; i++) {
    m.set(dayKey(points[i].t), points[i].c - points[i - 1].c);
  }
  rateChanges = m.size > 0 ? m : null;
}

/**
 * Empirical rate beta for a symbol: the OLS slope of its daily returns on daily
 * risk-free-rate changes, i.e. the return per +100bp move. `null` when either
 * series is unprimed, they share fewer than {@link MIN_OBS} days, or the rate
 * series has no variance — callers then fall back to the duration heuristic.
 */
export function getRateBeta(symbol: string): number | null {
  const assetMap = store.get(symbol);
  if (!assetMap || !rateChanges) return null;

  const xs: number[] = []; // rate changes
  const ys: number[] = []; // asset returns
  for (const [day, dy] of rateChanges) {
    const r = assetMap.get(day);
    if (r !== undefined) {
      xs.push(dy);
      ys.push(r);
    }
  }
  const n = xs.length;
  if (n < MIN_OBS) return null;

  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let varx = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    cov += dx * (ys[i] - my);
    varx += dx * dx;
  }
  if (varx <= 1e-12) return null;
  return cov / varx;
}

/** Drop all primed history (used by tests and on a full portfolio clear). */
export function clearReturns(): void {
  store.clear();
  rateChanges = null;
}

export interface AlignedReturns {
  /** Per-asset return series over the common date set, `[asset][t]`. */
  matrix: number[][];
  /** Periods per year for annualization (252 for the daily series we fetch). */
  annualization: number;
  /** Number of overlapping observations the matrix spans. */
  observations: number;
}

/**
 * Aligned return matrix for a set of symbols over their common trading days, in
 * the given symbol order — or `null` when the shrinkage estimator should be
 * skipped and the structural covariance used instead.
 *
 * All-or-nothing on coverage: if *any* requested symbol has no primed history,
 * or the symbols share fewer than {@link MIN_OBS} common days, this returns
 * `null` rather than shrink a subset and distort the rest. That keeps the
 * degradation honest — a single illiquid holding falls the whole matrix back to
 * the structural model instead of silently mixing two estimators.
 */
export function getReturns(symbols: string[]): AlignedReturns | null {
  if (symbols.length === 0) return null;

  const maps: DateReturns[] = [];
  for (const s of symbols) {
    const m = store.get(s);
    if (!m) return null;
    maps.push(m);
  }

  // Intersect the day sets across every symbol.
  let common = [...maps[0].keys()];
  for (let i = 1; i < maps.length && common.length > 0; i++) {
    const m = maps[i];
    common = common.filter((d) => m.has(d));
  }
  if (common.length < MIN_OBS) return null;
  common.sort();

  const matrix = maps.map((m) => common.map((d) => m.get(d)!));
  return { matrix, annualization: TRADING_DAYS, observations: common.length };
}
