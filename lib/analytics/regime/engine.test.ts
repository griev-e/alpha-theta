import { describe, expect, it } from "vitest";
import { buildContext } from "./context";
import { buildRegimeReport } from "./engine";
import { LAYERS } from "./layers";
import type { Series } from "./mathx";
import { ALL_SYMBOLS } from "./universe";

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

/**
 * Build a full synthetic market across every universe symbol. We don't need it
 * to be realistic — only long enough (≈ percentile lookback + replay window)
 * and well-formed enough that every layer can score against its own history.
 */
function syntheticContext() {
  const N = 460;
  const dates = Array.from({ length: N }, (_, i) =>
    new Date(Date.UTC(2024, 0, 1) + i * 86_400_000).toISOString().slice(0, 10)
  );
  const series: Record<string, Series> = {};
  ALL_SYMBOLS.forEach((sym, si) => {
    const rand = rng(si * 7919 + 1);
    let v = sym.startsWith("^") ? 18 : 100; // VIX-like symbols start lower
    const arr: number[] = [];
    for (let i = 0; i < N; i++) {
      const shock = (rand() - 0.5) * 0.02;
      v = Math.max(1, v * (1 + 0.0003 + shock));
      arr.push(v);
    }
    series[sym] = arr;
  });
  return { ctx: buildContext(dates, series), n: N };
}

const coverage = {
  requested: ALL_SYMBOLS.length,
  loaded: ALL_SYMBOLS.length,
  missing: [] as string[],
};

describe("buildRegimeReport", () => {
  it("produces a coherent, well-bounded report from a full universe", () => {
    const { ctx } = syntheticContext();
    const r = buildRegimeReport(ctx, coverage);

    expect(r.score).toBeGreaterThanOrEqual(-1);
    expect(r.score).toBeLessThanOrEqual(1);
    expect(r.confidence).toBeGreaterThanOrEqual(1);
    expect(r.confidence).toBeLessThanOrEqual(99);
    expect(r.health).toBeGreaterThanOrEqual(0);
    expect(r.health).toBeLessThanOrEqual(100);
    expect(r.agreement).toBeGreaterThanOrEqual(0);
    expect(r.agreement).toBeLessThanOrEqual(1);
    expect(r.persistence).toBeGreaterThanOrEqual(0);
    expect(r.persistence).toBeLessThanOrEqual(1);
  });

  it("evaluates every registered layer and exposes its methodology", () => {
    const { ctx } = syntheticContext();
    const r = buildRegimeReport(ctx, coverage);
    expect(r.layers).toHaveLength(LAYERS.length);
    expect(r.methodology.length).toBeGreaterThan(0);
    // weights are earned shares that never exceed the whole
    for (const layer of r.layers) {
      expect(layer.weight).toBeGreaterThanOrEqual(0);
      expect(layer.weight).toBeLessThanOrEqual(1);
    }
  });

  it("returns an aligned, look-ahead-free history track", () => {
    const { ctx } = syntheticContext();
    const r = buildRegimeReport(ctx, coverage);
    expect(r.history.score.length).toBe(r.history.dates.length);
    expect(r.history.health.length).toBe(r.history.dates.length);
    expect(r.history.score.length).toBeGreaterThan(0);
    // the latest composite is the reported score
    expect(r.history.score[r.history.score.length - 1]).toBeCloseTo(r.score, 10);
  });

  it("populates the index trend table and capital-flow ratios", () => {
    const { ctx } = syntheticContext();
    const r = buildRegimeReport(ctx, coverage);
    expect(r.trendTable.length).toBeGreaterThan(0);
    expect(r.ratios.length).toBeGreaterThan(0);
  });

  it("is deterministic for identical inputs", () => {
    const a = buildRegimeReport(syntheticContext().ctx, coverage);
    const b = buildRegimeReport(syntheticContext().ctx, coverage);
    expect(b.score).toBe(a.score);
    expect(b.confidence).toBe(a.confidence);
    expect(b.health).toBe(a.health);
  });

  it("refuses to score a too-short history", () => {
    const dates = Array.from({ length: 30 }, (_, i) =>
      new Date(Date.UTC(2024, 0, 1) + i * 86_400_000).toISOString().slice(0, 10)
    );
    const series: Record<string, Series> = {
      SPY: dates.map((_, i) => 100 + i),
    };
    expect(() => buildRegimeReport(buildContext(dates, series), coverage)).toThrow();
  });
});
