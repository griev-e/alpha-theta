import { describe, expect, it } from "vitest";
import { markOpenBook, markPosition, openTrades } from "./positions";
import type { Trade, VegaQuote } from "./types";

let seq = 0;
const trade = (over: Partial<Trade>): Trade => ({
  id: `t${seq++}`,
  symbol: "NVDA",
  side: "long",
  qty: 100,
  entry: 100,
  exit: null,
  stop: 98,
  target: 106,
  entryAt: "2026-01-15T14:35:00.000Z",
  exitAt: null,
  ...over,
});

const quote = (symbol: string, price: number): VegaQuote => ({
  symbol,
  name: null,
  price,
  regularPrice: price,
  prevClose: null,
  open: null,
  dayHigh: null,
  dayLow: null,
  volume: null,
  avgVolume10d: null,
  avgVolume3m: null,
  marketState: "REGULAR",
  changePct: null,
  high52w: null,
  low52w: null,
  asOf: "2026-01-15T15:00:00.000Z",
});

describe("markPosition", () => {
  it("marks a long against the live quote", () => {
    const p = markPosition(trade({}), quote("NVDA", 103));
    expect(p.unrealized).toBe(300); // (103−100)·100
    expect(p.unrealizedR).toBeCloseTo(1.5, 10); // risk = 2·100 = 200
    expect(p.movePct).toBeCloseTo(0.03, 10);
    expect(p.riskToStop).toBe(500); // (103−98)·100 still at risk
    expect(p.stopDistancePct).toBeCloseTo(5 / 103, 10);
    expect(p.targetProgress).toBeCloseTo(0.5, 10); // 3 of 6 points to target
  });

  it("marks a short with inverted direction", () => {
    const p = markPosition(
      trade({ side: "short", entry: 100, stop: 102, target: 96 }),
      quote("NVDA", 98)
    );
    expect(p.unrealized).toBe(200);
    expect(p.movePct).toBeCloseTo(0.02, 10);
    expect(p.riskToStop).toBe(400); // (102−98)·100
    expect(p.targetProgress).toBeCloseTo(0.5, 10);
  });

  it("clamps risk-to-stop at zero once the stop locks in a gain", () => {
    const p = markPosition(trade({ stop: 101 }), quote("NVDA", 99));
    // Long marked BELOW a raised stop — the stop is breached, nothing left.
    expect(p.riskToStop).toBe(0);
    expect(p.stopDistancePct).toBeLessThan(0);
  });

  it("returns null marks with no quote — never imputes", () => {
    const p = markPosition(trade({}), undefined);
    expect(p.last).toBeNull();
    expect(p.unrealized).toBeNull();
    expect(p.unrealizedR).toBeNull();
    expect(p.riskToStop).toBeNull();
  });

  it("handles a trade without stop or target", () => {
    const p = markPosition(trade({ stop: undefined, target: undefined }), quote("NVDA", 103));
    expect(p.unrealized).toBe(300);
    expect(p.unrealizedR).toBeNull();
    expect(p.riskToStop).toBeNull();
    expect(p.targetProgress).toBeNull();
  });
});

describe("markOpenBook", () => {
  it("totals the working book and counts coverage gaps", () => {
    const trades = [
      trade({}), // NVDA long, priced
      trade({ symbol: "TSLA", qty: 10, entry: 300, stop: 295 }), // unpriced
      trade({ symbol: "NVDA", exit: 105, exitAt: "2026-01-15T15:00:00Z" }), // closed — excluded
      trade({ symbol: "SPY", qty: 50, entry: 600, stop: undefined }), // priced, no stop
    ];
    const quotes = { NVDA: quote("NVDA", 103), SPY: quote("SPY", 602) };
    const book = markOpenBook(trades, quotes);
    expect(book.count).toBe(3);
    expect(book.unpriced).toBe(1);
    expect(book.noStop).toBe(1);
    expect(book.unrealized).toBe(300 + 100); // NVDA +300, SPY +100
    expect(book.riskToStop).toBe(500); // only NVDA has a priced stop
    expect(book.notional).toBe(103 * 100 + 602 * 50);
    expect(openTrades(trades)).toHaveLength(3);
  });

  it("reports null unrealized when nothing is priced", () => {
    const book = markOpenBook([trade({})], {});
    expect(book.unrealized).toBeNull();
    expect(book.unpriced).toBe(1);
  });
});
