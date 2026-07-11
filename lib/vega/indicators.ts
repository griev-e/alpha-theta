import { sessionKey, inRegularHours } from "./session";
import type { Bar } from "./types";

/**
 * Technical-indicator engine — pure, allocation-light functions over bar
 * series. Every function returns an array aligned 1:1 with its input, with
 * `null` for warm-up positions where the indicator isn't defined yet, so
 * charts can overlay results without index bookkeeping.
 *
 * Formulas follow the standard references (Wilder for RSI/ATR, Appel for
 * MACD, Bollinger's 20/2 defaults); methodology notes live next to the math,
 * matching the house rule in lib/analytics.
 */

export type Series = (number | null)[];

/** Simple moving average. */
export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential moving average, seeded with the SMA of the first `period`. */
export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  let prev = seed / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/**
 * Wilder's RSI. Warm-up needs `period + 1` closes; smoothing is Wilder's
 * running average (α = 1/period), not a plain SMA.
 */
export function rsi(closes: number[], period = 14): Series {
  const out: Series = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  const toRsi = (g: number, l: number) => (l === 0 ? 100 : 100 - 100 / (1 + g / l));
  out[period] = toRsi(avgGain, avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, d)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -d)) / period;
    out[i] = toRsi(avgGain, avgLoss);
  }
  return out;
}

export interface MacdResult {
  macd: Series;
  signal: Series;
  hist: Series;
}

/** MACD (12/26/9 by default): fast EMA − slow EMA, EMA-smoothed signal. */
export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): MacdResult {
  const fastE = ema(closes, fast);
  const slowE = ema(closes, slow);
  const line: Series = closes.map((_, i) =>
    fastE[i] !== null && slowE[i] !== null ? (fastE[i] as number) - (slowE[i] as number) : null
  );
  // Signal = EMA of the defined MACD stretch, re-aligned to the full index.
  const firstIdx = line.findIndex((v) => v !== null);
  const signal: Series = new Array(closes.length).fill(null);
  const hist: Series = new Array(closes.length).fill(null);
  if (firstIdx >= 0) {
    const defined = line.slice(firstIdx) as number[];
    const sig = ema(defined, signalPeriod);
    for (let i = 0; i < sig.length; i++) {
      if (sig[i] !== null) {
        signal[firstIdx + i] = sig[i];
        hist[firstIdx + i] = defined[i] - (sig[i] as number);
      }
    }
  }
  return { macd: line, signal, hist };
}

export interface BollingerResult {
  mid: Series;
  upper: Series;
  lower: Series;
}

/** Bollinger bands: SMA(period) ± k·σ (population σ, the standard choice). */
export function bollinger(closes: number[], period = 20, k = 2): BollingerResult {
  const mid = sma(closes, period);
  const upper: Series = new Array(closes.length).fill(null);
  const lower: Series = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const m = mid[i];
    if (m === null) continue;
    let s2 = 0;
    for (let j = i - period + 1; j <= i; j++) s2 += (closes[j] - m) ** 2;
    const sd = Math.sqrt(s2 / period);
    upper[i] = m + k * sd;
    lower[i] = m - k * sd;
  }
  return { mid, upper, lower };
}

/** Wilder's ATR over OHLC bars. */
export function atr(bars: Bar[], period = 14): Series {
  const out: Series = new Array(bars.length).fill(null);
  if (bars.length <= period) return out;
  const tr = (i: number): number => {
    const b = bars[i];
    if (i === 0) return b.h - b.l;
    const pc = bars[i - 1].c;
    return Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc));
  };
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr(i);
  let prev = sum / period;
  out[period] = prev;
  for (let i = period + 1; i < bars.length; i++) {
    prev = (prev * (period - 1) + tr(i)) / period;
    out[i] = prev;
  }
  return out;
}

export function typicalPrice(b: Bar): number {
  return (b.h + b.l + b.c) / 3;
}

/**
 * Bad-print hygiene for intraday bars — three passes over the same `k`× the
 * series' median bar range envelope. Keyless feeds print rogue
 * extended-hours ticks that blow out the chart's scale and the derived
 * levels; each pass removes one observed phantom shape while real moves
 * stay untouchable by construction:
 *
 *  1. **Wick clamp** — a wick extending more than the envelope beyond the
 *     body is cut to it (bodies untouched, real candles survive).
 *  2. **Endpoint despike** — a bar whose close sits an envelope away from
 *     BOTH its own open and the next bar's tape is a phantom print, not a
 *     move: a real breakout close is confirmed by the next bar trading
 *     there, and a real into-the-gap close is coherent with its own open.
 *     The phantom endpoint is pulled back to its own bar's envelope (opens
 *     mirror the same rule against the previous bar).
 *  3. **Body despike** — a bar whose ENTIRE body sits beyond the envelope
 *     from the median close of its ±3-bar neighborhood (a wholly-displaced
 *     phantom, sometimes a short cluster of them) is pulled back to the
 *     neighborhood envelope. Real transition bars keep one side anchored,
 *     so they never trip the min-distance test.
 */
