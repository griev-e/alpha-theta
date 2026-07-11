import { describe, expect, it } from "vitest";
import { convictionLabel, edgeEngine, type EngineInput } from "./engine";
import type { Bar, VegaQuote } from "./types";

/**
 * Synthetic sessions: 5m RTH bars. In January, 09:30 ET = 14:30 UTC (EST),
 * so a full regular session is 78 bars from 14:30Z to 20:55Z.
 */
function session(
  day: string,
  price: (i: number) => { o: number; c: number },
  vol: (i: number) => number = () => 100_000,
  count = 78
): Bar[] {
  return Array.from({ length: count }, (_, i) => {
    const utcMin = 14 * 60 + 30 + i * 5;
    const h = String(Math.floor(utcMin / 60)).padStart(2, "0");
    const m = String(utcMin % 60).padStart(2, "0");
    const { o, c } = price(i);
    return {
      t: `${day}T${h}:${m}:00.000Z`,
      o,
      c,
      h: Math.max(o, c) + 0.03,
      l: Math.min(o, c) - 0.03,
      v: vol(i),
    };
  });
}

const up = (base: number, step: number) => (i: number) => ({
  o: base + i * step,
  c: base + (i + 1) * step,
});
const down = (base: number, step: number) => (i: number) => ({
  o: base - i * step,
  c: base - (i + 1) * step,
});
const flat = (base: number) => (i: number) => ({
  o: base + (i % 2 === 0 ? 0.02 : -0.02),
  c: base + (i % 2 === 0 ? -0.02 : 0.02),
});

function quote(over: Partial<VegaQuote> = {}): VegaQuote {
  return {
    symbol: "TEST",
    name: "Test Co",
    price: 110,
    regularPrice: 110,
    prevClose: 100,
    open: 101,
    dayHigh: 111,
    dayLow: 100.5,
    volume: 5_000_000,
    avgVolume10d: 4_000_000,
    avgVolume3m: 4_000_000,
    marketState: "REGULAR",
    changePct: 0.1,
    high52w: 150,
    low52w: 80,
    asOf: "2026-01-16T18:00:00.000Z",
    ...over,
  };
}

const spyQuote = quote({ symbol: "SPY", changePct: 0.002, open: 500, price: 501, regularPrice: 501, prevClose: 500, dayHigh: 502, dayLow: 499 });

function run(bars: Bar[], over: Partial<EngineInput> = {}) {
  return edgeEngine({
    symbol: "TEST",
    bars,
    quote: quote(),
    benchmark: spyQuote,
    orMinutes: 15,
    nowIso: "2026-01-16T18:00:00.000Z",
    ...over,
  });
}

