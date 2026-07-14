import { tradePnl } from "./journal";
import type { Bar, Trade } from "./types";

/**
 * Trade markers — where the journal's fills land on the chart's tape. Pure
 * mapping from trade timestamps to bar indices; a fill outside the displayed
 * span simply doesn't mark (no clamping a Tuesday entry onto Wednesday's
 * open). The chart renders these as entry/exit arrows with a connector.
 */

export interface TradeMarker {
  trade: Trade;
  /** Index of the bar containing the entry, or null if off-tape. */
  entryIdx: number | null;
  entryPrice: number;
  /** Index of the bar containing the exit; null while open or off-tape. */
  exitIdx: number | null;
  exitPrice: number | null;
  side: Trade["side"];
  /** Realized P&L when closed — colors the connector. Null while open. */
  pnl: number | null;
}

const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1d": 24 * 60 * 60_000,
};

/**
 * Index of the bar whose [open, open + interval) window contains `iso`, via
 * binary search (bars are time-ordered). Null when the timestamp falls before
 * the first bar or after the last bar's window — off the displayed tape.
 */
export function barIndexAt(bars: Bar[], iso: string, intervalMs: number): number | null {
  if (bars.length === 0) return null;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return null;
  if (ts < Date.parse(bars[0].t)) return null;
  let lo = 0;
  let hi = bars.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (Date.parse(bars[mid].t) <= ts) lo = mid;
    else hi = mid - 1;
  }
  // Bars can gap (halts, session breaks) — accept a fill inside the bar's own
  // window; a timestamp in a gap between bars stays unmarked.
  return ts < Date.parse(bars[lo].t) + intervalMs ? lo : null;
}

/**
 * Markers for `symbol`'s trades over the displayed bars. Only trades with at
 * least one on-tape fill are returned, newest capped at `max` so a dense
 * journal can't wallpaper the chart.
 */
export function tradeMarkers(
  trades: Trade[],
  symbol: string,
  bars: Bar[],
  interval: keyof typeof INTERVAL_MS,
  max = 30
): TradeMarker[] {
  const ms = INTERVAL_MS[interval] ?? 60_000;
  const out: TradeMarker[] = [];
  for (const t of trades) {
    if (t.symbol !== symbol) continue;
    const entryIdx = barIndexAt(bars, t.entryAt, ms);
    const exitIdx =
      t.exit !== null && t.exit !== undefined && t.exitAt
        ? barIndexAt(bars, t.exitAt, ms)
        : null;
    if (entryIdx === null && exitIdx === null) continue;
    out.push({
      trade: t,
      entryIdx,
      entryPrice: t.entry,
      exitIdx,
      exitPrice: t.exit ?? null,
      side: t.side,
      pnl: tradePnl(t),
    });
    if (out.length >= max) break;
  }
  return out;
}
