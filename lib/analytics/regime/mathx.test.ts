import { describe, expect, it } from "vitest";
import {
  type Series,
  at,
  clamp,
  logSlope,
  mean,
  pearson,
  percentileRank,
  ret,
  sma,
  spearman,
  stdev,
  toScore,
  weightedScore,
} from "./mathx";

describe("mathx scalars", () => {
  it("clamps to bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("means and sample-stdevs, returning null on too-little data", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBeNull();
    expect(stdev([1, 3])).toBeCloseTo(Math.SQRT2, 10); // sample stdev /(n-1)
    expect(stdev([5])).toBeNull();
  });

  it("maps proportions to a -1…+1 score", () => {
    expect(toScore(0.5)).toBe(0);
    expect(toScore(1)).toBe(1);
    expect(toScore(0)).toBe(-1);
  });
});

describe("series helpers (backward-looking only)", () => {
  it("reads a value, rejecting nulls and out-of-range indices", () => {
    const s: Series = [1, null, 3];
    expect(at(s, 0)).toBe(1);
    expect(at(s, 1)).toBeNull();
    expect(at(s, 5)).toBeNull();
  });

  it("computes simple returns and moving averages", () => {
    expect(ret([100, 110], 1, 1)).toBeCloseTo(0.1, 10);
    expect(sma([2, 4, 6], 2, 3)).toBe(4);
    expect(ret([0, 110], 1, 1)).toBeNull(); // divide-by-zero guard
  });
});

describe("percentileRank", () => {
  it("counts ties as half", () => {
    expect(percentileRank([1, 2, 3, 4], 2)).toBeCloseTo(0.375, 10);
  });
  it("defaults to the median on an empty history", () => {
    expect(percentileRank([], 5)).toBe(0.5);
  });
});

describe("logSlope", () => {
  it("recovers a clean trend from a log-linear series", () => {
    const s: Series = Array.from({ length: 60 }, (_, i) => Math.exp(0.001 * i));
    const out = logSlope(s, 59, 60)!;
    expect(out.r2).toBeCloseTo(1, 6);
    expect(out.slope).toBeCloseTo(Math.expm1(0.001 * 252), 6);
  });
});

describe("correlation", () => {
  it("pearson is +1 / −1 on perfectly (anti)correlated data", () => {
    expect(pearson([1, 2, 3, 4], [1, 2, 3, 4])).toBeCloseTo(1, 10);
    expect(pearson([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 10);
  });
  it("spearman is +1 on a monotonic but non-linear relationship", () => {
    expect(spearman([1, 2, 3, 4], [1, 4, 9, 16])).toBeCloseTo(1, 10);
  });
});

describe("weightedScore", () => {
  it("returns the weighted mean and dispersion", () => {
    const out = weightedScore([1, -1], [1, 1])!;
    expect(out.score).toBeCloseTo(0, 10);
    expect(out.dispersion).toBeCloseTo(1, 10);
  });
  it("is null with no scores", () => {
    expect(weightedScore([], [])).toBeNull();
  });
});
