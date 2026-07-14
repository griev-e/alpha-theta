import { describe, expect, it } from "vitest";
import { barIndexAt, tradeMarkers } from "./markers";
import type { Bar, Trade } from "./types";

/** 5m bars starting 2026-01-15T14:30Z (09:30 ET), n of them. */
const bars5m = (n: number): Bar[] =>
  Array.from({ length: n }, (_, i) => ({
    t: new Date(Date.UTC(2026, 0, 15, 14, 30 + i * 5)).toISOString(),
    o: 100,
    h: 101,
    l: 99,
    c: 100.5,
    v: 1000,
  }));

let seq = 0;
const trade = (over: Partial<Trade>): Trade => ({
  id: `t${seq++}`,
  symbol: "NVDA",
  side: "long",
  qty: 100,
  entry: 100,
  exit: 101,
  stop: 99,
  entryAt: "2026-01-15T14:42:00.000Z", // inside bar 2 (14:40–14:45)
  exitAt: "2026-01-15T15:07:00.000Z", // inside bar 7 (15:05–15:10)
  ...over,
});

describe("barIndexAt", () => {
  const bars = bars5m(12);
  const MS = 5 * 60_000;

  it("finds the bar whose window contains the timestamp", () => {
    expect(barIndexAt(bars, "2026-01-15T14:30:00Z", MS)).toBe(0);
    expect(barIndexAt(bars, "2026-01-15T14:42:00Z", MS)).toBe(2);
    expect(barIndexAt(bars, "2026-01-15T14:44:59Z", MS)).toBe(2);
    expect(barIndexAt(bars, "2026-01-15T14:45:00Z", MS)).toBe(3);
  });

  it("returns null off the tape's ends and in gaps", () => {
    expect(barIndexAt(bars, "2026-01-15T14:00:00Z", MS)).toBeNull(); // before
    expect(barIndexAt(bars, "2026-01-15T18:00:00Z", MS)).toBeNull(); // after
    // A halt: remove bars 4–6; a timestamp there falls in the gap.
    const gapped = [...bars.slice(0, 4), ...bars.slice(7)];
    expect(barIndexAt(gapped, "2026-01-15T14:57:00Z", MS)).toBeNull();
    expect(barIndexAt([], "2026-01-15T14:42:00Z", MS)).toBeNull();
    expect(barIndexAt(bars, "garbage", MS)).toBeNull();
  });
});

describe("tradeMarkers", () => {
  const bars = bars5m(12);

  it("maps a round trip's fills onto the tape", () => {
    const [mk] = tradeMarkers([trade({})], "NVDA", bars, "5m");
    expect(mk.entryIdx).toBe(2);
    expect(mk.exitIdx).toBe(7);
    expect(mk.pnl).toBe(100);
  });

  it("keeps an open trade's entry and skips other symbols", () => {
    const marks = tradeMarkers(
      [trade({ exit: null, exitAt: null }), trade({ symbol: "SPY" })],
      "NVDA",
      bars,
      "5m"
    );
    expect(marks).toHaveLength(1);
    expect(marks[0].exitIdx).toBeNull();
    expect(marks[0].pnl).toBeNull();
  });

  it("drops trades entirely off the displayed span and caps the count", () => {
    const off = trade({
      entryAt: "2026-01-10T14:42:00Z",
      exitAt: "2026-01-10T15:07:00Z",
    });
    expect(tradeMarkers([off], "NVDA", bars, "5m")).toHaveLength(0);
    const many = Array.from({ length: 40 }, () => trade({}));
    expect(tradeMarkers(many, "NVDA", bars, "5m", 30)).toHaveLength(30);
  });

  it("keeps a trade whose exit is on-tape even when the entry predates it", () => {
    const [mk] = tradeMarkers(
      [trade({ entryAt: "2026-01-15T13:00:00Z" })],
      "NVDA",
      bars,
      "5m"
    );
    expect(mk.entryIdx).toBeNull();
    expect(mk.exitIdx).toBe(7);
  });
});
