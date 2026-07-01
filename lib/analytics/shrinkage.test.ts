import { describe, expect, it } from "vitest";
import { mulberry32 } from "./mathUtils";
import { ledoitWolfShrink, logReturns } from "./shrinkage";

/** Dependency-free PSD check via Cholesky (small floor for the PD edge). */
function isPSD(m: number[][], eps = 1e-9): boolean {
  const n = m.length;
  const L = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = m[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      if (i === j) {
        if (sum < -eps) return false;
        L[i][j] = Math.sqrt(Math.max(sum, 0));
      } else {
        L[i][j] = L[j][j] > 0 ? sum / L[j][j] : 0;
      }
    }
  }
  return true;
}

/** Two correlated daily return series with a shared and an idiosyncratic shock. */
function correlatedReturns(
  rho: number,
  T: number,
  seed: number
): number[][] {
  const rand = mulberry32(seed);
  const normal = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const a: number[] = [];
  const b: number[] = [];
  const sd = 0.012; // ~19% annualized
  for (let t = 0; t < T; t++) {
    const common = normal();
    const ea = normal();
    const eb = normal();
    a.push(sd * (Math.sqrt(rho) * common + Math.sqrt(1 - rho) * ea));
    b.push(sd * (Math.sqrt(rho) * common + Math.sqrt(1 - rho) * eb));
  }
  return [a, b];
}

describe("logReturns", () => {
  it("computes log returns and skips non-positive prints", () => {
    expect(logReturns([100, 110])).toEqual([Math.log(1.1)]);
    expect(logReturns([100, 0, 120])).toEqual([]); // both gaps around the 0 dropped
    expect(logReturns([100])).toEqual([]);
  });
});

describe("ledoitWolfShrink", () => {
  const target = [
    [0.04, 0.02],
    [0.02, 0.04],
  ];

  it("returns the target untouched when there is no history", () => {
    const { matrix, delta } = ledoitWolfShrink([], target, 252);
    expect(matrix).toBe(target);
    expect(delta).toBe(1);
  });

  it("keeps δ within [δ_min, 1] and stays symmetric + PSD", () => {
    const returns = correlatedReturns(0.5, 252, 1);
    const { matrix, delta } = ledoitWolfShrink(returns, target, 252);
    expect(delta).toBeGreaterThanOrEqual(1e-3);
    expect(delta).toBeLessThanOrEqual(1);
    expect(matrix[0][1]).toBeCloseTo(matrix[1][0], 12);
    expect(isPSD(matrix)).toBe(true);
  });

  it("recovers the sample correlation between the target and the raw sample", () => {
    // Series are built at ρ ≈ 0.5 but the target insists on 0.5 covariance /
    // 0.04 variance (ρ 0.5). The blended off-diagonal must sit between the pure
    // structural target and the pure sample estimate.
    const returns = correlatedReturns(0.8, 400, 7);
    const structural = [
      [0.04, 0.006], // target barely couples the pair (ρ 0.15)
      [0.006, 0.04],
    ];
    const { matrix } = ledoitWolfShrink(returns, structural, 252);
    // Sample covariance the estimator saw (annualized), off-diagonal.
    const T = returns[0].length;
    const ann = 252;
    const mean = (r: number[]) => r.reduce((s, v) => s + v, 0) / r.length;
    const ma = mean(returns[0]);
    const mb = mean(returns[1]);
    let s01 = 0;
    for (let t = 0; t < T; t++) s01 += (returns[0][t] - ma) * (returns[1][t] - mb);
    s01 = (s01 / T) * ann;
    const lo = Math.min(structural[0][1], s01);
    const hi = Math.max(structural[0][1], s01);
    expect(matrix[0][1]).toBeGreaterThanOrEqual(lo - 1e-9);
    expect(matrix[0][1]).toBeLessThanOrEqual(hi + 1e-9);
    // The true coupling (0.8) is far above the target's 0.15, so the sample
    // pulls the blended covariance up above the structural prior.
    expect(matrix[0][1]).toBeGreaterThan(structural[0][1]);
  });

  it("is deterministic for the same inputs", () => {
    const returns = correlatedReturns(0.3, 200, 42);
    const a = ledoitWolfShrink(returns, target, 252);
    const b = ledoitWolfShrink(returns, target, 252);
    expect(a).toEqual(b);
  });
});
