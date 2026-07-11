import { describe, expect, it } from "vitest";
import { SIM_MIN_SAMPLES, simulateTrading } from "./simulate";

const winners = Array.from({ length: 20 }, (_, i) => 0.5 + (i % 3) * 0.5); // all > 0
const losers = Array.from({ length: 20 }, (_, i) => -0.5 - (i % 3) * 0.5); // all < 0
const mixed = [2, -1, 1.5, -1, 3, -1, -0.5, 1, -1, 0.8, -1, 2.2, -0.7, 1.1, -1];

describe("simulateTrading", () => {
  it("stays silent below the sample floor", () => {
    expect(simulateTrading([])).toBeNull();
    expect(simulateTrading(new Array(SIM_MIN_SAMPLES - 1).fill(1))).toBeNull();
    expect(simulateTrading(new Array(SIM_MIN_SAMPLES).fill(1))).not.toBeNull();
  });

  it("is deterministic for the same journal", () => {
    const a = simulateTrading(mixed, { paths: 500, horizon: 40 })!;
    const b = simulateTrading(mixed, { paths: 500, horizon: 40 })!;
    expect(a.bands.p50).toEqual(b.bands.p50);
    expect(a.riskOfRuin).toBe(b.riskOfRuin);
    // A different journal draws a different fan.
    const c = simulateTrading([...mixed, 5], { paths: 500, horizon: 40 })!;
    expect(c.bands.p50).not.toEqual(a.bands.p50);
  });

  it("reads an all-winning edge as certain success", () => {
    const r = simulateTrading(winners, { paths: 500, horizon: 30 })!;
    expect(r.pPositive).toBe(1);
    expect(r.riskOfRuin).toBe(0);
    expect(r.medianMaxDrawdown).toBe(0);
    // Median equity path rises monotonically.
    for (let i = 1; i < r.bands.p50.length; i++) {
      expect(r.bands.p50[i]).toBeGreaterThan(r.bands.p50[i - 1]);
    }
  });

  it("reads an all-losing edge as certain ruin", () => {
    const r = simulateTrading(losers, { paths: 500, horizon: 30, ddLimitR: 5 })!;
    expect(r.pPositive).toBe(0);
    expect(r.riskOfRuin).toBe(1);
    expect(r.expectancy).toBeLessThan(0);
  });

  it("keeps quantile bands ordered at every step", () => {
    const r = simulateTrading(mixed, { paths: 800, horizon: 60 })!;
    for (let s = 0; s < r.horizon; s++) {
      expect(r.bands.p10[s]).toBeLessThanOrEqual(r.bands.p25[s]);
      expect(r.bands.p25[s]).toBeLessThanOrEqual(r.bands.p50[s]);
      expect(r.bands.p50[s]).toBeLessThanOrEqual(r.bands.p75[s]);
      expect(r.bands.p75[s]).toBeLessThanOrEqual(r.bands.p90[s]);
    }
    expect(r.expectancy).toBeCloseTo(mixed.reduce((a, b) => a + b, 0) / mixed.length, 10);
  });

  it("a deeper drawdown limit is never MORE likely to be hit", () => {
    const shallow = simulateTrading(mixed, { paths: 800, horizon: 60, ddLimitR: 3 })!;
    const deep = simulateTrading(mixed, { paths: 800, horizon: 60, ddLimitR: 12 })!;
    expect(deep.riskOfRuin).toBeLessThanOrEqual(shallow.riskOfRuin);
  });
});
