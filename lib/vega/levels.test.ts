import { describe, expect, it } from "vitest";
import {
  floorPivots,
  openingRange,
  premarketRange,
  priorDayFromDaily,
  priorDayFromIntraday,
  swingLevels,
} from "./levels";
import type { Bar } from "./types";

const mk = (t: string, o: number, h: number, l: number, c: number, v = 1000): Bar => ({
  t,
  o,
  h,
  l,
  c,
  v,
});

describe("floorPivots", () => {
  it("computes the classic floor-trader set", () => {
    const p = floorPivots(110, 90, 100);
    expect(p.p).toBe(100);
    expect(p.r1).toBe(110); // 2·100 − 90
    expect(p.s1).toBe(90); // 2·100 − 110
    expect(p.r2).toBe(120); // 100 + 20
    expect(p.s2).toBe(80);
    expect(p.r3).toBe(130); // 110 + 2·(100−90)
    expect(p.s3).toBe(70); // 90 − 2·(110−100)
  });
});

describe("prior day", () => {
  it("reads the second-to-last daily bar", () => {
    const daily = [
      mk("2026-01-13T00:00:00Z", 1, 105, 95, 100),
      mk("2026-01-14T00:00:00Z", 1, 112, 98, 110),
      mk("2026-01-15T00:00:00Z", 1, 120, 108, 118), // live day
    ];
    expect(priorDayFromDaily(daily)).toEqual({ high: 112, low: 98, close: 110 });
    expect(priorDayFromDaily(daily.slice(0, 1))).toBeNull();
  });

  it("derives the prior session from intraday bars, RTH only", () => {
    const bars = [
      mk("2026-01-14T14:30:00Z", 100, 106, 99, 105), // prior day RTH
      mk("2026-01-14T15:30:00Z", 105, 108, 104, 107),
      mk("2026-01-14T22:00:00Z", 107, 150, 107, 149), // after-hours spike — excluded
      mk("2026-01-15T14:30:00Z", 110, 111, 109, 110), // today
    ];
    expect(priorDayFromIntraday(bars)).toEqual({ high: 108, low: 99, close: 107 });
    expect(priorDayFromIntraday(bars.slice(3))).toBeNull();
  });
});

describe("openingRange", () => {
  // 09:30 EST = 14:30Z.
  const bars = [
    mk("2026-01-15T14:30:00Z", 100, 102, 99, 101),
    mk("2026-01-15T14:35:00Z", 101, 103, 100, 102),
    mk("2026-01-15T14:50:00Z", 102, 105, 101, 104), // past a 15-minute window
  ];

  it("spans the first N minutes of the latest session", () => {
    expect(openingRange(bars, 15)).toEqual({ high: 103, low: 99, complete: true });
  });

  it("is incomplete while the window is still forming", () => {
    expect(openingRange(bars.slice(0, 2), 15)).toEqual({
      high: 103,
      low: 99,
      complete: false,
    });
  });

  it("is null before the open", () => {
    expect(openingRange([mk("2026-01-15T13:00:00Z", 1, 2, 1, 2)], 15)).toBeNull();
  });
});

describe("premarketRange", () => {
  it("spans only bars before 09:30 ET on the latest day", () => {
    const bars = [
      mk("2026-01-15T12:00:00Z", 100, 104, 98, 103), // 07:00 ET
      mk("2026-01-15T13:30:00Z", 103, 106, 102, 105), // 08:30 ET
      mk("2026-01-15T14:30:00Z", 105, 120, 104, 118), // RTH — excluded
    ];
    expect(premarketRange(bars)).toEqual({ high: 106, low: 98 });
    expect(premarketRange(bars.slice(2))).toBeNull();
  });
});

describe("swingLevels", () => {
  it("finds and clusters repeated swing highs", () => {
    // Two rallies stalling at ~110 with a valley at 100 between them.
    const prices = [100, 104, 110, 104, 100, 104, 110.1, 104, 100];
    const bars = prices.map((p, i) =>
      mk(`2026-01-15T${String(14 + Math.floor(i / 60)).padStart(2, "0")}:${String((30 + i) % 60).padStart(2, "0")}:00Z`, p, p + 0.5, p - 0.5, p)
    );
    const levels = swingLevels(bars, 2, 6, 0.005);
    const resistance = levels.find((l) => l.kind === "resistance");
    expect(resistance).toBeDefined();
    expect(resistance!.touches).toBe(2);
    expect(resistance!.price).toBeCloseTo(110.55, 1);
  });

  it("returns nothing on a short series", () => {
    expect(swingLevels([mk("2026-01-15T14:30:00Z", 1, 2, 1, 2)], 3)).toEqual([]);
  });
});
