/**
 * Ledoit–Wolf covariance shrinkage toward a fixed structural target.
 *
 * The factor model in `correlation.ts` gives a well-conditioned but *structural*
 * covariance Σ_F: co-movement comes from betas and fixed sector/industry/fund
 * affinity constants, not from how the holdings have actually moved together.
 * When real return history is available we can do better — but a raw sample
 * covariance S over ~1y of daily returns is noisy and (once the number of names
 * approaches the number of observations) ill-conditioned, which wrecks the
 * optimizer and inflates the largest eigen-directions.
 *
 * The classic fix (Ledoit & Wolf, 2004, "Honey, I Shrunk the Sample Covariance
 * Matrix") is to shrink S toward a structured target F:
 *
 *   Σ* = δ·F + (1 − δ)·S,   δ ∈ [0, 1]
 *
 * and choose δ to minimize the expected Frobenius distance E‖Σ* − Σ‖². The
 * optimal intensity is δ* = (π̂ − ρ̂) / (T·γ̂), where
 *
 *   π̂ = Σ_ij AsyVar(√T·S_ij)   — how noisy the sample entries are
 *   ρ̂ = Σ_ij AsyCov(√T·S_ij, √T·F_ij)   — covariance of that noise with the target
 *   γ̂ = ‖F − S‖²_F   — how far the target sits from the sample (its bias)
 *
 * Here the target F is **exogenous**: it's built from betas and sector labels,
 * not estimated from the same return window, so its sampling covariance with S
 * is negligible and ρ̂ ≈ 0. That leaves δ* = π̂ / (T·γ̂), clamped to [δ_min, 1].
 *
 * The result is PSD-safe by construction: S is PSD (a sum of outer products)
 * and F is positive-*definite* (the factor model floors its diagonal), so any
 * δ ≥ δ_min > 0 makes Σ* positive-definite — the same guarantee the pure factor
 * covariance carries, preserved through the blend.
 */

export interface ShrinkResult {
  /** The shrunk covariance Σ* = δF + (1−δ)S, annualized to match the target. */
  matrix: number[][];
  /** The chosen shrinkage intensity δ ∈ [δ_min, 1] (1 = pure structural target). */
  delta: number;
}

/**
 * Log returns from a price series, skipping non-positive/gap prints. A series of
 * `n` prices yields at most `n − 1` returns.
 */
export function logReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const a = prices[i - 1];
    const b = prices[i];
    if (a > 0 && b > 0) out.push(Math.log(b / a));
  }
  return out;
}

/**
 * Shrink a sample covariance (estimated from `returns`) toward a structural
 * `target`, returning the blended annualized covariance and the intensity used.
 *
 * @param returns       per-asset periodic (e.g. daily) return series, `[asset][t]`,
 *                      all the same length `T`, indexed parallel to `target`.
 * @param target        the structural covariance F, **annualized**, N×N and PD.
 * @param annualization periods per year (252 daily, 52 weekly) — scales the
 *                      sample covariance onto the target's annual units.
 * @param minDelta      floor on δ so the blend stays positive-definite even when
 *                      the sample would otherwise dominate (default 1e-3).
 *
 * Falls back to the target (δ = 1) when there isn't enough history to estimate S.
 */
export function ledoitWolfShrink(
  returns: number[][],
  target: number[][],
  annualization: number,
  minDelta = 1e-3
): ShrinkResult {
  const n = returns.length;
  const T = returns[0]?.length ?? 0;
  if (n === 0 || T < 2) return { matrix: target, delta: 1 };

  // Demean each asset and scale by √annualization so the sample covariance S
  // lands in the same annual units as the structural target F.
  const scale = Math.sqrt(annualization);
  const x: number[][] = returns.map((r) => {
    const mean = r.reduce((s, v) => s + v, 0) / T;
    return r.map((v) => (v - mean) * scale);
  });

  // Sample covariance S = (1/T) Σ_t x_t x_tᵀ (annualized, PSD by construction).
  const S: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let acc = 0;
      for (let t = 0; t < T; t++) acc += x[i][t] * x[j][t];
      S[i][j] = acc / T;
      S[j][i] = S[i][j];
    }
  }

  // π̂ = Σ_ij (1/T) Σ_t (x_it x_jt − S_ij)² — total sampling noise in S.
  let piHat = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let acc = 0;
      for (let t = 0; t < T; t++) {
        const d = x[i][t] * x[j][t] - S[i][j];
        acc += d * d;
      }
      piHat += acc / T;
    }
  }

  // γ̂ = ‖F − S‖²_F — how far the structural target sits from the sample.
  let gamma = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const d = target[i][j] - S[i][j];
      gamma += d * d;
    }
  }

  // Exogenous target ⇒ ρ̂ ≈ 0, so δ* = π̂ / (T·γ̂). When γ̂ ≈ 0 the sample already
  // equals the target, so the blend is irrelevant — take the structural side.
  let delta = gamma > 1e-18 ? piHat / (T * gamma) : 1;
  delta = Math.min(1, Math.max(minDelta, delta));

  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      matrix[i][j] = delta * target[i][j] + (1 - delta) * S[i][j];
    }
  }
  return { matrix, delta };
}
