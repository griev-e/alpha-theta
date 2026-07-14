import type { Trade } from "./types";

/**
 * Trade-journal math — the performance ledger behind vega's journal and
 * analytics pages. Pure functions over the trade list; only CLOSED trades
 * (exit price + exit time) enter the statistics, open positions are tracked
 * but never counted as results.
 */

export function isClosed(t: Trade): boolean {
  return t.exit !== null && t.exit !== undefined;
}

/** Realized P&L for a closed trade (fees subtracted); null while open. */
export function tradePnl(t: Trade): number | null {
  if (t.exit === null || t.exit === undefined) return null;
  const dir = t.side === "long" ? 1 : -1;
  return (t.exit - t.entry) * t.qty * dir - (t.fees ?? 0);
}

/** Initial per-share risk implied by the planned stop; null without a stop. */
export function tradeRisk(t: Trade): number | null {
  if (t.stop === undefined || t.stop <= 0) return null;
  const perShare = Math.abs(t.entry - t.stop);
  return perShare > 0 ? perShare * t.qty : null;
}

/** R-multiple: realized P&L over planned risk. The day trader's true unit. */
export function tradeR(t: Trade): number | null {
  const pnl = tradePnl(t);
  const risk = tradeRisk(t);
  return pnl !== null && risk !== null ? pnl / risk : null;
}

/** Holding time in minutes; null while open or with bad timestamps. */
export function holdMinutes(t: Trade): number | null {
  if (!t.exitAt) return null;
  const a = Date.parse(t.entryAt);
  const b = Date.parse(t.exitAt);
  return Number.isFinite(a) && Number.isFinite(b) && b >= a
    ? (b - a) / 60_000
    : null;
}

/** Closed trades in exit order (oldest first) — the stats' spine. */
export function closedTrades(trades: Trade[]): Trade[] {
  return trades
    .filter(isClosed)
    .sort((a, b) => (a.exitAt ?? a.entryAt).localeCompare(b.exitAt ?? b.entryAt));
}

export interface EquityPoint {
  /** Exit timestamp of the trade that produced this equity level. */
  t: string;
  equity: number;
  /** Drawdown from the running peak at this point (≤ 0). */
  drawdown: number;
}

/** Cumulative realized P&L after each closed trade, with running drawdown. */
export function equityCurve(trades: Trade[]): EquityPoint[] {
  let equity = 0;
  let peak = 0;
  const out: EquityPoint[] = [];
  for (const t of closedTrades(trades)) {
    const pnl = tradePnl(t);
    if (pnl === null) continue;
    equity += pnl;
    if (equity > peak) peak = equity;
    out.push({ t: t.exitAt ?? t.entryAt, equity, drawdown: equity - peak });
  }
  return out;
}

export interface JournalStats {
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgWin: number | null;
  avgLoss: number | null;
  /** Gross profit / gross loss. Infinity with no losers. */
  profitFactor: number | null;
  /** Mean P&L per trade — the edge per attempt. */
  expectancy: number;
  /** Mean R-multiple over trades that had a planned stop. */
  avgR: number | null;
  /** Share of trades that carried a stop — plan discipline. */
  stopDiscipline: number;
  maxDrawdown: number;
  best: number | null;
  worst: number | null;
  /** Current streak: positive = consecutive wins, negative = losses. */
  streak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  avgHoldMinutes: number | null;
}

/** Aggregate performance over the closed trades. Null when none exist. */
export function journalStats(trades: Trade[]): JournalStats | null {
  const closed = closedTrades(trades);
  const pnls = closed
    .map(tradePnl)
    .filter((p): p is number => p !== null);
  if (pnls.length === 0) return null;

  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const grossWin = wins.reduce((s, p) => s + p, 0);
  const grossLoss = -losses.reduce((s, p) => s + p, 0);

  let streak = 0;
  let longestWin = 0;
  let longestLoss = 0;
  let run = 0;
  for (const p of pnls) {
    if (p > 0) {
      run = run > 0 ? run + 1 : 1;
      if (run > longestWin) longestWin = run;
    } else if (p < 0) {
      run = run < 0 ? run - 1 : -1;
      if (-run > longestLoss) longestLoss = -run;
    } else {
      run = 0;
    }
    streak = run;
  }

  const rs = closed.map(tradeR).filter((r): r is number => r !== null);
  const holds = closed
    .map(holdMinutes)
    .filter((h): h is number => h !== null);
  const curve = equityCurve(trades);
  const maxDrawdown = curve.reduce((m, p) => Math.min(m, p.drawdown), 0);

  return {
    count: pnls.length,
    wins: wins.length,
    losses: losses.length,
    winRate: wins.length / pnls.length,
    totalPnl: pnls.reduce((s, p) => s + p, 0),
    avgWin: wins.length > 0 ? grossWin / wins.length : null,
    avgLoss: losses.length > 0 ? -grossLoss / losses.length : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : wins.length > 0 ? Infinity : null,
    expectancy: pnls.reduce((s, p) => s + p, 0) / pnls.length,
    avgR: rs.length > 0 ? rs.reduce((s, r) => s + r, 0) / rs.length : null,
    stopDiscipline: closed.length > 0
      ? closed.filter((t) => t.stop !== undefined).length / closed.length
      : 0,
    maxDrawdown,
    best: pnls.length > 0 ? Math.max(...pnls) : null,
    worst: pnls.length > 0 ? Math.min(...pnls) : null,
    streak,
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
    avgHoldMinutes: holds.length > 0 ? holds.reduce((s, h) => s + h, 0) / holds.length : null,
  };
}

