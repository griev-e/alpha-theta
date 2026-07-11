import { ema, macd, rsi, atr, sessionVwap } from "./indicators";
import { openingRange, floorPivots, priorDayFromIntraday } from "./levels";
import { inRegularHours, minutesSinceOpen, splitSessions } from "./session";
import type { Bar, VegaQuote } from "./types";

/**
 * The Edge Engine — vega's flagship analytical subsystem, and the intraday
 * sibling of alpha's market regime engine. It fuses the focused symbol's live
 * bars and quote into EIGHT signal layers (trend structure, VWAP posture,
 * momentum, volume pressure, range & levels, relative strength, gap behavior,
 * and an extension guard), each built from 2–3 concrete signals, and blends
 * them into one directional read: bias (long / short / neutral), a conviction
 * score, and how much the layers actually agree.
 *
 * House principles, inherited from the regime engine:
 *  - **No hand-tuned signal thresholds.** Bar-derived signals are ranked
 *    against their own trailing distribution over the fetched span
 *    (percentiles → a −1..+1 score), so "stretched" always means stretched
 *    *for this symbol at this timeframe today*, never versus a magic number.
 *    The few direct mappings that remain (VWAP σ units, up/down volume
 *    balance) are already dimensionless by construction.
 *  - **Weights are earned, not assigned.** Each layer's weight comes from its
 *    data coverage and the internal agreement of its own signals — a layer
 *    whose inputs are missing or self-contradicting fades out of the blend
 *    automatically.
 *  - **Nothing is imputed.** A signal with no data scores null and simply
 *    doesn't participate; the report carries an explicit coverage figure.
 *
 * The aggregation layer on top uses a small set of structural constants (the
 * neutral deadband, the agreement floor in the weight formula, the
 * driver/caution cutoffs) — documented at their definitions, mirroring the
 * regime engine's aggregation constants.
 *
 * Everything here is pure: bars + quotes in, report out, `nowIso` explicit.
 */

/* ── Report types ────────────────────────────────────────────────────── */

export type EngineBias = "long" | "short" | "neutral";

export interface EngineSignal {
  key: string;
  label: string;
  /** Human-readable current reading ("z +1.4σ", "up-vol 63%"). */
  detail: string;
  /** Directional score in [−1, +1]; null when the inputs are missing. */
  score: number | null;
}

export interface EngineLayer {
  key: string;
  label: string;
  /** One-line description of what the layer reads. */
  desc: string;
  signals: EngineSignal[];
  /** Mean of the defined signals' scores, [−1, +1]; null with no data. */
  score: number | null;
  /** Share of the layer's signals that had data, 0..1. */
  coverage: number;
  /** Internal agreement of the defined signals, 0..1 (1 = unanimous). */
  agreement: number;
  /** Earned weight, normalized across layers (sums to 1). */
  weight: number;
}

export interface EngineDriver {
  label: string;
  layer: string;
  /** Signed signal score, weighted by its layer's earned weight. */
  impact: number;
}

export interface RibbonPoint {
  t: string;
  /** Bar-derived composite at this bar, −100..+100. */
  score: number;
}

export interface EngineReport {
  symbol: string;
  bias: EngineBias;
  /** Composite conviction, −100 (max short) .. +100 (max long). */
  score: number;
  /** How much the weighted layers agree on the sign, 0..1. */
  agreement: number;
  /** Blend of data coverage and cross-layer agreement, 0..1. */
  confidence: number;
  /** Share of all signals that had data, 0..1. */
  coverage: number;
  layers: EngineLayer[];
  /** Strongest signals agreeing with the bias. */
  drivers: EngineDriver[];
  /** Strongest signals opposing it — the honest counter-read. */
  cautions: EngineDriver[];
  /** The composite recomputed at each bar of the latest session, from the
   *  bar-derived signals — how the read evolved across the day. */
  ribbon: RibbonPoint[];
  asOf: string;
}

export interface EngineInput {
  symbol: string;
  /** Intraday bars (5m is the intended feed), full fetched span, pre/post included. */
  bars: Bar[];
  quote?: VegaQuote | null;
  /** Benchmark quote (SPY) for the relative-strength layer. */
  benchmark?: VegaQuote | null;
  /** Opening-range window in minutes (user setting). */
  orMinutes: number;
  nowIso: string;
}

