import { describe, expect, it } from "vitest";
import { buildContext, type MarketContext } from "../context";
import type { Series } from "../mathx";
import { ALL_SYMBOLS } from "../universe";
import { LAYERS } from "./index";
import { trendLayer } from "./trend";
import { volatilityLayer } from "./volatility";

/**
 * The engine test proves the aggregation/weighting works; this proves each of
 * the 8 signal layers is well-behaved on its own. Every layer's compute() must
 * return well-formed, in-bounds SignalResults, degrade to nulls (not throws)
 * when its inputs are missing, and stay deterministic — the contract the engine
 * relies on. Two layers with clean semantics (trend, volatility) also get
 * directional assertions.
 */

const N = 460;
const DATES = Array.from({ length: N }, (_, i) =>
  new Date(Date.UTC(2024, 0, 1) + i * 86_400_000).toISOString().slice(0, 10)
);

/** Deterministic RNG so the synthetic market is identical run-to-run. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A full synthetic universe — long enough that every layer can score. */
function fullContext(): MarketContext {
  const series: Record<string, Series> = {};
  ALL_SYMBOLS.forEach((sym, si) => {
    const rand = rng(si * 7919 + 1);
    let v = sym.startsWith("^") ? 18 : 100;
    const arr: number[] = [];
    for (let i = 0; i < N; i++) {
      const shock = (rand() - 0.5) * 0.02;
      v = Math.max(1, v * (1 + 0.0003 + shock));
      arr.push(v);
    }
    series[sym] = arr;
  });
  return buildContext(DATES, series);
}

/** Every universe symbol driven by one price path (drift + optional noise). */
function uniformContext(fn: (sym: string, i: number) => number): MarketContext {
  const series: Record<string, Series> = {};
  for (const sym of ALL_SYMBOLS) {
    series[sym] = Array.from({ length: N }, (_, i) => fn(sym, i));
  }
  return buildContext(DATES, series);
}

describe.each(LAYERS.map((l) => [l.id, l] as const))(
  "layer contract: %s",
  (_id, layer) => {
    it("emits well-formed, in-bounds signals on a full universe", () => {
      const results = layer.compute(fullContext(), N - 1);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      for (const s of results) {
        if (s === null) continue;
        expect(s.score).toBeGreaterThanOrEqual(-1);
        expect(s.score).toBeLessThanOrEqual(1);
        expect(Number.isFinite(s.score)).toBe(true);
        expect(s.id).toBeTruthy();
        expect(s.label).toBeTruthy();
        expect(typeof s.detail).toBe("string");
      }
      // At least one signal should be computable given a full history.
      expect(results.some((s) => s !== null)).toBe(true);
    });

    it("degrades to all-nulls without throwing when inputs are absent", () => {
      const empty = buildContext(DATES, {});
      const results = layer.compute(empty, N - 1);
      expect(Array.isArray(results)).toBe(true);
      expect(results.every((s) => s === null)).toBe(true);
    });

    it("is deterministic for identical inputs", () => {
      const a = layer.compute(fullContext(), N - 1);
      const b = layer.compute(fullContext(), N - 1);
      expect(b).toEqual(a);
    });

    it("summarize() returns a non-empty string across the score range", () => {
      for (const score of [-1, -0.4, 0, 0.4, 1]) {
        expect(layer.summarize(score)).toBeTruthy();
      }
    });
  }
);

describe("trend layer direction", () => {
  it("scores a steady uptrend positive and a downtrend negative", () => {
    // Monotonic rise: price sits above its 50/200-day averages, slopes up.
    const up = uniformContext((_s, i) => 100 * (1 + i * 0.002));
    // Monotonic fall (kept positive so log math is defined).
    const down = uniformContext((_s, i) => 300 * (1 - i * 0.0006));

    const upStruct = trendLayer
      .compute(up, N - 1)
      .find((s) => s?.id === "ma-structure");
    const downStruct = trendLayer
      .compute(down, N - 1)
      .find((s) => s?.id === "ma-structure");

    expect(upStruct?.score).toBeGreaterThan(0);
    expect(downStruct?.score).toBeLessThan(0);
  });
});

describe("volatility layer direction", () => {
  it("reads a low, calm VIX as more supportive than a spiking one", () => {
    // Build two VIX paths that share a year of history but end differently:
    // one drifting to its lowest, one spiking to its highest. Everything else
    // is a benign uptrend so the rest of the layer stays comparable.
    const base = (i: number) => 100 * (1 + i * 0.001);

    const calmVix = uniformContext((sym, i) =>
      sym === "^VIX" || sym === "^VIX3M"
        ? // trend downward into the final session (ends near its yearly low)
          40 - (i / N) * 25
        : base(i)
    );
    const spikeVix = uniformContext((sym, i) =>
      sym === "^VIX" || sym === "^VIX3M"
        ? // trend upward into the final session (ends near its yearly high)
          15 + (i / N) * 25
        : base(i)
    );

    const calmLevel = volatilityLayer
      .compute(calmVix, N - 1)
      .find((s) => s?.id === "vix-level");
    const spikeLevel = volatilityLayer
      .compute(spikeVix, N - 1)
      .find((s) => s?.id === "vix-level");

    expect(calmLevel).toBeTruthy();
    expect(spikeLevel).toBeTruthy();
    // A low percentile VIX is supportive (positive); a high one is restrictive.
    expect(calmLevel!.score).toBeGreaterThan(spikeLevel!.score);
    expect(calmLevel!.score).toBeGreaterThan(0);
    expect(spikeLevel!.score).toBeLessThan(0);
  });
});