/** LOCAL calendar-day key ("YYYY-MM-DD") for an ISO timestamp — the same
 *  wall-clock day the trader (and every UI consumer: the cockpit's daily
 *  circuit breaker, the risk page, the P&L calendar) lives in. Bucketing by
 *  the raw UTC slice would file a 20:30 ET exit under tomorrow. */
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Realized P&L bucketed by LOCAL calendar day of the exit. */
export function dailyPnl(trades: Trade[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of closedTrades(trades)) {
    const pnl = tradePnl(t);
    if (pnl === null) continue;
    const day = localDayKey(t.exitAt ?? t.entryAt);
    out.set(day, (out.get(day) ?? 0) + pnl);
  }
  return out;
}

export interface GroupStat {
  key: string;
  count: number;
  pnl: number;
  winRate: number;
}

/** P&L / win-rate breakdown by an arbitrary key (setup, symbol, hour…). */
export function groupStats(
  trades: Trade[],
  keyOf: (t: Trade) => string
): GroupStat[] {
  const acc = new Map<string, { count: number; pnl: number; wins: number }>();
  for (const t of closedTrades(trades)) {
    const pnl = tradePnl(t);
    if (pnl === null) continue;
    const key = keyOf(t);
    const g = acc.get(key) ?? { count: 0, pnl: 0, wins: 0 };
    g.count += 1;
    g.pnl += pnl;
    if (pnl > 0) g.wins += 1;
    acc.set(key, g);
  }
  return [...acc.entries()]
    .map(([key, g]) => ({ key, count: g.count, pnl: g.pnl, winRate: g.wins / g.count }))
    .sort((a, b) => b.pnl - a.pnl);
}

/** Entry hour label ("09", "10", …) in the trader's local time. */
export function entryHourKey(t: Trade): string {
  const d = new Date(t.entryAt);
  return Number.isFinite(d.getTime())
    ? String(d.getHours()).padStart(2, "0")
    : "—";
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Entry weekday label ("Mon"…) in the trader's local time. */
export function entryWeekdayKey(t: Trade): string {
  const d = new Date(t.entryAt);
  return Number.isFinite(d.getTime()) ? WEEKDAYS[d.getDay()] : "—";
}

export interface RollingPoint {
  /** Exit timestamp of the trade closing this window. */
  t: string;
  /** Mean P&L per trade over the trailing window ending here. */
  expectancy: number;
  /** Win rate over the same window. */
  winRate: number;
}

/**
 * Trailing-window expectancy after each closed trade — the edge's drift over
 * time, which the all-time aggregate hides. Windows shorter than `window`
 * (the first trades) use what exists so the series starts at trade one.
 */
export function rollingExpectancy(trades: Trade[], window = 20): RollingPoint[] {
  const closed = closedTrades(trades);
  const out: RollingPoint[] = [];
  const pnls: number[] = [];
  for (const t of closed) {
    const pnl = tradePnl(t);
    if (pnl === null) continue;
    pnls.push(pnl);
    const win = pnls.slice(-window);
    out.push({
      t: t.exitAt ?? t.entryAt,
      expectancy: win.reduce((s, p) => s + p, 0) / win.length,
      winRate: win.filter((p) => p > 0).length / win.length,
    });
  }
  return out;
}

export interface FeeStats {
  /** Total commissions/fees across closed trades. */
  fees: number;
  /** Mean fee per closed trade. */
  perTrade: number;
  /** Share of gross wins consumed by costs; null with no gross wins. */
  shareOfGrossWins: number | null;
}

/** What the round trips actually cost — journal P&L is already net of fees,
 *  so this surfaces the drag that netting hides. */
export function feeStats(trades: Trade[]): FeeStats | null {
  const closed = closedTrades(trades);
  if (closed.length === 0) return null;
  const fees = closed.reduce((s, t) => s + (t.fees ?? 0), 0);
  const grossWins = closed
    .map((t) => {
      const pnl = tradePnl(t);
      return pnl === null ? 0 : Math.max(0, pnl + (t.fees ?? 0));
    })
    .reduce((s, p) => s + p, 0);
  return {
    fees,
    perTrade: fees / closed.length,
    shareOfGrossWins: grossWins > 0 ? fees / grossWins : null,
  };
}
