import { yf } from "./yahoo";
import type {
  Bar,
  Interval,
  IntradaySeries,
  VegaMarketState,
  VegaQuote,
} from "@/lib/vega/types";

/**
 * Server-side intraday data for vega (Yahoo via yahoo-finance2 — only ever
 * imported from route handlers). Two calls back the whole terminal:
 *
 *  - `fetchIntraday` — OHLCV bars for ONE symbol (the focused chart),
 *  - `fetchVegaQuotes` — a rich day-trading quote for the WHOLE watchlist in
 *    a single batched request.
 *
 * Rate-limit posture: the client polls quotes every 30s (one batch call) and
 * the chart every 60s (one chart call), both behind warm-lambda caches sized
 * a shade over the poll interval plus CDN caching — so steady-state provider
 * traffic stays at a couple of requests per minute regardless of how many
 * tabs or symbols are in play. No per-symbol fan-out anywhere.
 */

const INTERVAL_CFG: Record<
  Interval,
  { days: number; ttl: number; yfInterval: "1m" | "5m" | "15m" | "1d"; prePost: boolean }
> = {
  // Calendar spans carry weekend slack so at least two trading sessions come
  // back (prior-day levels need the previous session) — the client windows
  // the display down to a session count. Yahoo serves 1m bars ~7 days back.
  "1m": { days: 4, ttl: 55_000, yfInterval: "1m", prePost: true },
  "5m": { days: 4, ttl: 55_000, yfInterval: "5m", prePost: true },
  "15m": { days: 8, ttl: 55_000, yfInterval: "15m", prePost: true },
  "1d": { days: 190, ttl: 10 * 60_000, yfInterval: "1d", prePost: false },
};

const seriesCache = new Map<string, { at: number; data: IntradaySeries | null }>();
const NEG_TTL = 5 * 60_000;

/**
 * vega's symbol sanitizer. Unlike alpha's (`sanitizeSymbols`), this keeps the
 * `^` prefix so index tickers (^VIX, ^TNX) survive — the internals tape needs
 * them — and `=F`/`=X` style futures/FX suffixes.
 */
export function sanitizeVegaSymbols(raw: string | null, max = 40): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim().toUpperCase().replace(/[^A-Z0-9.^=\-]/g, ""))
        .filter((s) => s.length > 0 && s.length <= 12 && s !== "^" && s !== "=")
    ),
  ]
    .sort()
    .slice(0, max);
}

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim().length > 0 ? v : undefined;

/** Map raw chart quotes into clean OHLCV bars. Exported for tests. */
export function toBars(rows: unknown[]): Bar[] {
  const out: Bar[] = [];
  for (const raw of rows) {
    const q = raw as {
      date?: Date;
      open?: number | null;
      high?: number | null;
      low?: number | null;
      close?: number | null;
      volume?: number | null;
    };
    const o = num(q.open);
    const h = num(q.high);
    const l = num(q.low);
    const c = num(q.close);
    if (!(q.date instanceof Date) || o === undefined || h === undefined || l === undefined || c === undefined)
      continue;
    if (c <= 0 || h < l) continue;
    out.push({
      t: q.date.toISOString(),
      o,
      h,
      l,
      c,
      v: Math.max(0, num(q.volume) ?? 0),
    });
  }
  return out;
}

export interface IntradayFetch {
  series: IntradaySeries | null;
  /** True when the provider call FAILED (transient error) — distinct from a
   *  conclusive "no bars for this symbol". On failure the last good series
   *  (if any) is served stale so a hiccup never wipes a working chart. */
  error: boolean;
}

/** OHLCV bars for one symbol at one interval. `series: null, error: false`
 *  means the provider conclusively has nothing (negative-cached); a thrown
 *  provider call reports `error: true` and is never cached as fact. */
export async function fetchIntraday(
  symbol: string,
  interval: Interval
): Promise<IntradayFetch> {
  const cfg = INTERVAL_CFG[interval];
  const key = `${symbol}:${interval}`;
  const now = Date.now();
  const hit = seriesCache.get(key);
  const ttl = hit?.data === null ? NEG_TTL : cfg.ttl;
  if (hit && now - hit.at < ttl) return { series: hit.data, error: false };

  try {
    const result = await yf.chart(symbol, {
      period1: new Date(now - cfg.days * 86_400_000),
      interval: cfg.yfInterval,
      includePrePost: cfg.prePost,
    });
    const bars = toBars(result.quotes as unknown[]);
    const series: IntradaySeries | null =
      bars.length >= 2
        ? { symbol, interval, currency: str(result.meta?.currency) ?? "USD", bars }
        : null; // a successful fetch with nothing usable IS conclusive
    seriesCache.set(key, { at: now, data: series });
    return { series, error: false };
  } catch {
    // Transient provider failure: serve whatever we last knew (stale beats
    // blank) and never negative-cache an outage as "symbol has no data".
    return { series: hit?.data ?? null, error: true };
  }
}

const MARKET_STATE: Record<string, VegaMarketState> = {
  PRE: "PRE",
  PREPRE: "PRE",
  REGULAR: "REGULAR",
  POST: "POST",
  POSTPOST: "POST",
  CLOSED: "CLOSED",
};

