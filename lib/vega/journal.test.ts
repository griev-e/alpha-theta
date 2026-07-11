import { describe, expect, it } from "vitest";
import {
  closedTrades,
  dailyPnl,
  entryHourKey,
  equityCurve,
  groupStats,
  holdMinutes,
  isClosed,
  journalStats,
  tradePnl,
  tradeR,
  localDayKey,
} from "./journal";
import type { Trade } from "./types";

let seq = 0;
const trade = (over: Partial<Trade>): Trade => ({
  id: `t${seq++}`,
  symbol: "TEST",
  side: "long",
  qty: 100,
  entry: 50,
  exit: 51,
  stop: 49.5,
  entryAt: "2026-01-15T14:35:00.000Z",
  exitAt: "2026-01-15T15:05:00.000Z",
  ...over,
});

describe("per-trade math", () => {
  it("computes long and short P&L with fees", () => {
    expect(tradePnl(trade({ fees: 2 }))).toBe(98); // (51−50)·100 − 2
    expect(tradePnl(trade({ side: "short", entry: 51, exit: 50, stop: 51.5 }))).toBe(100);
    expect(tradePnl(trade({ exit: null }))).toBeNull();
    expect(isClosed(trade({ exit: null }))).toBe(false);
  });

  it("computes the R multiple off the planned stop", () => {
    // Risk = 0.5·100 = $50; P&L = $100 → 2R.
    expect(tradeR(trade({}))).toBeCloseTo(2, 10);
    expect(tradeR(trade({ stop: undefined }))).toBeNull();
  });

  it("computes holding time", () => {
    expect(holdMinutes(trade({}))).toBe(30);
    expect(holdMinutes(trade({ exitAt: null }))).toBeNull();
  });
});

describe("journalStats", () => {
  const trades: Trade[] = [
    trade({ exit: 51, exitAt: "2026-01-12T15:00:00Z" }), // +100
    trade({ exit: 49, exitAt: "2026-01-13T15:00:00Z" }), // −100
    trade({ exit: 48, exitAt: "2026-01-13T16:00:00Z" }), // −200
    trade({ exit: 54, exitAt: "2026-01-14T15:00:00Z" }), // +400
    trade({ exit: null, exitAt: null }), // open — excluded
  ];

  it("aggregates the closed trades only", () => {
    const s = journalStats(trades)!;
    expect(s.count).toBe(4);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(2);
    expect(s.winRate).toBe(0.5);
    expect(s.totalPnl).toBe(200);
    expect(s.avgWin).toBe(250);
    expect(s.avgLoss).toBe(-150);
    expect(s.profitFactor).toBeCloseTo(500 / 300, 10);
    expect(s.expectancy).toBe(50);
    expect(s.best).toBe(400);
    expect(s.worst).toBe(-200);
    expect(s.longestLossStreak).toBe(2);
    expect(s.longestWinStreak).toBe(1);
    expect(s.streak).toBe(1); // last trade won
    expect(s.stopDiscipline).toBe(1);
    // Drawdown: peak +100 → trough −200 ⇒ −300.
    expect(s.maxDrawdown).toBe(-300);
  });

  it("returns null with no closed trades", () => {
    expect(journalStats([trade({ exit: null })])).toBeNull();
    expect(journalStats([])).toBeNull();
  });
});

describe("equity curve & daily buckets", () => {
  it("orders by exit time and tracks drawdown", () => {
    const curve = equityCurve([
      trade({ exit: 49, exitAt: "2026-01-13T15:00:00Z" }), // listed first…
      trade({ exit: 51, exitAt: "2026-01-12T15:00:00Z" }), // …but exits earlier
    ]);
    expect(curve.map((p) => p.equity)).toEqual([100, 0]);
    expect(curve[1].drawdown).toBe(-100);
  });

  it("buckets realized P&L by exit day", () => {
    const daily = dailyPnl([
      trade({ exit: 51, exitAt: "2026-01-13T15:00:00Z" }),
      trade({ exit: 49, exitAt: "2026-01-13T20:00:00Z" }),
      trade({ exit: 52, exitAt: "2026-01-14T15:00:00Z" }),
    ]);
    expect(daily.get("2026-01-13")).toBe(0);
    expect(daily.get("2026-01-14")).toBe(200);
  });
});

describe("groupings", () => {
  it("breaks results down by an arbitrary key", () => {
    const rows = groupStats(
      [
        trade({ setup: "ORB", exit: 52 }),
        trade({ setup: "ORB", exit: 49 }),
        trade({ setup: "Scalp", exit: 51 }),
      ],
      (t) => t.setup ?? "—"
    );
    const orb = rows.find((r) => r.key === "ORB")!;
    expect(orb.count).toBe(2);
    expect(orb.pnl).toBe(100);
    expect(orb.winRate).toBe(0.5);
    expect(rows.find((r) => r.key === "Scalp")!.pnl).toBe(100);
  });

  it("closedTrades sorts by exit; entryHourKey formats", () => {
    const t = trade({});
    expect(closedTrades([t])).toHaveLength(1);
    expect(entryHourKey(t)).toMatch(/^\d{2}$/);
    expect(entryHourKey(trade({ entryAt: "garbage" }))).toBe("—");
  });
});

describe("localDayKey / dailyPnl day bucketing", () => {
  it("buckets by the trader's LOCAL calendar day, not the UTC slice", () => {
    // 20:30 local on Jan 15 — build the ISO from a local-time Date so the
    // assertion holds in any timezone the suite runs in.
    const eveningLocal = new Date(2026, 0, 15, 20, 30).toISOString();
    expect(localDayKey(eveningLocal)).toBe("2026-01-15");
  });

  it("dailyPnl keys match the cockpit's local todayKey convention", () => {
    const exitAt = new Date(2026, 0, 15, 20, 30).toISOString();
    const trades = [
      {
        id: "t1", symbol: "SPY", side: "long" as const, qty: 10,
        entry: 100, exit: 99, entryAt: new Date(2026, 0, 15, 10, 0).toISOString(), exitAt,
      },
    ];
    const daily = dailyPnl(trades);
    expect(daily.get("2026-01-15")).toBe(-10);
    // The UTC slice of a late-evening exit may be the NEXT day in western
    // timezones — that key must not appear.
    for (const key of daily.keys()) expect(key).toBe("2026-01-15");
  });
});
