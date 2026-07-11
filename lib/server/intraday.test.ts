import { describe, expect, it } from "vitest";
import { sanitizeVegaSymbols, toBars, toVegaQuote } from "./intraday";

describe("sanitizeVegaSymbols", () => {
  it("keeps index carets and futures/FX suffixes, unlike alpha's sanitizer", () => {
    expect(sanitizeVegaSymbols("spy, ^vix, es=f, brk.b")).toEqual([
      "BRK.B",
      "ES=F",
      "SPY",
      "^VIX",
    ]);
  });

  it("dedupes, strips junk, and caps the list", () => {
    expect(sanitizeVegaSymbols("spy,SPY,$$$,^,=,")).toEqual(["SPY"]);
    expect(sanitizeVegaSymbols(Array.from({ length: 60 }, (_, i) => `S${i}`).join(","), 40)).toHaveLength(40);
    expect(sanitizeVegaSymbols(null)).toEqual([]);
  });
});

describe("toBars", () => {
  it("maps chart rows and drops null/holiday rows", () => {
    const bars = toBars([
      { date: new Date("2026-01-15T14:30:00Z"), open: 100, high: 101, low: 99, close: 100.5, volume: 5000 },
      { date: new Date("2026-01-15T14:31:00Z"), open: null, high: null, low: null, close: null, volume: null },
      { date: "not a date", open: 1, high: 1, low: 1, close: 1, volume: 1 },
      { date: new Date("2026-01-15T14:32:00Z"), open: 100.5, high: 101.2, low: 100.1, close: 101, volume: null },
    ]);
    expect(bars).toHaveLength(2);
    expect(bars[0]).toEqual({
      t: "2026-01-15T14:30:00.000Z",
      o: 100,
      h: 101,
      l: 99,
      c: 100.5,
      v: 5000,
    });
    expect(bars[1].v).toBe(0); // missing volume normalizes to 0, not NaN
  });

  it("drops impossible bars (high below low, non-positive close)", () => {
    expect(
      toBars([
        { date: new Date(), open: 10, high: 9, low: 11, close: 10, volume: 1 },
        { date: new Date(), open: 10, high: 11, low: 9, close: 0, volume: 1 },
      ])
    ).toHaveLength(0);
  });
});

describe("toVegaQuote", () => {
  const base = {
    symbol: "NVDA",
    shortName: "NVIDIA Corporation",
    marketState: "REGULAR",
    regularMarketPrice: 170,
    regularMarketPreviousClose: 165,
    regularMarketOpen: 168,
    regularMarketDayHigh: 171,
    regularMarketDayLow: 167,
    regularMarketVolume: 20_000_000,
    averageDailyVolume10Day: 30_000_000,
    averageDailyVolume3Month: 28_000_000,
    regularMarketTime: new Date("2026-01-15T16:30:00Z"),
    fiftyTwoWeekHigh: 180,
    fiftyTwoWeekLow: 90,
  };

  it("maps a regular-session quote", () => {
    const q = toVegaQuote(base)!;
    expect(q.symbol).toBe("NVDA");
    expect(q.price).toBe(170);
    expect(q.regularPrice).toBe(170);
    expect(q.marketState).toBe("REGULAR");
    expect(q.changePct).toBeCloseTo(170 / 165 - 1, 10);
    expect(q.avgVolume10d).toBe(30_000_000);
    expect(q.asOf).toBe("2026-01-15T16:30:00.000Z");
  });

  it("uses the pre-market print as the price in PRE, change vs prior close", () => {
    const q = toVegaQuote({
      ...base,
      marketState: "PRE",
      preMarketPrice: 173,
      preMarketTime: new Date("2026-01-15T13:00:00Z"),
    })!;
    expect(q.price).toBe(173);
    expect(q.regularPrice).toBe(170); // yesterday's close of the regular tape
    expect(q.marketState).toBe("PRE");
    expect(q.changePct).toBeCloseTo(173 / 165 - 1, 10);
    expect(q.asOf).toBe("2026-01-15T13:00:00.000Z");
  });

  it("uses the post-market print after the close", () => {
    const q = toVegaQuote({ ...base, marketState: "POST", postMarketPrice: 168.5 })!;
    expect(q.price).toBe(168.5);
    expect(q.marketState).toBe("POST");
  });

  it("degrades missing fields to null and rejects unusable rows", () => {
    const q = toVegaQuote({ symbol: "X", regularMarketPrice: 10 })!;
    expect(q.prevClose).toBeNull();
    expect(q.changePct).toBeNull();
    expect(q.open).toBeNull();
    expect(q.volume).toBeNull();
    expect(q.name).toBeNull();
    expect(toVegaQuote({ symbol: "X" })).toBeNull();
    expect(toVegaQuote(null)).toBeNull();
  });
});