/**
 * Map one raw Yahoo quote to a VegaQuote — extended-hours aware (the traded
 * price outside RTH is the pre/post print; change stays anchored to the prior
 * regular close). Exported for tests. Null when the row is unusable.
 */
export function toVegaQuote(raw: unknown): VegaQuote | null {
  const q = raw as {
    symbol?: string;
    shortName?: string;
    longName?: string;
    marketState?: string;
    regularMarketPrice?: number;
    regularMarketPreviousClose?: number;
    regularMarketOpen?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    regularMarketVolume?: number;
    averageDailyVolume10Day?: number;
    averageDailyVolume3Month?: number;
    regularMarketTime?: Date;
    preMarketPrice?: number;
    preMarketTime?: Date;
    postMarketPrice?: number;
    postMarketTime?: Date;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
  } | null;
  if (!q?.symbol) return null;
  const regular = num(q.regularMarketPrice);
  if (regular === undefined) return null;

  const stateRaw = (q.marketState ?? "REGULAR").toUpperCase();
  const marketState: VegaMarketState = stateRaw.startsWith("PRE")
    ? "PRE"
    : (MARKET_STATE[stateRaw] ?? "CLOSED");

  let price = regular;
  let time: Date | undefined = q.regularMarketTime;
  if (marketState === "PRE" && num(q.preMarketPrice) !== undefined) {
    price = q.preMarketPrice as number;
    time = q.preMarketTime ?? time;
  } else if (marketState !== "REGULAR" && num(q.postMarketPrice) !== undefined) {
    price = q.postMarketPrice as number;
    time = q.postMarketTime ?? time;
  }

  const prevClose = num(q.regularMarketPreviousClose) ?? null;
  return {
    symbol: q.symbol,
    name: str(q.shortName) ?? str(q.longName) ?? null,
    price,
    regularPrice: regular,
    prevClose,
    open: num(q.regularMarketOpen) ?? null,
    dayHigh: num(q.regularMarketDayHigh) ?? null,
    dayLow: num(q.regularMarketDayLow) ?? null,
    volume: num(q.regularMarketVolume) ?? null,
    avgVolume10d: num(q.averageDailyVolume10Day) ?? null,
    avgVolume3m: num(q.averageDailyVolume3Month) ?? null,
    marketState,
    changePct:
      prevClose !== null && prevClose > 0 ? price / prevClose - 1 : null,
    high52w: num(q.fiftyTwoWeekHigh) ?? null,
    low52w: num(q.fiftyTwoWeekLow) ?? null,
    asOf: time instanceof Date ? time.toISOString() : new Date().toISOString(),
  };
}

const quoteCache = new Map<string, { at: number; data: VegaQuote | null }>();
const QUOTE_TTL = 25_000; // a shade under the client's 30s poll
const QUOTE_NEG_TTL = 10 * 60_000;

/** After a fallback round where EVERY per-symbol call also failed (a provider
 *  outage, not a poison-pill symbol), suppress the fan-out for this window so
 *  an outage costs one batch call per poll instead of one-plus-forty. */
const SINGLES_COOLDOWN = 2 * 60_000;
let singlesSuppressedUntil = 0;

/**
 * Batched rich quotes. Mirrors `fetchQuotes`' partial-failure hygiene: a
 * poison-pill symbol falls back to per-symbol fetches, and conclusive misses
 * are negative-cached so they back off instead of re-failing every poll.
 * A total outage (batch AND every single failing) trips a cooldown that
 * skips the fallback — the anti-fan-out rule holds hardest when the
 * provider is already struggling.
 */
export async function fetchVegaQuotes(
  symbols: string[]
): Promise<Record<string, VegaQuote>> {
  const now = Date.now();
  const out: Record<string, VegaQuote> = {};
  const missing: string[] = [];
  for (const s of symbols) {
    const hit = quoteCache.get(s);
    const ttl = hit?.data === null ? QUOTE_NEG_TTL : QUOTE_TTL;
    if (hit && now - hit.at < ttl) {
      if (hit.data) out[s] = hit.data;
    } else {
      missing.push(s);
    }
  }
  if (missing.length > 0) {
    let batchOk = false;
    const resolved = new Set<string>();
    const ingest = (raw: unknown): void => {
      const quote = toVegaQuote(raw);
      if (!quote) return;
      out[quote.symbol] = quote;
      quoteCache.set(quote.symbol, { at: now, data: quote });
      resolved.add(quote.symbol);
    };
    try {
      const results = await yf.quote(missing);
      batchOk = true;
      const list = Array.isArray(results) ? results : [results];
      for (const q of list) ingest(q);
    } catch {
      if (now < singlesSuppressedUntil) return out; // outage cooldown — no fan-out
      const singles = await Promise.allSettled(missing.map((s) => yf.quote(s)));
      batchOk = singles.some((r) => r.status === "fulfilled");
      if (!batchOk) singlesSuppressedUntil = now + SINGLES_COOLDOWN;
      singles.forEach((r) => {
        if (r.status === "fulfilled") ingest(r.value);
      });
    }
    if (batchOk) {
      for (const s of missing) {
        if (!resolved.has(s)) quoteCache.set(s, { at: now, data: null });
      }
    }
  }
  return out;
}
