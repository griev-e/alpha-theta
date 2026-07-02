import { afterEach, describe, expect, it } from "vitest";
import { holding, makePortfolio } from "@/lib/__tests__/factory";
import {
  covarianceMatrix,
  estimatedCovariance,
  factorCovariance,
  type CorrInputs,
} from "@/lib/analytics/correlation";
import { runScenario } from "@/lib/analytics/scenarios";
import type { HistoryPoint } from "@/lib/research/types";
import {
  clearReturns,
  getRateBeta,
  getReturns,
  setRateSeries,
  setReturnSeries,
} from "./returns";

const DAY = 86_400_000;
const BASE = Date.UTC(2025, 0, 1);

/** A price series that drifts with per-step returns, one bar per calendar day. */
function priceSeries(steps: number[], start = 100): HistoryPoint[] {
  const points: HistoryPoint[] = [];
  let price = start;
  points.push({ t: new Date(BASE).toISOString(), c: price });
  steps.forEach((r, i) => {
    price *= Math.exp(r);
    points.push({ t: new Date(BASE + (i + 1) * DAY).toISOString(), c: price });
  });
  return points;
}

/** A yield-level series (percent points) built from daily changes, same grid. */
function levelSeries(changes: number[], start = 5): HistoryPoint[] {
  const points: HistoryPoint[] = [{ t: new Date(BASE).toISOString(), c: start }];
  let lvl = start;
  changes.forEach((d, i) => {
    lvl += d;
    points.push({ t: new Date(BASE + (i + 1) * DAY).toISOString(), c: lvl });
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

describe("getRateBeta", () => {
  it("recovers the OLS slope of returns on rate changes (per +100bp)", () => {
    const dy = noise(240, 0.02, 3); // daily yield changes, ~2bp sd, in points
    const trueBeta = -0.04; // −4% per +100bp (a bond-proxy sensitivity)
    const eps = noise(240, 0.0004, 9);
    const assetReturns = dy.map((d, i) => trueBeta * d + eps[i]);
    setReturnSeries("TLT", priceSeries(assetReturns));
    setRateSeries(levelSeries(dy));
    const beta = getRateBeta("TLT");
    expect(beta).not.toBeNull();
    expect(beta!).toBeCloseTo(trueBeta, 2);
  });

  it("returns null when the rate series is unprimed or history is short", () => {
    setReturnSeries("TLT", priceSeries(noise(200, 0.01, 1)));
    expect(getRateBeta("TLT")).toBeNull(); // no rate series
    setRateSeries(levelSeries(noise(40, 0.02, 2)));
    expect(getRateBeta("TLT")).toBeNull(); // < MIN_OBS overlap
    expect(getRateBeta("NOPE")).toBeNull(); // unknown symbol
  });

  it("drives the Scenarios rate shock when available", () => {
    const dy = noise(240, 0.02, 5);
    const trueBeta = -0.05;
    const assetReturns = dy.map((d) => trueBeta * d);
    setReturnSeries("TLT", priceSeries(assetReturns));
    setRateSeries(levelSeries(dy));
    const portfolio = makePortfolio([
      holding({ symbol: "TLT", shares: 10, price: 100 }),
    ]);
    const res = runScenario(portfolio, { kind: "rates", magnitude: 1 }, "+100bp");
    const impact = res.impacts.find((x) => x.symbol === "TLT")!;
    // Empirical beta × magnitude, not the duration heuristic.
    expect(impact.shockPct).toBeCloseTo(trueBeta, 2);
  });
});
