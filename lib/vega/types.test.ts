import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  DEFAULT_WATCHLIST,
  EMPTY_VEGA_STATE,
  migrateVegaState,
  WATCHLIST_MAX,
} from "./types";

describe("migrateVegaState", () => {
  it("rejects non-objects", () => {
    expect(migrateVegaState(null)).toBeNull();
    expect(migrateVegaState("nope")).toBeNull();
    expect(migrateVegaState(42)).toBeNull();
  });

  it("passes a well-formed state through intact", () => {
    const s = migrateVegaState({
      v: 1,
      watchlist: ["nvda", "SPY"],
      focus: "nvda",
      trades: [
        {
          id: "t1",
          symbol: "nvda",
          side: "short",
          qty: 10,
          entry: 100,
          exit: 98,
          stop: 101,
          entryAt: "2026-01-15T14:35:00Z",
          exitAt: "2026-01-15T15:00:00Z",
          setup: "ORB",
        },
      ],
      settings: { accountSize: 40_000, riskPct: 0.5, dailyLossPct: 2, orMinutes: 30 },
    })!;
    expect(s.watchlist).toEqual(["NVDA", "SPY"]);
    expect(s.focus).toBe("NVDA");
    expect(s.trades).toHaveLength(1);
    expect(s.trades[0].symbol).toBe("NVDA");
    expect(s.trades[0].side).toBe("short");
    expect(s.settings.accountSize).toBe(40_000);
    expect(s.settings.orMinutes).toBe(30);
  });

  it("repairs a damaged blob instead of voiding it", () => {
    const s = migrateVegaState({
      watchlist: ["SPY", "SPY", 3, "QQQ"],
      trades: [
        { id: "ok", symbol: "SPY", side: "long", qty: 1, entry: 10, entryAt: "2026-01-15T14:35:00Z" },
        { id: "bad", symbol: "SPY", qty: -5, entry: 10, entryAt: "2026-01-15T14:35:00Z" },
        "garbage",
      ],
      settings: { accountSize: -1, riskPct: 99, dailyLossPct: 0, orMinutes: 2 },
    })!;
    expect(s.watchlist).toEqual(["SPY", "QQQ"]); // deduped, strings only
    expect(s.trades).toHaveLength(1); // the bad rows dropped, the good one kept
    expect(s.trades[0].exit).toBeNull(); // open position normalized
    expect(s.settings).toEqual(DEFAULT_SETTINGS); // out-of-band values reset
  });

  it("upgrades a v1 blob (no alerts) to v2 with an empty alert list", () => {
    const s = migrateVegaState({ v: 1, watchlist: ["SPY"], focus: "SPY", trades: [] })!;
    expect(s.v).toBe(2);
    expect(s.alerts).toEqual([]);
  });

  it("repairs alerts: bad rows drop, direction defaults, cap applies", () => {
    const s = migrateVegaState({
      v: 2,
      alerts: [
        { id: "a1", symbol: "nvda", price: 120, dir: "below", createdAt: "2026-01-16T14:00:00Z" },
        { id: "a2", symbol: "SPY", price: 500, dir: "sideways", createdAt: "2026-01-16T14:00:00Z", firedAt: "2026-01-16T15:00:00Z" },
        { id: "bad", symbol: "SPY", price: -5, createdAt: "2026-01-16T14:00:00Z" },
        "garbage",
      ],
    })!;
    expect(s.alerts).toHaveLength(2);
    expect(s.alerts[0]).toMatchObject({ symbol: "NVDA", dir: "below", firedAt: null });
    expect(s.alerts[1]).toMatchObject({ dir: "above", firedAt: "2026-01-16T15:00:00Z" });
  });

  it("caps the watchlist and falls back to the defaults when empty", () => {
    const long = migrateVegaState({
      watchlist: Array.from({ length: 60 }, (_, i) => `S${i}`),
    })!;
    expect(long.watchlist).toHaveLength(WATCHLIST_MAX);
    const empty = migrateVegaState({ watchlist: [] })!;
    expect(empty.watchlist).toEqual([...DEFAULT_WATCHLIST]);
    expect(empty.focus).toBe(EMPTY_VEGA_STATE.focus);
  });
});