/* ── Structural constants (aggregation layer) ────────────────────────── */

/** |composite| below this reads as no directional edge. */
const NEUTRAL_DEADBAND = 8;
/** Weight formula floor — even a self-contradicting layer keeps a sliver of
 *  voice so the blend degrades smoothly rather than snapping. */
const AGREEMENT_FLOOR = 0.4;
/** Minimum |weighted impact| for a signal to surface as a driver/caution. */
const DRIVER_CUTOFF = 0.02;
/** Bars needed before the engine will speak at all. */
const MIN_BARS = 30;

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

/* ── Percentile machinery ────────────────────────────────────────────── */

/**
 * Rank `series[i]` against the series' own trailing distribution [0..i]:
 * percentile → 2p−1 ∈ [−1, +1]. The engine's "no hand-tuned thresholds"
 * primitive. Null when the value (or too little history) is missing.
 */
function rankAt(series: (number | null)[], i: number): number | null {
  const v = series[i];
  if (v === null || !Number.isFinite(v)) return null;
  let below = 0;
  let equal = 0;
  let count = 0;
  for (let j = 0; j <= i; j++) {
    const u = series[j];
    if (u === null || !Number.isFinite(u)) continue;
    count++;
    if (u < v) below++;
    else if (u === v) equal++;
  }
  if (count < 10) return null; // too little history to rank against
  const p = (below + (equal - 1) / 2) / (count - 1 || 1);
  return clamp(2 * p - 1, -1, 1);
}

/** Rolling least-squares slope of the last `win` values, per index. */
function rollingSlope(values: number[], win: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = win - 1; i < values.length; i++) {
    let sx = 0,
      sy = 0,
      sxx = 0,
      sxy = 0;
    for (let k = 0; k < win; k++) {
      const yv = values[i - win + 1 + k];
      sx += k;
      sy += yv;
      sxx += k * k;
      sxy += k * yv;
    }
    const denom = win * sxx - sx * sx;
    if (denom !== 0) out[i] = (win * sxy - sx * sy) / denom;
  }
  return out;
}

/* ── Signal builders ─────────────────────────────────────────────────── */

/** A signal whose value exists per bar — rankable and ribbon-able. */
interface BarSignal {
  key: string;
  label: string;
  layer: string;
  /** Per-bar signed score series (already in [−1,1] or null). */
  scores: (number | null)[];
  /** The signal's current read: its most recent defined score within the
   *  latest session. Volume reads shouldn't go dark just because the last
   *  print is a zero-volume post-market bar — but nothing older than the
   *  session ever counts as "current". */
  current: number | null;
  detail: string;
}

/** Index of the last defined value in s at or after `from`; −1 when none. */
function lastIdxIn(s: (number | null)[], from: number): number {
  for (let i = s.length - 1; i >= from; i--) {
    const v = s[i];
    if (v !== null && Number.isFinite(v)) return i;
  }
  return -1;
}

/** A signal that only exists "now" (quote-derived). */
interface SpotSignal {
  key: string;
  label: string;
  layer: string;
  score: number | null;
  detail: string;
}

