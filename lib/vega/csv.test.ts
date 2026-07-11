import { describe, expect, it } from "vitest";
import { parseTradesCsv, tradesToCsv } from "./csv";
import type { NewTrade } from "./types";

const sample: NewTrade = {
  symbol: "NVDA",
  side: "long",
  qty: 100,
  entry: 170.5,
  exit: 172.25,
  stop: 169.8,
  target: 174,
  fees: 1.5,
  entryAt: "2026-01-15T14:35:00.000Z",
  exitAt: "2026-01-15T15:05:00.000Z",
  setup: "ORB",
  notes: 'Held through the pullback, "textbook"',
};

describe("tradesToCsv / parseTradesCsv", () => {
  it("round-trips a trade, quoted fields included", () => {
    const csv = tradesToCsv([sample]);
    const { trades, skipped } = parseTradesCsv(csv);
    expect(skipped).toBe(0);
    expect(trades).toHaveLength(1);
    expect(trades[0]).toEqual(sample);
  });

  it("accepts aliased headers in any order with $/comma formatting", () => {
    const csv = [
      "Ticker,Direction,Shares,Entry Price,Exit Price,Stop Loss,Opened,Closed,Strategy",
      'TSLA,Short,"1,000",$320.50,$318.25,322.00,2026-01-15T14:45:00Z,2026-01-15T15:10:00Z,Reversal',
    ].join("\n");
    const { trades, skipped } = parseTradesCsv(csv);
    expect(skipped).toBe(0);
    expect(trades[0].symbol).toBe("TSLA");
    expect(trades[0].side).toBe("short");
    expect(trades[0].qty).toBe(1000);
    expect(trades[0].entry).toBe(320.5);
    expect(trades[0].exit).toBe(318.25);
    expect(trades[0].stop).toBe(322);
    expect(trades[0].setup).toBe("Reversal");
  });

  it("treats a missing exit as an open position", () => {
    const csv = ["symbol,side,qty,entry,exit", "AAPL,long,50,210.10,"].join("\n");
    const { trades } = parseTradesCsv(csv);
    expect(trades[0].exit).toBeNull();
    expect(trades[0].exitAt).toBeNull();
  });

  it("skips unusable rows instead of failing the file", () => {
    const csv = [
      "symbol,side,qty,entry",
      "NVDA,long,100,170.5",
      ",long,100,170.5", // no symbol
      "AMD,long,0,140", // zero qty
      "META,long,10,not-a-price",
    ].join("\n");
    const { trades, skipped } = parseTradesCsv(csv);
    expect(trades).toHaveLength(1);
    expect(skipped).toBe(3);
  });

  it("returns nothing without a usable header", () => {
    const { trades, skipped } = parseTradesCsv("a,b,c\n1,2,3");
    expect(trades).toHaveLength(0);
    expect(skipped).toBe(1);
  });
});
