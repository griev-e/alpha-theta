import { describe, expect, it } from "vitest";
import { rankScans, scanQuote, sessionElapsedFraction } from "./scan";
import type { VegaQuote } from "./types";

const quote = (over: Partial<VegaQuote>): VegaQuote => ({
  symbol: "TEST",
  name: "Test Co",
  price: 105,
  regularPrice: 105,
  prevClose: 100,
  open: 102,
  dayHigh: 106,
  dayLow: 101,
  volume: 5_000_000,
  avgVolume10d: 10_000_000,
  avgVolume3m: 12_000_000,
  marketState: "REGULAR",
  changePct: 0.05,
  high52w: 120,
  low52w: 80,
  asOf: "2026-01-15T16:30:00Z",
  ...over,
});

// 11:30 ET = 16:30Z in January → 120 of 390 minutes elapsed.
const NOW = "2026-01-15T16:30:00Z";

describe("sessionElapsedFraction", () => {
  it("pro-rates the regular session and floors premarket", () => {
    expect(sessionElapsedFraction("REGULAR", NOW)).toBeCloseTo(120 / 390, 10);
    expect(sessionElapsedFraction("PRE", NOW)).toBeCloseTo(0.06, 10);
    expect(sessionElapsedFraction("POST", NOW)).toBe(1);
    expect(sessionElapsedFraction("CLOSED", NOW)).toBe(1);
  });
});

describe("scanQuote", () => {
  it("derives gap, rvol, range metrics from one quote", () => {
    const r = scanQuote(quote({}), NOW);
    expect(r.gapPct).toBeCloseTo(0.02, 10); // 102 vs 100
    // rvol = 5M / (10M · 120/390)
    expect(r.rvol).toBeCloseTo(5_000_000 / (10_000_000 * (120 / 390)), 6);
    expect(r.rangePct).toBeCloseTo(5 / 105, 10);
    expect(r.rangePos).toBeCloseTo((105 - 101) / 5, 10);
    expect(r.fromOpenPct).toBeCloseTo(105 / 102 - 1, 10);
  });

  it("tags the notable states", () => {
    const hot = scanQuote(
      quote({ open: 103, regularPrice: 106, price: 106, volume: 30_000_000 }),
      NOW
    );
    expect(hot.tags).toContain("gap ↑");
    expect(hot.tags).toContain("high rvol");
    expect(hot.tags).toContain("at HOD");
    const cold = scanQuote(quote({ open: 97.5, regularPrice: 101 }), NOW);
    expect(cold.tags).toContain("gap ↓");
    expect(cold.tags).toContain("at LOD");
  });

  it("degrades to nulls instead of guessing when fields are missing", () => {
    const r = scanQuote(
      quote({ open: null, volume: null, dayHigh: null, dayLow: null }),
      NOW
    );
    expect(r.gapPct).toBeNull();
    expect(r.rvol).toBeNull();
    expect(r.rangePct).toBeNull();
    expect(r.rangePos).toBeNull();
    expect(r.fromOpenPct).toBeNull();
    expect(r.tags).toEqual([]);
  });

  it("clamps range position for an extended-hours print outside the range", () => {
    const r = scanQuote(quote({ marketState: "POST", price: 110, regularPrice: 106 }), NOW);
    expect(r.rangePos).toBe(1);
  });
});

describe("rankScans", () => {
  it("scores the clearly-hotter symbol higher", () => {
    const hot = scanQuote(
      quote({ symbol: "HOT", open: 105, regularPrice: 106, volume: 40_000_000 }),
      NOW
    );
    const quiet = scanQuote(
      quote({
        symbol: "QUIET",
        open: 100.1,
        regularPrice: 100.2,
        price: 100.2,
        dayHigh: 100.5,
        dayLow: 99.9,
        volume: 1_000_000,
      }),
      NOW
    );
    const ranked = rankScans([quiet, hot]);
    const h = ranked.find((r) => r.symbol === "HOT")!;
    const q = ranked.find((r) => r.symbol === "QUIET")!;
    expect(h.score).toBeGreaterThan(q.score as number);
    expect(h.score).toBe(100);
    expect(q.score).toBe(0);
  });

  it("leaves a metric-less symbol unscored", () => {
    const empty = scanQuote(
      quote({
        symbol: "NA",
        open: null,
        prevClose: null,
        volume: null,
        dayHigh: null,
        dayLow: null,
      }),
      NOW
    );
    const ranked = rankScans([empty]);
    expect(ranked[0].score).toBeNull();
  });
});
