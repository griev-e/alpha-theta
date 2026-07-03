import { describe, expect, it } from "vitest";
import { runProjection } from "./project";
import { DEFAULT_ASSUMPTIONS } from "./assumptions";

const base = {
  investedValue: 100000,
  cashValue: 20000,
  liabilities: 10000,
  monthlyContribution: 1000,
  years: 10,
  assumptions: DEFAULT_ASSUMPTIONS,
};

describe("runProjection", () => {
  it("is deterministic for the same inputs", () => {
    const a = runProjection(base);
    const b = runProjection(base);
    expect(a.median).toBe(b.median);
    expect(a.p5).toBe(b.p5);
  });

  it("starts at the current net worth and grows the median with contributions", () => {
    const r = runProjection(base);
    const startNW = base.investedValue + base.cashValue - base.liabilities;
    expect(r.bands[0].p50).toBeCloseTo(startNW, 6);
    expect(r.median).toBeGreaterThan(startNW);
    // Ordered percentile bands.
    expect(r.p5).toBeLessThan(r.median);
    expect(r.median).toBeLessThan(r.p95);
  });

  it("reports a target probability between 0 and 1 when a target is set", () => {
    const r = runProjection({ ...base, target: 300000 });
    expect(r.probTarget).not.toBeNull();
    expect(r.probTarget!).toBeGreaterThanOrEqual(0);
    expect(r.probTarget!).toBeLessThanOrEqual(1);
    // No target → null.
    expect(runProjection(base).probTarget).toBeNull();
  });

  it("deflates the real median below the nominal median", () => {
    const r = runProjection(base);
    expect(r.realMedian).toBeLessThan(r.median);
  });

  it("redraws a different fan when the seed salt changes", () => {
    const a = runProjection(base);
    const b = runProjection({ ...base, seedSalt: 1 });
    expect(a.median).not.toBe(b.median);
  });

  it("widens the fan with higher volatility", () => {
    const calm = runProjection({ ...base, assumptions: { ...DEFAULT_ASSUMPTIONS, investVol: 0.05 } });
    const wild = runProjection({ ...base, assumptions: { ...DEFAULT_ASSUMPTIONS, investVol: 0.3 } });
    expect(wild.p95 - wild.p5).toBeGreaterThan(calm.p95 - calm.p5);
  });
});