const fmtPct = (v: number, dp = 1): string => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(dp)}%`;

/**
 * Build every bar-derived signal. Scores at index i use only bars[0..i] —
 * no lookahead — so the ribbon replays what the engine would have said.
 */
function barSignals(bars: Bar[], orMinutes: number): BarSignal[] {
  const n = bars.length;
  const closes = bars.map((b) => b.c);
  const out: BarSignal[] = [];
  const rankSeries = (raw: (number | null)[], idxs?: Set<number>): (number | null)[] => {
    const scores: (number | null)[] = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      if (idxs && !idxs.has(i)) continue;
      scores[i] = rankAt(raw, i);
    }
    return scores;
  };
  // Ribbon indices: only the latest session needs per-bar scores; earlier
  // bars just feed the distributions. The last index is always included.
  const sessions = splitSessions(bars);
  const lastSession = sessions[sessions.length - 1] ?? [];
  const firstOfLast = n - lastSession.length;
  const ribbonIdx = new Set<number>();
  for (let i = Math.max(0, firstOfLast); i < n; i++) ribbonIdx.add(i);
  const sessFrom = Math.max(0, firstOfLast);
  /** Register a signal: current = last defined score within the latest
   *  session; the detail string is rendered at that same index. */
  const add = (
    key: string,
    label: string,
    layer: string,
    scores: (number | null)[],
    detail: (i: number) => string,
    fallback: string
  ): void => {
    const li = lastIdxIn(scores, sessFrom);
    out.push({
      key,
      label,
      layer,
      scores,
      current: li >= 0 ? scores[li] : null,
      detail: li >= 0 ? detail(li) : fallback,
    });
  };

  /* Trend structure */
  const e9 = ema(closes, 9);
  const e20 = ema(closes, 20);
  const spread: (number | null)[] = closes.map((c, i) =>
    e9[i] !== null && e20[i] !== null && c > 0 ? ((e9[i] as number) - (e20[i] as number)) / c : null
  );
  add(
    "emaSpread",
    "9/20 EMA spread",
    "trend",
    rankSeries(spread, ribbonIdx),
    (i) => `${((spread[i] as number) * 10_000).toFixed(0)} bps`,
    "no data"
  );
  const slope = rollingSlope(closes, 20).map((s, i) =>
    s !== null && closes[i] > 0 ? s / closes[i] : null
  );
  add(
    "slope",
    "20-bar price slope",
    "trend",
    rankSeries(slope, ribbonIdx),
    (i) => `${((slope[i] as number) * 10_000).toFixed(1)} bps/bar`,
    "no data"
  );

  /* VWAP posture — σ units are dimensionless by construction, so these map
     directly instead of re-ranking. */
  const vw = sessionVwap(bars);
  const vwapZ: (number | null)[] = bars.map((b, i) => {
    const v = vw.vwap[i];
    const u = vw.upper1[i];
    if (v === null || u === null || u <= v) return null;
    return (b.c - v) / (u - v);
  });
  const zScores: (number | null)[] = vwapZ.map((z) => (z === null ? null : clamp(z / 2, -1, 1)));
  add(
    "vwapZ",
    "Price vs VWAP",
    "vwap",
    zScores,
    (i) => {
      const z = vwapZ[i] as number;
      return `${z >= 0 ? "+" : ""}${z.toFixed(1)}σ`;
    },
    "no band yet"
  );
  // Running share of the session's RTH bars above VWAP → 2·share − 1.
  const timeAbove: (number | null)[] = new Array(n).fill(null);
  {
    let above = 0;
    let total = 0;
    let idx = 0;
    for (const sess of sessions) {
      above = 0;
      total = 0;
      for (const b of sess) {
        const v = vw.vwap[idx];
        if (inRegularHours(b.t) && v !== null) {
          total++;
          if (b.c > v) above++;
          if (total >= 3) timeAbove[idx] = 2 * (above / total) - 1;
        }
        idx++;
      }
    }
  }
  add(
    "timeAbove",
    "Session time above VWAP",
    "vwap",
    timeAbove,
    (i) => `${Math.round((((timeAbove[i] as number) + 1) / 2) * 100)}% of bars`,
    "no data"
  );

  /* Momentum */
  const r14 = rsi(closes, 14);
  add(
    "rsi",
    "RSI(14)",
    "momentum",
    rankSeries(r14, ribbonIdx),
    (i) => (r14[i] as number).toFixed(0),
    "no data"
  );
  const { hist } = macd(closes);
  add(
    "macdHist",
    "MACD histogram",
    "momentum",
    rankSeries(hist, ribbonIdx),
    (i) => (hist[i] as number).toFixed(2),
    "no data"
  );
  const roc: (number | null)[] = closes.map((c, i) =>
    i >= 10 && closes[i - 10] > 0 ? c / closes[i - 10] - 1 : null
  );
  add(
    "roc",
    "10-bar rate of change",
    "momentum",
    rankSeries(roc, ribbonIdx),
    (i) => fmtPct(roc[i] as number, 2),
    "no data"
  );

  /* Volume pressure — balances are already in [−1,1] by construction. */
  const upDown: (number | null)[] = new Array(n).fill(null);
  const closeLoc: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    let upV = 0,
      dnV = 0,
      locV = 0,
      volSum = 0;
    const from = Math.max(0, i - 29);
    for (let j = from; j <= i; j++) {
      const b = bars[j];
      if (b.v <= 0) continue;
      if (b.c > b.o) upV += b.v;
      else if (b.c < b.o) dnV += b.v;
      if (b.h > b.l && j > i - 20) {
        locV += ((b.c - b.l) / (b.h - b.l)) * b.v;
        volSum += b.v;
      }
    }
    if (upV + dnV > 0 && i >= 9) upDown[i] = (upV - dnV) / (upV + dnV);
    if (volSum > 0 && i >= 9) closeLoc[i] = 2 * (locV / volSum) - 1;
  }
  add(
    "upDownVol",
    "Up/down volume balance",
    "volume",
    upDown,
    (i) => `${Math.round((((upDown[i] as number) + 1) / 2) * 100)}% up-volume`,
    "no data"
  );
  add(
    "closeLoc",
    "Close location in bar",
    "volume",
    closeLoc,
    (i) => `${Math.round((((closeLoc[i] as number) + 1) / 2) * 100)}% of range`,
    "no data"
  );

  /* Range & levels */
  // Position in the running day range (RTH high/low so far) → 2·pos − 1.
  const dayPos: (number | null)[] = new Array(n).fill(null);
  {
    let idx = 0;
    for (const sess of sessions) {
      let hod = -Infinity;
      let lod = Infinity;
      for (const b of sess) {
        if (inRegularHours(b.t)) {
          if (b.h > hod) hod = b.h;
          if (b.l < lod) lod = b.l;
          if (hod > lod) dayPos[idx] = clamp(2 * ((b.c - lod) / (hod - lod)) - 1, -1, 1);
        }
        idx++;
      }
    }
  }
  add(
    "dayPos",
    "Position in day range",
    "levels",
    dayPos,
    (i) => `${Math.round((((dayPos[i] as number) + 1) / 2) * 100)}% of range`,
    "no data"
  );
  // Opening-range status for the LATEST session: ±1 broken out/down, a damped
  // fractional read while still inside (inside-the-range info is weak).
  const orScores: (number | null)[] = new Array(n).fill(null);
  {
    const lastBars = bars.slice(firstOfLast);
    const or = openingRange(lastBars, orMinutes);
    if (or && or.complete && or.high > or.low) {
      for (let i = firstOfLast; i < n; i++) {
        const b = bars[i];
        if (!inRegularHours(b.t) || minutesSinceOpen(b.t) < orMinutes) continue;
        if (b.c > or.high) orScores[i] = 1;
        else if (b.c < or.low) orScores[i] = -1;
        else orScores[i] = 0.4 * (2 * ((b.c - or.low) / (or.high - or.low)) - 1);
      }
    }
  }
  add(
    "orStatus",
    "Opening-range status",
    "levels",
    orScores,
    (i) => {
      const v = orScores[i] as number;
      return v >= 1 ? "broke above" : v <= -1 ? "broke below" : "inside range";
    },
    "range forming"
  );
  // Side of the floor pivot, in ATR units (self-scaled).
  const pivotScores: (number | null)[] = new Array(n).fill(null);
  {
    const prior = priorDayFromIntraday(bars);
    const a14 = atr(bars, 14);
    if (prior) {
      const piv = floorPivots(prior.high, prior.low, prior.close);
      for (let i = firstOfLast; i < n; i++) {
        const a = a14[i];
        if (a === null || a <= 0) continue;
        pivotScores[i] = clamp((bars[i].c - piv.p) / (3 * a), -1, 1);
      }
    }
  }
  add(
    "pivotSide",
    "Side of daily pivot",
    "levels",
    pivotScores,
    (i) => ((pivotScores[i] as number) >= 0 ? "above pivot" : "below pivot"),
    "no prior session"
  );

  /* Extension guard — contrarian: stretched moves score AGAINST their own
     direction. Zero inside normal bounds (a defined "no warning"). */
  const stretch: (number | null)[] = vwapZ.map((z) => {
    if (z === null) return null;
    const excess = Math.abs(z) - 2;
    return excess > 0 ? -Math.sign(z) * clamp(excess, 0, 1) : 0;
  });
  add(
    "vwapStretch",
    "VWAP band stretch",
    "extension",
    stretch,
    (i) => {
      const z = vwapZ[i] as number;
      return Math.abs(z) > 2 ? `beyond ${z > 0 ? "+" : "−"}2σ` : "inside bands";
    },
    "no band yet"
  );
  const rsiExtreme: (number | null)[] = new Array(n).fill(null);
  for (const i of ribbonIdx) {
    const ranked = rankAt(r14, i); // −1..+1 percentile of RSI in its own history
    if (ranked === null) continue;
    const p = (ranked + 1) / 2;
    rsiExtreme[i] = p > 0.9 ? -((p - 0.9) / 0.1) : p < 0.1 ? (0.1 - p) / 0.1 : 0;
  }
  add(
    "rsiExtreme",
    "RSI extreme decile",
    "extension",
    rsiExtreme,
    (i) => {
      const v = rsiExtreme[i] as number;
      return v !== 0 ? (v < 0 ? "overbought decile" : "oversold decile") : "normal range";
    },
    "no data"
  );

  /* Volume pace vs prior sessions at the same minute-of-day, signed by the
     current session's own direction (heavy tape confirms, thin tape fades). */
  const paceScores: (number | null)[] = new Array(n).fill(null);
  if (sessions.length >= 2) {
    // cum RTH volume keyed by minutes-into-session, per prior session
    const priorCums: Map<number, number>[] = [];
    for (let s = 0; s < sessions.length - 1; s++) {
      const m = new Map<number, number>();
      let cum = 0;
      for (const b of sessions[s]) {
        if (!inRegularHours(b.t)) continue;
        cum += b.v;
        m.set(minutesSinceOpen(b.t), cum);
      }
      if (m.size > 0) priorCums.push(m);
    }
    if (priorCums.length > 0) {
      let cum = 0;
      let sessOpen: number | null = null;
      for (let i = firstOfLast; i < n; i++) {
        const b = bars[i];
        if (!inRegularHours(b.t)) continue;
        if (sessOpen === null) sessOpen = b.o;
        cum += b.v;
        const mins = minutesSinceOpen(b.t);
        let sum = 0;
        let cnt = 0;
        for (const m of priorCums) {
          let best = 0;
          for (const [mm, cv] of m) if (mm <= mins) best = cv;
          if (best > 0) {
            sum += best;
            cnt++;
          }
        }
        if (cnt > 0 && sum > 0 && sessOpen > 0) {
          const ratio = cum / (sum / cnt);
          const dir = Math.sign(b.c - sessOpen);
          paceScores[i] = clamp(dir * (ratio - 1), -1, 1);
        }
      }
    }
  }
  add(
    "volPace",
    "Volume pace vs prior days",
    "volume",
    paceScores,
    (i) =>
      (paceScores[i] as number) >= 0 ? "running hotter than prior days" : "running thinner than prior days",
    "no prior session"
  );

  return out;
}

/** Quote-derived signals — exist only "now", so they score but don't ribbon. */
function spotSignals(
  quote: VegaQuote | null | undefined,
  benchmark: VegaQuote | null | undefined
): SpotSignal[] {
  const out: SpotSignal[] = [];
  const q = quote ?? null;
  const b = benchmark ?? null;
  const inDay = q ? (q.regularPrice ?? q.price) : null;
  const rangePct =
    q && q.dayHigh !== null && q.dayLow !== null && q.price > 0 && q.dayHigh > q.dayLow
      ? (q.dayHigh - q.dayLow) / q.price
      : null;

  /* Relative strength vs the benchmark, normalized by the symbol's own day
     range so the spread is dimensionless (a 0.5% edge means more on a quiet
     tape than a wild one). */
  const norm = Math.max(rangePct ?? 0, 0.002);
  const rsSpread =
    q?.changePct != null && b?.changePct != null ? q.changePct - b.changePct : null;
  out.push({
    key: "rsDay",
    label: "Day change vs benchmark",
    layer: "relstr",
    score: rsSpread !== null ? clamp(rsSpread / norm, -1, 1) : null,
    detail: rsSpread !== null ? `${fmtPct(rsSpread, 2)} vs ${b?.symbol ?? "mkt"}` : "no benchmark",
  });
  const fromOpen = (x: VegaQuote | null): number | null => {
    if (!x || x.open === null || x.open <= 0) return null;
    const p = x.regularPrice ?? x.price;
    return p / x.open - 1;
  };
  const foQ = fromOpen(q);
  const foB = fromOpen(b);
  const rsOpen = foQ !== null && foB !== null ? foQ - foB : null;
  out.push({
    key: "rsOpen",
    label: "Off-the-open vs benchmark",
    layer: "relstr",
    score: rsOpen !== null ? clamp(rsOpen / norm, -1, 1) : null,
    detail: rsOpen !== null ? `${fmtPct(rsOpen, 2)} vs ${b?.symbol ?? "mkt"}` : "no benchmark",
  });

  /* Gap behavior — only speaks on a gap day (a flat open carries no info,
     so the layer honestly reports zero coverage instead of a fake neutral). */
  const gapRaw =
    q && q.open !== null && q.prevClose !== null && q.prevClose > 0
      ? q.open / q.prevClose - 1
      : null;
  const gap = gapRaw !== null && Math.abs(gapRaw) >= 0.0015 ? gapRaw : null;
  let gapHold: number | null = null;
  let gapFill: number | null = null;
  if (gap !== null && q && inDay !== null && q.open !== null && q.prevClose !== null) {
    const gapDir = Math.sign(gap);
    const fo = inDay / q.open - 1;
    // Riding in the gap's direction = continuation; fading it = reversal risk.
    gapHold = clamp(gapDir * (fo / Math.abs(gap)), -1, 1);
    // How much of the gap has been given back (0 = untouched, 1 = filled).
    const fillFrac = clamp((q.open - inDay) / (q.open - q.prevClose), 0, 1);
    gapFill = gapDir * (1 - 2 * fillFrac);
  }
  out.push({
    key: "gapHold",
    label: "Gap continuation",
    layer: "gap",
    score: gapHold,
    detail: gap !== null ? `gap ${fmtPct(gap, 1)}` : "no gap today",
  });
  out.push({
    key: "gapFill",
    label: "Gap fill progress",
    layer: "gap",
    score: gapFill,
    detail:
      gap !== null
        ? gapFill !== null && gapFill * Math.sign(gap) < 0
          ? "gap mostly filled"
          : "gap still open"
        : "no gap today",
  });

  return out;
}

/* ── Layer metadata ──────────────────────────────────────────────────── */

const LAYERS: { key: string; label: string; desc: string }[] = [
  { key: "trend", label: "Trend structure", desc: "EMA alignment and the slope of the tape itself." },
  { key: "vwap", label: "VWAP posture", desc: "Where price lives relative to the session's volume-weighted anchor." },
  { key: "momentum", label: "Momentum", desc: "RSI, MACD impulse and rate of change, ranked against their own day." },
  { key: "volume", label: "Volume pressure", desc: "Who's winning the tape — up-volume share, close location, participation pace." },
  { key: "levels", label: "Range & levels", desc: "Day-range position, opening-range break state, side of the daily pivot." },
  { key: "relstr", label: "Relative strength", desc: "Is it outrunning the index, or just moving with it?" },
  { key: "gap", label: "Gap behavior", desc: "On gap days: is the gap being ridden or faded?" },
  { key: "extension", label: "Extension guard", desc: "Contrarian check — stretched moves score against their own direction." },
];

/* ── The engine ──────────────────────────────────────────────────────── */

/**
 * Run the Edge Engine. Returns null when there aren't enough bars to say
 * anything honest (the page shows its empty state instead of a fake read).
 */
export function edgeEngine(input: EngineInput): EngineReport | null {
  const { bars, quote, benchmark, orMinutes, nowIso } = input;
  if (bars.length < MIN_BARS) return null;
  const n = bars.length;

  const bSignals = barSignals(bars, orMinutes);
  const sSignals = spotSignals(quote, benchmark);

  // Assemble layers: current score per signal + coverage + agreement.
  const layers: EngineLayer[] = LAYERS.map((meta) => {
    const signals: EngineSignal[] = [
      ...bSignals
        .filter((s) => s.layer === meta.key)
        .map((s) => ({ key: s.key, label: s.label, detail: s.detail, score: s.current })),
      ...sSignals
        .filter((s) => s.layer === meta.key)
        .map((s) => ({ key: s.key, label: s.label, detail: s.detail, score: s.score })),
    ];
    const defined = signals.filter((s) => s.score !== null).map((s) => s.score as number);
    const coverage = signals.length > 0 ? defined.length / signals.length : 0;
    const absSum = defined.reduce((a, s) => a + Math.abs(s), 0);
    // Unanimity of sign among the defined signals; all-quiet counts as
    // agreement (they unanimously read "nothing here"). Single-signal layers
    // get a moderate default rather than a free perfect score.
    const agreement =
      defined.length === 0
        ? 0
        : defined.length === 1
          ? 0.75
          : absSum < 0.05
            ? 1
            : Math.abs(defined.reduce((a, s) => a + s, 0)) / absSum;
    const score = defined.length > 0 ? defined.reduce((a, s) => a + s, 0) / defined.length : null;
    return { ...meta, signals, score, coverage, agreement, weight: 0 };
  });

  // Earned weights: coverage × (floor + (1−floor)·agreement), normalized.
  let wSum = 0;
  for (const l of layers) {
    const raw = l.coverage * (AGREEMENT_FLOOR + (1 - AGREEMENT_FLOOR) * l.agreement);
    l.weight = l.score !== null ? raw : 0;
    wSum += l.weight;
  }
  if (wSum <= 0) return null;
  for (const l of layers) l.weight /= wSum;

  const composite = layers.reduce((a, l) => a + l.weight * (l.score ?? 0), 0);
  const score = Math.round(clamp(composite, -1, 1) * 100);
  const bias: EngineBias =
    Math.abs(score) < NEUTRAL_DEADBAND ? "neutral" : score > 0 ? "long" : "short";

  // Cross-layer agreement: |Σ w·s| / Σ w·|s| — 1 when every layer points the
  // same way, →0 when they cancel out.
  const absWeighted = layers.reduce((a, l) => a + l.weight * Math.abs(l.score ?? 0), 0);
  const agreement = absWeighted > 1e-9 ? Math.abs(composite) / absWeighted : 1;
  const allSignals = layers.flatMap((l) => l.signals);
  const coverage =
    allSignals.length > 0
      ? allSignals.filter((s) => s.score !== null).length / allSignals.length
      : 0;
  const confidence = clamp(Math.sqrt(coverage) * (0.35 + 0.65 * agreement), 0, 1);

  // Drivers & cautions: signals weighted by their layer's earned weight.
  const weighted: EngineDriver[] = [];
  for (const l of layers) {
    for (const s of l.signals) {
      if (s.score === null) continue;
      const impact = s.score * l.weight;
      if (Math.abs(impact) >= DRIVER_CUTOFF)
        weighted.push({ label: `${s.label} — ${s.detail}`, layer: l.label, impact });
    }
  }
  const dirSign = score >= 0 ? 1 : -1;
  const drivers = weighted
    .filter((d) => d.impact * dirSign > 0)
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 4);
  const cautions = weighted
    .filter((d) => d.impact * dirSign < 0)
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 3);

  // Ribbon: the bar-derived composite across the latest session, using the
  // same earned layer weights (spot signals can't replay, so their layers
  // simply don't vote here — weights renormalize per bar over what's defined).
  const sessions = splitSessions(bars);
  const lastSession = sessions[sessions.length - 1] ?? [];
  const firstOfLast = n - lastSession.length;
  const layerWeight = new Map(layers.map((l) => [l.key, l.weight]));
  const ribbon: RibbonPoint[] = [];
  for (let i = firstOfLast; i < n; i++) {
    const byLayer = new Map<string, { sum: number; count: number }>();
    for (const s of bSignals) {
      const v = s.scores[i];
      if (v === null) continue;
      const cur = byLayer.get(s.layer) ?? { sum: 0, count: 0 };
      cur.sum += v;
      cur.count++;
      byLayer.set(s.layer, cur);
    }
    let num = 0;
    let den = 0;
    for (const [layer, { sum, count }] of byLayer) {
      const w = layerWeight.get(layer) ?? 0;
      num += w * (sum / count);
      den += w;
    }
    if (den > 0) ribbon.push({ t: bars[i].t, score: Math.round(clamp(num / den, -1, 1) * 100) });
  }

  return {
    symbol: input.symbol,
    bias,
    score,
    agreement,
    confidence,
    coverage,
    layers,
    drivers,
    cautions,
    ribbon,
    asOf: nowIso,
  };
}

/** Conviction band label for a composite score — UI copy, shared so the
 *  cockpit chip and the console header always agree. */
export function convictionLabel(score: number): string {
  const a = Math.abs(score);
  if (a < NEUTRAL_DEADBAND) return "no edge";
  if (a < 25) return "lean";
  if (a < 50) return "moderate";
  if (a < 75) return "strong";
  return "extreme";
}
