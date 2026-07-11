import { describe, expect, it } from "vitest";
import { atr, bollinger, ema, macd, rsi, sessionVwap, sma, tameWicks, typicalPrice } from "./indicators";
import type { Bar } from "./types";

describe("sma / ema", () => {
  it("computes a simple moving average with null warm-up", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it("seeds the EMA with the SMA and smooths from there", () => {
    const e = ema([2, 4, 6, 8], 2);
    expect(e[0]).toBeNull();
    expect(e[1]).toBe(3); // seed = SMA(2,4)
    // k = 2/3: 6·(2/3) + 3·(1/3) = 5
    expect(e[2]).toBeCloseTo(5, 10);
    expect(e[3]).toBeCloseTo(7, 10);
  });

  it("returns all nulls when the series is shorter than the period", () => {
    expect(ema([1, 2], 5).every((v) => v === null)).toBe(true);
    expect(sma([1, 2], 5).every((v) => v === null)).toBe(true);
  });
});

describe("rsi", () => {
  it("pins at 100 on a straight-up series", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    const r = rsi(closes, 14);
    expect(r[13]).toBeNull(); // warm-up needs period+1 closes
    expect(r[14]).toBe(100);
    expect(r[19]).toBe(100);
  });

  it("reads 50 when average gain equals average loss", () => {
    // Perfect alternation: +1, −1, +1, … → the initial Wilder window holds 7
    // gains and 7 losses, so the first defined value is exactly 50; later
    // values oscillate tightly around it.
    const closes = Array.from({ length: 30 }, (_, i) => 100 + (i % 2));
    const r = rsi(closes, 14);
    expect(r[14]).toBeCloseTo(50, 10);
    expect(r[29]).toBeGreaterThan(44);
    expect(r[29]).toBeLessThan(56);
  });
});

describe("macd", () => {
  it("is ~0 on a flat series and positive in an uptrend", () => {
    const flat = macd(new Array(60).fill(50));
    expect(flat.macd[59]).toBeCloseTo(0, 10);
    expect(flat.hist[59]).toBeCloseTo(0, 10);
    const up = macd(Array.from({ length: 60 }, (_, i) => 100 * Math.pow(1.01, i)));
    expect(up.macd[59]).toBeGreaterThan(0);
  });

  it("aligns signal/hist to the source index", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 5);
    const { macd: line, signal, hist } = macd(closes);
    expect(line).toHaveLength(60);
    expect(signal).toHaveLength(60);
    for (let i = 0; i < 60; i++) {
      if (hist[i] !== null) {
        expect(hist[i]).toBeCloseTo((line[i] as number) - (signal[i] as number), 10);
      }
    }
  });
});

describe("bollinger", () => {
  it("collapses to the mid on a constant series and stays symmetric", () => {
    const flat = bollinger(new Array(25).fill(10), 20, 2);
    expect(flat.mid[24]).toBe(10);
    expect(flat.upper[24]).toBe(10);
    expect(flat.lower[24]).toBe(10);
    const closes = Array.from({ length: 30 }, (_, i) => 100 + (i % 5));
    const b = bollinger(closes, 20, 2);
    const i = 29;
    expect((b.upper[i] as number) - (b.mid[i] as number)).toBeCloseTo(
      (b.mid[i] as number) - (b.lower[i] as number),
      10
    );
  });
});

describe("atr", () => {
  it("equals the constant bar range when bars never gap", () => {
    const bars: Bar[] = Array.from({ length: 30 }, (_, i) => ({
      t: `2026-01-15T${String(10 + Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z`,
      o: 100,
      h: 101,
      l: 99,
      c: 100,
      v: 1000,
    }));
    const a = atr(bars, 14);
    expect(a[13]).toBeNull();
    expect(a[14]).toBeCloseTo(2, 10);
    expect(a[29]).toBeCloseTo(2, 10);
  });
});

describe("sessionVwap", () => {
  // 09:30 EST = 14:30Z in January.
  const b = (min: number, price: number, v: number): Bar => ({
    t: new Date(Date.UTC(2026, 0, 15, 14, 30 + min)).toISOString(),
    o: price,
    h: price,
    l: price,
    c: price,
    v,
  });

  it("is the volume-weighted mean of typical price", () => {
    const bars = [b(0, 100, 100), b(1, 110, 300)];
    const { vwap } = sessionVwap(bars);
    expect(vwap[0]).toBeCloseTo(100, 10);
    expect(vwap[1]).toBeCloseTo((100 * 100 + 110 * 300) / 400, 10);
  });

  it("resets at a new ET session and skips premarket volume", () => {
    const day2pre: Bar = { ...b(0, 500, 1000), t: "2026-01-16T13:00:00Z" }; // 08:00 ET
    const day2open: Bar = { ...b(0, 200, 100), t: "2026-01-16T14:30:00Z" };
    const { vwap } = sessionVwap([b(0, 100, 100), day2pre, day2open]);
    expect(vwap[0]).toBeCloseTo(100, 10);
    expect(vwap[1]).toBeNull(); // new session, no RTH volume yet
    expect(vwap[2]).toBeCloseTo(200, 10); // premarket 500-print never contributed
  });

  it("bands straddle the vwap symmetrically", () => {
    const bars = [b(0, 100, 100), b(1, 110, 100), b(2, 90, 100)];
    const r = sessionVwap(bars);
    const i = 2;
    expect((r.upper1[i] as number) - (r.vwap[i] as number)).toBeCloseTo(
      (r.vwap[i] as number) - (r.lower1[i] as number),
      10
    );
    expect((r.upper2[i] as number) - (r.vwap[i] as number)).toBeCloseTo(
      2 * ((r.upper1[i] as number) - (r.vwap[i] as number)),
      10
    );
  });

  it("typicalPrice averages H/L/C", () => {
    expect(typicalPrice({ t: "", o: 0, h: 12, l: 6, c: 9, v: 0 })).toBe(9);
  });
});

describe("tameWicks", () => {
  const bar = (i: number, over: Partial<Bar> = {}): Bar => ({
    t: `2026-01-15T14:${String(30 + i).padStart(2, "0")}:00Z`,
    o: 100,
    h: 101,
    l: 99,
    c: 100.5,
    v: 1000,
    ...over,
  });

  it("clamps a rogue wick but never touches the body", () => {
    const bars = [bar(0), bar(1), bar(2), bar(3, { h: 160, l: 40 }), bar(4), bar(5)];
    const tamed = tameWicks(bars, 10);
    // Median range is 2 → wicks capped at body ± 20.
    expect(tamed[3].h).toBe(100.5 + 20);
    expect(tamed[3].l).toBe(100 - 20);
    expect(tamed[3].o).toBe(100);
    expect(tamed[3].c).toBe(100.5);
    // Normal bars pass through by reference.
    expect(tamed[0]).toBe(bars[0]);
  });

  it("leaves real (body-driven) moves alone", () => {
    const bars = [bar(0), bar(1), bar(2), bar(3, { o: 100, c: 140, h: 141, l: 99.5 }), bar(4), bar(5)];
    const tamed = tameWicks(bars, 10);
    expect(tamed[3]).toBe(bars[3]); // big candle, small wick — untouched
  });

  it("passes short or flat series through unchanged", () => {
    const short = [bar(0), bar(1)];
    expect(tameWicks(short)).toBe(short);
    const flat = Array.from({ length: 6 }, (_, i) => bar(i, { h: 100, l: 100, o: 100, c: 100 }));
    expect(tameWicks(flat)).toBe(flat);
  });
});
