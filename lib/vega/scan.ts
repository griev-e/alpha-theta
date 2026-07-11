import { minutesSinceOpen, RTH_MINUTES } from "./session";
import type { VegaQuote } from "./types";

/**
 * The momentum scanner — cross-sectional day-trading metrics over the
 * watchlist's quote snapshot. Zero extra provider calls: everything derives
 * from the one batched quote the cockpit already polls.
 *
 * The composite score borrows the regime engine's defining principle: no
 * hand-tuned thresholds. Each metric is ranked against the *scanned set
 * itself* (percentiles), then averaged — so "hot" always means "hot relative
 * to what you're watching today", not hot versus a magic number.
 */

export interface ScanRow {
  symbol: string;
  name: string | null;
  price: number;
  changePct: number | null;
  /** Open vs prior close — the overnight gap. */
  gapPct: number | null;
  /** Relative volume: today's volume vs the 10-day average, pro-rated to the
   *  elapsed session so a 10:00 read isn't unfairly compared to a full day. */
  rvol: number | null;
  /** Day range (high−low) as a % of price — how much it's actually moving. */
  rangePct: number | null;
  /** Where price sits in the day range: 0 = at low, 1 = at high. */
  rangePos: number | null;
  /** Move off the open — intraday trend, gap excluded. */
  fromOpenPct: number | null;
  /** Composite momentum score, 0–100, ranked within the scanned set. */
  score: number | null;
  /** Human-readable setup flags ("gap ↑", "high rvol", "at HOD", …). */
  tags: string[];
}

/**
 * Fraction of the regular session elapsed at `nowIso`, used to pro-rate RVOL.
 * Only REGULAR pro-rates; PRE/POST/CLOSED treat the referenced session's
 * volume as final. (During PRE the provider's day fields still describe the
 * PRIOR session — see scanQuote, which nulls the intraday metrics then — so
 * a premarket floor here would divide yesterday's full volume by ~0.)
 */
export function sessionElapsedFraction(
  state: VegaQuote["marketState"],
  nowIso: string
): number {
  if (state === "REGULAR") {
    return Math.min(1, Math.max(0.04, minutesSinceOpen(nowIso) / RTH_MINUTES));
  }
  return 1; // PRE / POST / CLOSED — the referenced session's volume is final
}

const pct = (a: number, b: number): number | null =>
  b > 0 && Number.isFinite(a / b - 1) ? a / b - 1 : null;

/** Per-symbol metrics from one quote. Pure; `nowIso` is an explicit input.
 *
 * Premarket honesty: before the open, the provider's day fields (open, high,
 * low, volume) still describe the PRIOR session, so the intraday metrics
 * would be yesterday's dressed up as today's — and RVOL would divide a full
 * prior day by a sliver of elapsed session. In PRE the gap becomes the LIVE
 * premarket gap (extended price vs the last regular close) and the
 * session-bound metrics go null rather than stale. */
export function scanQuote(q: VegaQuote, nowIso: string): Omit<ScanRow, "score"> {
  const pre = q.marketState === "PRE";
  const gapPct = pre
    ? q.regularPrice !== null
      ? pct(q.price, q.regularPrice)
      : null
    : q.open !== null && q.prevClose !== null
      ? pct(q.open, q.prevClose)
      : null;
  const avg = q.avgVolume10d ?? q.avgVolume3m;
  const rvol =
    !pre && q.volume !== null && avg !== null && avg > 0
      ? q.volume / (avg * sessionElapsedFraction(q.marketState, nowIso))
      : null;
  const range =
    !pre && q.dayHigh !== null && q.dayLow !== null && q.dayHigh >= q.dayLow
      ? q.dayHigh - q.dayLow
      : null;
  const rangePct = range !== null && q.price > 0 ? range / q.price : null;
  // Range position reads the regular-session tape, so an after-hours print
  // outside the day's range doesn't produce a nonsense >1 position.
  const inDay = q.regularPrice ?? q.price;
  const rangePos =
    range !== null && range > 0 && q.dayLow !== null
      ? Math.min(1, Math.max(0, (inDay - q.dayLow) / range))
      : null;
  const fromOpenPct = !pre && q.open !== null ? pct(inDay, q.open) : null;

  const tags: string[] = [];
  if (gapPct !== null && Math.abs(gapPct) >= 0.02)
    tags.push(gapPct > 0 ? "gap ↑" : "gap ↓");
  if (rvol !== null && rvol >= 1.5) tags.push("high rvol");
  if (rangePos !== null && rangePos >= 0.97) tags.push("at HOD");
  if (rangePos !== null && rangePos <= 0.03) tags.push("at LOD");
  if (q.high52w !== null && q.dayHigh !== null && q.dayHigh >= q.high52w * 0.998)
    tags.push("52w high");
  if (q.low52w !== null && q.dayLow !== null && q.dayLow <= q.low52w * 1.002)
    tags.push("52w low");

  return {
    symbol: q.symbol,
    name: q.name,
    price: q.price,
    changePct: q.changePct,
    gapPct,
    rvol,
    rangePct,
    rangePos,
    fromOpenPct,
    tags,
  };
}

/** Percentile rank (0..1) of each defined value within its own set. */
function percentiles(values: (number | null)[]): (number | null)[] {
  const defined = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v !== null);
  const sorted = [...defined].sort((a, b) => a.v - b.v);
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (defined.length <= 1) {
    for (const d of defined) out[d.i] = 0.5;
    return out;
  }
  sorted.forEach((d, rank) => {
    out[d.i] = rank / (sorted.length - 1);
  });
  return out;
}

/**
 * Rank the set: score = mean percentile of |gap|, rvol, range, |move off the
 * open| — the four faces of "in play". Symbols missing every metric stay
 * unscored rather than defaulting to a fake mid rank.
 */
export function rankScans(rows: Omit<ScanRow, "score">[]): ScanRow[] {
  const gp = percentiles(rows.map((r) => (r.gapPct !== null ? Math.abs(r.gapPct) : null)));
  const rv = percentiles(rows.map((r) => r.rvol));
  const rg = percentiles(rows.map((r) => r.rangePct));
  const fo = percentiles(
    rows.map((r) => (r.fromOpenPct !== null ? Math.abs(r.fromOpenPct) : null))
  );
  return rows.map((r, i) => {
    const parts = [gp[i], rv[i], rg[i], fo[i]].filter((x): x is number => x !== null);
    return {
      ...r,
      score: parts.length > 0
        ? Math.round((parts.reduce((s, x) => s + x, 0) / parts.length) * 100)
        : null,
    };
  });
}
