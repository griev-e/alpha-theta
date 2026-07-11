import type { Trade } from "./types";

/**
 * The bundled sample journal — an illustrative month of day trades so the
 * journal/analytics/risk pages demonstrate themselves before a real trade is
 * logged. Deterministic values on a relative calendar: trade shapes are a
 * fixed table, dated back from `now` onto weekdays, so the calendar heatmap
 * always looks current. Flagged `isSample` in the store and badged in the UI —
 * synthetic data is never silent.
 */

// [daysAgo-ish index, symbol, side, qty, entry, exit, stop, setup, entry hh:mm, hold min]
const ROWS: [
  number,
  string,
  "long" | "short",
  number,
  number,
  number,
  number,
  string,
  string,
  number,
][] = [
  [1, "NVDA", "long", 60, 172.4, 174.1, 171.5, "ORB", "09:38", 42],
  [1, "SPY", "short", 100, 624.8, 623.9, 625.4, "VWAP reclaim", "10:55", 28],
  [2, "TSLA", "long", 40, 318.2, 316.9, 316.8, "Gap & go", "09:33", 17],
  [2, "AMD", "long", 120, 138.6, 140.2, 137.9, "Breakout", "10:12", 65],
  [3, "META", "long", 25, 712.5, 718.3, 709.8, "Pullback", "11:05", 96],
  [3, "QQQ", "short", 80, 556.2, 557.4, 557.0, "Reversal", "14:20", 33],
  [4, "NVDA", "long", 80, 168.9, 171.6, 167.8, "Trend follow", "09:47", 118],
  [4, "AAPL", "long", 90, 212.3, 211.6, 211.4, "ORB", "09:36", 21],
  [5, "AMZN", "long", 50, 224.1, 226.0, 222.9, "Breakout", "10:31", 74],
  [8, "TSLA", "short", 35, 322.7, 319.4, 324.3, "Reversal", "13:44", 58],
  [8, "SPY", "long", 120, 619.5, 620.4, 618.9, "VWAP reclaim", "11:22", 40],
  [9, "AMD", "long", 150, 135.2, 134.3, 134.4, "Gap & go", "09:34", 14],
  [9, "NVDA", "short", 50, 175.8, 174.5, 176.6, "Scalp", "15:10", 19],
  [10, "META", "long", 20, 705.0, 703.2, 702.5, "Pullback", "10:48", 51],
  [10, "QQQ", "long", 70, 551.8, 553.6, 550.9, "ORB", "09:41", 63],
  [11, "AAPL", "short", 100, 215.6, 214.2, 216.4, "Breakout", "10:05", 47],
  [11, "AMZN", "long", 45, 220.8, 220.1, 219.9, "Trend follow", "13:02", 82],
  [12, "SPY", "long", 150, 616.2, 617.5, 615.5, "VWAP reclaim", "10:19", 55],
  [15, "NVDA", "long", 70, 165.4, 168.2, 164.2, "Gap & go", "09:35", 88],
  [15, "TSLA", "long", 30, 310.9, 309.2, 309.5, "ORB", "09:39", 26],
  [16, "AMD", "short", 100, 141.3, 139.8, 142.1, "Reversal", "14:41", 37],
  [16, "META", "long", 18, 698.4, 701.9, 695.6, "Breakout", "11:37", 104],
  [17, "QQQ", "short", 60, 548.7, 549.9, 549.5, "Scalp", "15:32", 12],
  [17, "AAPL", "long", 80, 209.7, 211.4, 208.8, "Pullback", "10:26", 71],
  [18, "AMZN", "short", 40, 227.5, 226.1, 228.3, "Reversal", "13:15", 44],
  [19, "SPY", "long", 100, 612.4, 611.7, 611.6, "ORB", "09:37", 23],
  [22, "NVDA", "long", 90, 161.8, 164.0, 160.7, "Trend follow", "10:02", 132],
  [22, "TSLA", "short", 25, 306.3, 307.8, 307.5, "Gap & go", "09:42", 16],
  [23, "AMD", "long", 130, 132.5, 133.9, 131.7, "VWAP reclaim", "11:11", 59],
  [24, "META", "short", 15, 694.2, 690.8, 696.0, "Breakout", "10:57", 78],
];

/** Step back `days` weekdays from `from` (skipping Sat/Sun). */
function weekdaysAgo(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) left -= 1;
  }
  return d;
}

export function makeSampleTrades(now: Date = new Date()): Trade[] {
  return ROWS.map((r, i) => {
    const [ago, symbol, side, qty, entry, exit, stop, setup, hhmm, hold] = r;
    const day = weekdaysAgo(now, ago);
    const [hh, mm] = hhmm.split(":").map(Number);
    const entryAt = new Date(day);
    entryAt.setHours(hh, mm, 0, 0);
    const exitAt = new Date(entryAt.getTime() + hold * 60_000);
    return {
      id: `sample_${i}`,
      symbol,
      side,
      qty,
      entry,
      exit,
      stop,
      fees: 1.5,
      entryAt: entryAt.toISOString(),
      exitAt: exitAt.toISOString(),
      setup,
      notes: undefined,
    };
  });
}