describe("edgeEngine", () => {
  it("stays silent without enough bars", () => {
    expect(run(session("2026-01-16", flat(100)).slice(0, 10))).toBeNull();
    expect(run([])).toBeNull();
  });

  it("reads a persistent uptrend as a long bias with agreeing drivers", () => {
    const bars = [
      ...session("2026-01-15", flat(100)),
      ...session("2026-01-16", up(100, 0.12), (i) => 120_000 + i * 500),
    ];
    const r = run(bars);
    expect(r).not.toBeNull();
    expect(r!.bias).toBe("long");
    expect(r!.score).toBeGreaterThan(8);
    expect(r!.drivers.length).toBeGreaterThan(0);
    for (const d of r!.drivers) expect(d.impact).toBeGreaterThan(0);
    for (const c of r!.cautions) expect(c.impact).toBeLessThan(0);
  });

  it("mirrors to a short bias on a persistent downtrend", () => {
    const bars = [
      ...session("2026-01-15", flat(100)),
      ...session("2026-01-16", down(100, 0.12)),
    ];
    const r = run(bars, {
      quote: quote({ price: 91, regularPrice: 91, open: 100, prevClose: 100.2, dayHigh: 100.4, dayLow: 90.8, changePct: -0.09 }),
    });
    expect(r!.bias).toBe("short");
    expect(r!.score).toBeLessThan(-8);
  });

  it("reads a flat, alternating tape as no edge", () => {
    const bars = [
      ...session("2026-01-15", flat(100)),
      ...session("2026-01-16", flat(100)),
    ];
    const r = run(bars, {
      quote: quote({ price: 100, regularPrice: 100, open: 100, prevClose: 100, dayHigh: 100.2, dayLow: 99.8, changePct: 0 }),
      benchmark: null,
    });
    expect(r).not.toBeNull();
    expect(Math.abs(r!.score)).toBeLessThan(20);
  });

  it("normalizes earned weights to 1 and reports honest coverage", () => {
    const bars = [
      ...session("2026-01-15", up(100, 0.05)),
      ...session("2026-01-16", up(103.9, 0.05)),
    ];
    const r = run(bars);
    const wSum = r!.layers.reduce((a, l) => a + l.weight, 0);
    expect(wSum).toBeCloseTo(1, 6);
    expect(r!.coverage).toBeGreaterThan(0.5);
    expect(r!.coverage).toBeLessThanOrEqual(1);
    for (const l of r!.layers) {
      expect(l.coverage).toBeGreaterThanOrEqual(0);
      expect(l.agreement).toBeGreaterThanOrEqual(0);
      expect(l.agreement).toBeLessThanOrEqual(1);
    }
  });

  it("runs bars-only: quote layers drop out instead of faking a read", () => {
    const bars = [
      ...session("2026-01-15", flat(100)),
      ...session("2026-01-16", up(100, 0.1)),
    ];
    const r = run(bars, { quote: null, benchmark: null });
    expect(r).not.toBeNull();
    const relstr = r!.layers.find((l) => l.key === "relstr")!;
    const gap = r!.layers.find((l) => l.key === "gap")!;
    expect(relstr.coverage).toBe(0);
    expect(relstr.weight).toBe(0);
    expect(gap.weight).toBe(0);
    expect(r!.bias).toBe("long");
  });

  it("keeps the gap layer silent on a no-gap day", () => {
    const bars = [
      ...session("2026-01-15", flat(100)),
      ...session("2026-01-16", up(100, 0.05)),
    ];
    const r = run(bars, {
      quote: quote({ open: 100, prevClose: 100 }), // flat open — no gap
    });
    const gap = r!.layers.find((l) => l.key === "gap")!;
    expect(gap.coverage).toBe(0);
    expect(gap.score).toBeNull();
  });

  it("scores the gap layer on a real gap day", () => {
    const bars = [
      ...session("2026-01-15", flat(100)),
      ...session("2026-01-16", up(105, 0.05)),
    ];
    // Gapped up 5% and riding it: both gap signals should confirm the long.
    const r = run(bars, {
      quote: quote({ open: 105, prevClose: 100, price: 108, regularPrice: 108, dayHigh: 108.5, dayLow: 104.8 }),
    });
    const gap = r!.layers.find((l) => l.key === "gap")!;
    expect(gap.coverage).toBe(1);
    expect(gap.score).toBeGreaterThan(0.5);
  });

  it("extension guard never confirms the crowd in a one-way move", () => {
    const bars = [
      ...session("2026-01-15", flat(100)),
      ...session("2026-01-16", up(100, 0.25)), // relentless one-way tape
    ];
    const r = run(bars);
    const ext = r!.layers.find((l) => l.key === "extension")!;
    expect(ext.score).not.toBeNull();
    expect(ext.score as number).toBeLessThanOrEqual(0);
  });

  it("keeps volume reads alive across zero-volume post-market prints", () => {
    // A full up-day followed by six 0-volume after-hours bars (16:05+ ET):
    // the volume layer must read the session's tape, not the dead prints.
    const post: Bar[] = Array.from({ length: 6 }, (_, i) => ({
      t: `2026-01-16T21:${String(5 + i * 5).padStart(2, "0")}:00.000Z`,
      o: 109.3,
      c: 109.3,
      h: 109.35,
      l: 109.25,
      v: 0,
    }));
    const bars = [
      ...session("2026-01-15", flat(100)),
      ...session("2026-01-16", up(100, 0.12), () => 150_000),
      ...post,
    ];
    const r = run(bars);
    const vol = r!.layers.find((l) => l.key === "volume")!;
    expect(vol.coverage).toBeGreaterThan(0);
    expect(vol.score).not.toBeNull();
    expect(vol.score as number).toBeGreaterThan(0); // an up-tape's volume read
  });

  it("builds a ribbon over the latest session within score bounds", () => {
    const bars = [
      ...session("2026-01-15", flat(100)),
      ...session("2026-01-16", up(100, 0.1)),
    ];
    const r = run(bars);
    expect(r!.ribbon.length).toBeGreaterThan(30);
    for (const p of r!.ribbon) {
      expect(p.score).toBeGreaterThanOrEqual(-100);
      expect(p.score).toBeLessThanOrEqual(100);
      expect(p.t.startsWith("2026-01-16")).toBe(true);
    }
    // The read should have strengthened as the trend persisted.
    const first = r!.ribbon[0].score;
    const last = r!.ribbon[r!.ribbon.length - 1].score;
    expect(last).toBeGreaterThan(first);
  });
});

describe("convictionLabel", () => {
  it("maps score bands to shared UI copy", () => {
    expect(convictionLabel(3)).toBe("no edge");
    expect(convictionLabel(-3)).toBe("no edge");
    expect(convictionLabel(15)).toBe("lean");
    expect(convictionLabel(-40)).toBe("moderate");
    expect(convictionLabel(60)).toBe("strong");
    expect(convictionLabel(-90)).toBe("extreme");
  });
});
