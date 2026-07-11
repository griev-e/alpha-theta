import {
  etStamp,
  inRegularHours,
  minutesSinceOpen,
  RTH_OPEN_MIN,
  splitSessions,
} from "./session";
import type { Bar } from "./types";

/**
 * Key price levels for the trading day — the scaffolding a day trader marks
 * before the open: prior-day high/low/close, classic floor-trader pivots,
 * today's opening range, and data-derived swing levels. All pure functions of
 * the bars they're handed.
 */

export interface PivotLevels {
  p: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

/** Classic floor-trader pivots from the prior session's high/low/close. */
export function floorPivots(h: number, l: number, c: number): PivotLevels {
  const p = (h + l + c) / 3;
  return {
    p,
    r1: 2 * p - l,
    s1: 2 * p - h,
    r2: p + (h - l),
    s2: p - (h - l),
    r3: h + 2 * (p - l),
    s3: l - 2 * (h - p),
  };
}

export interface PriorDay {
  high: number;
  low: number;
  close: number;
}

/**
 * The most recent COMPLETED session's high/low/close from an intraday series:
 * the second-to-last ET session (the last one is the in-progress day). Regular
 * hours only, so a premarket spike never inflates "yesterday's high". Null
 * until two sessions of data exist.
 */
export function priorDayFromIntraday(bars: Bar[]): PriorDay | null {
  const sessions = splitSessions(bars);
  if (sessions.length < 2) return null;
  const prev = sessions[sessions.length - 2].filter((b) => inRegularHours(b.t));
  if (prev.length === 0) return null;
  let high = -Infinity;
  let low = Infinity;
  for (const b of prev) {
    if (b.h > high) high = b.h;
    if (b.l < low) low = b.l;
  }
  return { high, low, close: prev[prev.length - 1].c };
}

/** Prior completed day from a DAILY series whose last bar is the live day. */
export function priorDayFromDaily(bars: Bar[]): PriorDay | null {
  if (bars.length < 2) return null;
  const b = bars[bars.length - 2];
  return { high: b.h, low: b.l, close: b.c };
}

export interface OpeningRange {
  high: number;
  low: number;
  /** True once the window has fully elapsed (the range is final). */
  complete: boolean;
}

/**
 * Today's opening range: the high/low of the first `minutes` of the latest
 * session's regular hours. Null before the open prints its first bar.
 */
export function openingRange(bars: Bar[], minutes: number): OpeningRange | null {
  const sessions = splitSessions(bars);
  if (sessions.length === 0) return null;
  const today = sessions[sessions.length - 1];
  const rth = today.filter((b) => inRegularHours(b.t));
  if (rth.length === 0) return null;
  let high = -Infinity;
  let low = Infinity;
  let sawLater = false;
  for (const b of rth) {
    if (minutesSinceOpen(b.t) < minutes) {
      if (b.h > high) high = b.h;
      if (b.l < low) low = b.l;
    } else {
      sawLater = true;
    }
  }
  if (!Number.isFinite(high)) return null;
  return { high, low, complete: sawLater };
}

/** Today's premarket high/low (bars before 09:30 ET in the latest session). */
export function premarketRange(bars: Bar[]): { high: number; low: number } | null {
  const sessions = splitSessions(bars);
  if (sessions.length === 0) return null;
  const today = sessions[sessions.length - 1];
  let high = -Infinity;
  let low = Infinity;
  for (const b of today) {
    if (etStamp(b.t).minutes < RTH_OPEN_MIN) {
      if (b.h > high) high = b.h;
      if (b.l < low) low = b.l;
    }
  }
  return Number.isFinite(high) ? { high, low } : null;
}

export interface SwingLevel {
  price: number;
  /** How many swing points cluster at this level — more touches, stronger level. */
  touches: number;
  kind: "support" | "resistance";
}

/**
 * Data-derived support/resistance: local swing highs/lows (a bar whose
 * high/low exceeds its `lookback` neighbors on both sides), clustered when
 * within `tolerancePct` of each other, ranked by touch count. Follows the
 * house principle of deriving levels from the series itself rather than
 * hand-tuned thresholds — tolerance scales with price.
 */
export function swingLevels(
  bars: Bar[],
  lookback = 3,
  maxLevels = 6,
  tolerancePct = 0.002
): SwingLevel[] {
  if (bars.length < lookback * 2 + 1) return [];
  const swings: { price: number; kind: "support" | "resistance" }[] = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (bars[j].h >= bars[i].h) isHigh = false;
      if (bars[j].l <= bars[i].l) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) swings.push({ price: bars[i].h, kind: "resistance" });
    if (isLow) swings.push({ price: bars[i].l, kind: "support" });
  }
  // Cluster: greedy merge into the nearest existing cluster within tolerance.
  const clusters: { sum: number; n: number; kind: "support" | "resistance" }[] = [];
  for (const s of swings) {
    const hit = clusters.find(
      (c) =>
        c.kind === s.kind &&
        Math.abs(c.sum / c.n - s.price) <= (c.sum / c.n) * tolerancePct
    );
    if (hit) {
      hit.sum += s.price;
      hit.n += 1;
    } else {
      clusters.push({ sum: s.price, n: 1, kind: s.kind });
    }
  }
  return clusters
    .map((c) => ({ price: c.sum / c.n, touches: c.n, kind: c.kind }))
    .sort((a, b) => b.touches - a.touches || b.price - a.price)
    .slice(0, maxLevels);
}
