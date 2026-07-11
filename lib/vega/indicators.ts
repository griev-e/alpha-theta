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
 * Bad-print hygiene for intraday bars. Keyless feeds occasionally carry a
 * rogue extended-hours tick that stretches one bar's wick far outside any
 * plausible range, blowing out the chart's scale and the derived levels. A
 * wick extending more than `k`× the series' median bar range beyond the body
 * is clamped to that envelope — bodies (open/close) are never altered, so
 * real moves survive and only the un-tradable spike is tamed.
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
  return bars.map((b) => {
    const top = Math.max(b.o, b.c);
    const bot = Math.min(b.o, b.c);
    if (b.h - top <= cap && bot - b.l <= cap) return b;
    return { ...b, h: Math.min(b.h, top + cap), l: Math.max(b.l, bot - cap) };
  });
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
