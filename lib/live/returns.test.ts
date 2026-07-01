import { afterEach, describe, expect, it } from "vitest";
import { holding, makePortfolio } from "@/lib/__tests__/factory";
import {
  covarianceMatrix,
  estimatedCovariance,
  factorCovariance,
  type CorrInputs,
} from "@/lib/analytics/correlation";
import type { HistoryPoint } from "@/lib/research/types";
import { clearReturns, getReturns, setReturnSeries } from "./returns";

/** A price series that drifts with per-step returns, one bar per calendar day. */
function priceSeries(steps: number[], start = 100): HistoryPoint[] {
  const points: HistoryPoint[] = [];
  let price = start;
  const base = Date.UTC(2025, 0, 1);
  points.push({ t: new Date(base).toISOString(), c: price });
  steps.forEach((r, i) => {
    price *= Math.exp(r);
    points.push({ t: new Date(base + (i + 1) * 86_400_000).toISOString(), c: price });
  });
  return points;
}

function noise(n: number, sd: number, seed: number): number[] {
  // Cheap deterministic pseudo-normal via summed uniforms (Irwin–Hall).
  let s = seed >>> 0;
  const next = () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  return Array.from({ length: n }, () => {
    let acc = 0;
    for (let k = 0; k < 12; k++) acc += next();
    return (acc - 6) * sd;
  });
}

afterEach(() => clearReturns());

describe("getReturns", () => {
  it("returns null when a requested symbol has no history (all-or-nothing)", () => {
    setReturnSeries("A", priceSeries(noise(200, 0.01, 1)));
    expect(getReturns(["A", "B"])).toBeNull();
  });

  it("returns null below the minimum overlapping observations", () => {
    setReturnSeries("A", priceSeries(noise(50, 0.01, 1)));
    setReturnSeries("B", priceSeries(noise(50, 0.01, 2)));
    expect(getReturns(["A", "B"])).toBeNull();
  });

  it("aligns two symbols on their common trading days in symbol order", () => {
    setReturnSeries("A", priceSeries(noise(200, 0.01, 1)));
    setReturnSeries("B", priceSeries(noise(200, 0.01, 2)));
    const aligned = getReturns(["A", "B"]);
    expect(aligned).not.toBeNull();
    expect(aligned!.matrix).toHaveLength(2);
    expect(aligned!.observations).toBeGreaterThanOrEqual(120);
    expect(aligned!.matrix[0]).toHaveLength(aligned!.observations);
    expect(aligned!.annualization).toBe(252);
  });
});

describe("estimatedCovariance drop-in", () => {
  const inputs: CorrInputs[] = [
    { symbol: "A", beta: 1, vol: 0.2, sector: "Technology", industry: "Software", isFund: false },
    { symbol: "B", beta: 1, vol: 0.2, sector: "Energy", industry: "Oil & Gas", isFund: false },
  ];

  it("equals the structural covariance when no history is primed", () => {
    expect(estimatedCovariance(inputs)).toEqual(factorCovariance(inputs));
  });

  it("shrinks toward realized co-movement once history is loaded", () => {
    // A and B share every daily shock → strongly correlated in reality, but the
    // structural model couples them weakly (different sectors). The estimator
    // must raise their off-diagonal above the pure structural prior.
    const shocks = noise(220, 0.012, 99);
    setReturnSeries("A", priceSeries(shocks));
    setReturnSeries("B", priceSeries(shocks.map((r) => r * 0.98)));
    const structural = factorCovariance(inputs);
    const estimated = estimatedCovariance(inputs);
    expect(estimated).not.toEqual(structural);
    expect(estimated[0][1]).toBeGreaterThan(structural[0][1]);
  });

  it("flows through covarianceMatrix for a covered portfolio", () => {
    const portfolio = makePortfolio([
      holding({ symbol: "A", shares: 10, price: 100 }),
      holding({ symbol: "B", shares: 10, price: 100 }),
    ]);
    const structural = covarianceMatrix(portfolio);
    const shocks = noise(220, 0.012, 7);
    setReturnSeries("A", priceSeries(shocks));
    setReturnSeries("B", priceSeries(shocks.map((r) => -r))); // mirror → negatively correlated
    const estimated = covarianceMatrix(portfolio);
    expect(estimated[0][1]).toBeLessThan(structural[0][1]);
  });
});