export function tameWicks(bars: Bar[], k = 10): Bar[] {
  if (bars.length < 5) return bars;
  const ranges = bars
    .map((b) => b.h - b.l)
    .filter((r) => r > 0)
    .sort((a, b) => a - b);
  if (ranges.length < 5) return bars;
  const med = ranges[Math.floor(ranges.length / 2)];
  if (!(med > 0)) return bars;
  const cap = k * med;
  const clampTo = (v: number, anchor: number): number =>
    Math.min(anchor + cap, Math.max(anchor - cap, v));

  let changed = false;
  const out = bars.map((b) => {
    const top = Math.max(b.o, b.c);
    const bot = Math.min(b.o, b.c);
    if (b.h - top <= cap && bot - b.l <= cap) return b;
    changed = true;
    return { ...b, h: Math.min(b.h, top + cap), l: Math.max(b.l, bot - cap) };
  });

  // Pass 2: one-sided phantom endpoints.
  const far = (a: number, b: number): boolean => Math.abs(a - b) > cap;
  for (let i = 0; i < out.length; i++) {
    const b = out[i];
    let { o, c } = b;
    const next = out[i + 1];
    const prev = out[i - 1];
    if (next && far(c, o) && far(c, next.o) && far(c, next.c)) c = clampTo(c, o);
    if (prev && far(o, c) && far(o, prev.c) && far(o, prev.o)) o = clampTo(o, c);
    if (o !== b.o || c !== b.c) {
      // The extreme printed alongside a phantom endpoint is equally
      // untrusted — allow only an ordinary wick beyond the repaired body.
      out[i] = {
        ...b,
        o,
        c,
        h: Math.min(b.h, Math.max(o, c) + med),
        l: Math.max(b.l, Math.min(o, c) - med),
      };
      changed = true;
    }
  }

  // Pass 3: wholly-displaced bodies. A bar must sit an envelope away from
  // the median close on EACH side independently — a real regime shift always
  // agrees with one side (the level it left or the one it reached), so only
  // a bar the tape on both sides disowns can fire.
  const closes = out.map((b) => b.c);
  const sideMedian = (from: number, to: number): number | null => {
    const vals: number[] = [];
    for (let j = Math.max(0, from); j <= Math.min(out.length - 1, to); j++) vals.push(closes[j]);
    if (vals.length < 2) return null;
    vals.sort((a, b) => a - b);
    return vals.length % 2 === 1
      ? vals[(vals.length - 1) / 2]
      : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2;
  };
  for (let i = 1; i < out.length - 1; i++) {
    const before = sideMedian(i - 3, i - 1);
    const after = sideMedian(i + 1, i + 3);
    if (before === null || after === null) continue;
    const b = out[i];
    const minDist = (ref: number) => Math.min(Math.abs(b.o - ref), Math.abs(b.c - ref));
    if (minDist(before) <= cap || minDist(after) <= cap) continue;
    const ref = (before + after) / 2;
    const o = clampTo(b.o, ref);
    const c = clampTo(b.c, ref);
    out[i] = {
      ...b,
      o,
      c,
      h: Math.min(b.h, Math.max(o, c) + cap),
      l: Math.max(b.l, Math.min(o, c) - cap),
    };
    changed = true;
  }
  return changed ? out : bars;
}

export interface VwapResult {
  vwap: Series;
  /** ±1σ and ±2σ volume-weighted deviation bands around VWAP. */
  upper1: Series;
  lower1: Series;
  upper2: Series;
  lower2: Series;
}

/**
 * Session-anchored VWAP with deviation bands. The accumulation resets at each
 * new ET trading day, and — matching how exchanges compute it — only regular-
 * session bars contribute; pre/post bars carry the running value forward so
 * the overlay stays continuous across an extended-hours chart. Bands are
 * ±k·σ where σ² is the volume-weighted variance of typical price around VWAP.
 */
export function sessionVwap(bars: Bar[]): VwapResult {
  const n = bars.length;
  const vwap: Series = new Array(n).fill(null);
  const upper1: Series = new Array(n).fill(null);
  const lower1: Series = new Array(n).fill(null);
  const upper2: Series = new Array(n).fill(null);
  const lower2: Series = new Array(n).fill(null);

  let key = "";
  let pv = 0; // Σ price·volume
  let pv2 = 0; // Σ price²·volume
  let vol = 0;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const k = sessionKey(b.t);
    if (k !== key) {
      key = k;
      pv = 0;
      pv2 = 0;
      vol = 0;
    }
    if (inRegularHours(b.t) && b.v > 0) {
      const tp = typicalPrice(b);
      pv += tp * b.v;
      pv2 += tp * tp * b.v;
      vol += b.v;
    }
    if (vol > 0) {
      const m = pv / vol;
      vwap[i] = m;
      const variance = Math.max(0, pv2 / vol - m * m);
      const sd = Math.sqrt(variance);
      upper1[i] = m + sd;
      lower1[i] = m - sd;
      upper2[i] = m + 2 * sd;
      lower2[i] = m - 2 * sd;
    }
  }
  return { vwap, upper1, lower1, upper2, lower2 };
}
