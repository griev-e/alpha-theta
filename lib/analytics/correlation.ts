import { getCMA } from "../live/cma";
import { getReturns } from "../live/returns";
import type { AssetClass, Portfolio, Position } from "../types";
import { ledoitWolfShrink } from "./shrinkage";

/**
 * Factor-model covariance & correlation estimates.
 *
 * Without per-ticker return history, co-movement is modelled with a small set of
 * shared factors. The covariance Σ is **assembled so that it is positive
 * semi-definite by construction** — there is no correlation clamp and no
 * after-the-fact projection. Σ is the sum of PSD pieces:
 *
 *   Σ = β βᵀ σ_m²                    market factor (rank-1, PSD)
 *     + Σ_g  a_g · (v_g v_gᵀ)        one shared factor per affinity group (each PSD)
 *     + diag(d)                      idiosyncratic, d_i ≥ 0
 *
 * Each affinity factor g has loading σ_i on its members and 0 elsewhere, so two
 * members contribute a_g · σ_i σ_j to their covariance — the same additive
 * affinity the previous heuristic applied on the correlation scale. The group
 * co-movement variances reproduce the old magnitudes pairwise:
 *
 *   - same sector            0.18   (sector factor)
 *   - same industry          0.30   (sector factor 0.18 + a 0.12 industry top-up;
 *                                    sector-less names like broad ETFs get the
 *                                    full 0.30 from the industry factor alone)
 *   - broad fund ↔ fund      0.06   (fund factor)
 *
 * The idiosyncratic diagonal tops each name up to its standalone variance σ_i²,
 * floored at `DIAG_FLOOR · σ_i²` so Σ stays strictly positive-definite even in
 * the incoherent case where the market + affinity factors already over-explain
 * σ_i² (a low-vol / high-beta name where β_i σ_m > σ_i). The floor inflates such
 * a diagonal slightly — an accepted cost of guaranteeing PSD.
 *
 * The displayed correlation matrix is **derived from this Σ** — ρ_ij =
 * Σ_ij / √(Σ_ii Σ_jj), diagonal forced to 1 — so the heatmap and the risk math
 * in `risk.ts` share a single source of truth.
 */

/** Affinity group co-movement variances (on the correlation scale). */
const SECTOR_VAR = 0.18;
const INDUSTRY_VAR = 0.3;
const FUND_VAR = 0.06;
/** Minimum idiosyncratic fraction of σ_i² kept on the diagonal (keeps Σ PD). */
const DIAG_FLOOR = 0.01;

/**
 * Within-class co-movement for the non-equity asset classes. Bonds move with
 * bonds, cryptos with cryptos, etc. — a shared factor that binds a class
 * together *without* pulling it toward the equity book. Cross-class co-movement
 * flows only through the market factor (β), so a bond fund with β≈0 lands near
 * zero (even negative) correlation to stocks, which is the honest structural
 * default. Cash carries ~0 vol and no affinity — it drops out on its own.
 */
const CLASS_VAR: Record<Exclude<AssetClass, "equity" | "cash">, number> = {
  bond: 0.5,
  commodity: 0.4,
  crypto: 0.6,
};

export interface CorrInputs {
  symbol: string;
  beta: number;
  vol: number;
  sector: string;
  industry: string;
  isFund: boolean;
  /** Broad asset class; absent is treated as `equity` (the historical model). */
  assetClass?: AssetClass;
}

/**
 * Positions with live fundamentals — the only ones the factor model can price.
 * A holding with no live data (`fundamentals === null`) is excluded from the
 * risk/correlation math rather than imputed with a default beta/vol; callers
 * surface the excluded weight as a coverage gap.
 */
export function coveredPositions(portfolio: Portfolio): Position[] {
  return portfolio.positions.filter((p) => p.fundamentals !== null);
}

export function corrInputs(p: Position): CorrInputs {
  const f = p.fundamentals;
  // Only ever called on covered positions; the fallback keeps the type total.
  return {
    symbol: p.symbol,
    beta: f?.beta ?? 1,
    vol: f?.volatility ?? 0.2,
    sector: f?.sector ?? "Unknown",
    industry: f?.industry ?? "Unknown",
    isFund: !!f?.fund,
    assetClass: f?.assetClass ?? "equity",
  };
}

interface Factor {
  key: string;
  /** Co-movement variance contributed when two members share this factor. */
  variance: number;
}

/**
 * Shared factors a name loads on. Precedence matches the old heuristic: a known
 * industry takes the industry factor, otherwise a known (non-diversified) sector
 * takes the sector factor, plus the broad-fund factor when applicable.
 *
 * A sectored name carries both its sector factor (0.18) and an industry top-up
 * (0.12) so two same-industry names reach 0.30 while two same-sector names stay
 * at 0.18. A sector-less name (e.g. a broad ETF, sector "Diversified") instead
 * gets the full 0.30 on the industry factor, since it has no sector factor to
 * build on — so two same-industry ETFs still reach 0.30.
 */
function factorsFor(x: CorrInputs): Factor[] {
  const cls = x.assetClass ?? "equity";
  // Non-equity classes don't load the equity sector/industry/fund factors —
  // those would wrongly bind a bond ETF to the tech names it shares the "Fund /
  // ETF" industry with. Instead each such name loads a single within-class
  // factor, so bonds cluster with bonds and crypto with crypto, while
  // cross-class co-movement is left to the market factor (β) alone. Cash gets
  // no affinity factor at all (its ~0 vol makes it inert regardless).
  if (cls !== "equity") {
    const variance = cls === "cash" ? undefined : CLASS_VAR[cls];
    return variance ? [{ key: `class:${cls}`, variance }] : [];
  }

  const factors: Factor[] = [];
  const hasSector = x.sector !== "Unknown" && x.sector !== "Diversified";
  const hasIndustry = x.industry !== "Unknown";
  if (hasSector) factors.push({ key: `sec:${x.sector}`, variance: SECTOR_VAR });
  if (hasIndustry) {
    factors.push({
      key: `ind:${x.industry}`,
      variance: hasSector ? INDUSTRY_VAR - SECTOR_VAR : INDUSTRY_VAR,
    });
  }
  if (x.isFund) factors.push({ key: "fund", variance: FUND_VAR });
  return factors;
}

/**
 * Structural factor covariance Σ for a set of names — PSD by construction.
 * This is the single source of truth feeding both `covarianceMatrix` and the
 * derived `correlationMatrix`.
 */
export function factorCovariance(inputs: CorrInputs[]): number[][] {
  const n = inputs.length;
  const sm2 = getCMA().marketVolatility ** 2;
  const factors = inputs.map(factorsFor);
  const factorMaps = factors.map(
    (fs) => new Map(fs.map((f) => [f.key, f.variance]))
  );

  // Idiosyncratic diagonal: top each name up to σ_i², floored so the market and
  // affinity factors can't drive d_i below DIAG_FLOOR·σ_i² (keeps Σ strictly PD).
  const d = inputs.map((x, i) => {
    const groupVar = factors[i].reduce((s, f) => s + f.variance, 0);
    const raw = x.vol * x.vol * (1 - groupVar) - x.beta * x.beta * sm2;
    return Math.max(raw, DIAG_FLOOR * x.vol * x.vol);
  });

  const cov: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      // Market factor.
      let s = inputs[i].beta * inputs[j].beta * sm2;
      // Shared affinity factors (when i === j this sums the name's own group
      // variances, σ_i² · Σ_g a_g).
      for (const [key, variance] of factorMaps[i]) {
        if (factorMaps[j].has(key)) s += variance * inputs[i].vol * inputs[j].vol;
      }
      if (i === j) s += d[i];
      cov[i][j] = s;
      cov[j][i] = s;
    }
  }
  return cov;
}

/**
 * Covariance for a set of names, shrinking a live-history sample covariance
 * toward the structural {@link factorCovariance} when enough return history has
 * been primed (see `lib/live/returns.ts`), and returning the pure structural Σ
 * otherwise. This is the single entry point the portfolio-level covariance and
 * correlation read, so the whole risk stack (risk, correlation, optimizer,
 * scenarios) gains the shrinkage overlay at once — and falls back identically
 * when no history is loaded (tests, first paint, provider outage).
 *
 * The structural matrix is always the shrink *target*, so the result stays
 * positive-definite (PD target + PSD sample, δ ≥ δ_min > 0) exactly like the
 * pure factor covariance it replaces.
 */
export function estimatedCovariance(inputs: CorrInputs[]): number[][] {
  const structural = factorCovariance(inputs);
  const history = getReturns(inputs.map((x) => x.symbol));
  if (!history) return structural;
  return ledoitWolfShrink(history.matrix, structural, history.annualization)
    .matrix;
}

function corrFromCov(cov: number[][], i: number, j: number): number {
  if (i === j) return 1;
  const denom = Math.sqrt(cov[i][i] * cov[j][j]);
  return denom > 0 ? cov[i][j] / denom : 0;
}

/**
 * Pairwise correlation derived from the structural covariance — kept as a
 * helper, but it reads from the same PSD Σ the matrices use.
 */
export function pairCorrelation(a: CorrInputs, b: CorrInputs): number {
  if (a.symbol === b.symbol) return 1;
  const cov = estimatedCovariance([a, b]);
  return corrFromCov(cov, 0, 1);
}

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][]; // matrix[i][j] = ρ
  /** Average pairwise correlation, weighted equally across pairs. */
  avgCorrelation: number;
  /**
   * Risk-weighted average pairwise correlation: each pair is weighted by its
   * contribution to portfolio variance, (wᵢσᵢ)(wⱼσⱼ). This is the correlation
   * term that actually drives `wᵀΣw`, so two large, volatile holdings moving
   * together count far more than two tiny tail positions. Reflects realized
   * diversification better than the equal-weighted mean.
   */
  weightedAvgCorrelation: number;
  /** Most and least correlated pairs (excluding self). */
  highest: { a: string; b: string; rho: number } | null;
  lowest: { a: string; b: string; rho: number } | null;
}

export function correlationMatrix(portfolio: Portfolio): CorrelationMatrix {
  const ps = coveredPositions(portfolio);
  const inputs = ps.map(corrInputs);
  const n = inputs.length;
  const cov = estimatedCovariance(inputs);
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(1));

  // Risk weight per name: invested (ex-cash) weight × volatility. Cash carries
  // σ = 0 and so drops out of the weighted average naturally.
  const riskW = ps.map((p, i) => p.equityWeight * inputs[i].vol);

  let sum = 0;
  let count = 0;
  let wSum = 0;
  let wDenom = 0;
  let highest: CorrelationMatrix["highest"] = null;
  let lowest: CorrelationMatrix["lowest"] = null;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const rho = corrFromCov(cov, i, j);
      matrix[i][j] = rho;
      matrix[j][i] = rho;
      sum += rho;
      count++;
      const pairW = riskW[i] * riskW[j];
      wSum += pairW * rho;
      wDenom += pairW;
      if (!highest || rho > highest.rho)
        highest = { a: inputs[i].symbol, b: inputs[j].symbol, rho };
      if (!lowest || rho < lowest.rho)
        lowest = { a: inputs[i].symbol, b: inputs[j].symbol, rho };
    }
  }

  return {
    symbols: inputs.map((x) => x.symbol),
    matrix,
    avgCorrelation: count > 0 ? sum / count : 0,
    weightedAvgCorrelation: wDenom > 0 ? wSum / wDenom : 0,
    highest,
    lowest,
  };
}

/**
 * Covariance matrix Σ for the portfolio's *covered* positions (those with live
 * fundamentals), PSD by construction. Indexed parallel to
 * {@link coveredPositions}, so callers must align their weight vectors to that
 * same filtered list.
 */
export function covarianceMatrix(portfolio: Portfolio): number[][] {
  return estimatedCovariance(coveredPositions(portfolio).map(corrInputs));
}

/**
 * Seriation — reorders a correlation matrix so that correlated names sit next
 * to each other instead of in import (book) order, so the heatmap's own
 * structure (a cluster of coupled mega-caps, a diversifying pocket of bonds)
 * emerges visually instead of being scattered across the diagonal.
 *
 * Average-linkage (UPGMA) agglomerative clustering on the distance 1 − ρ:
 * repeatedly merge the two closest clusters, tracking each cluster's member
 * order, until one cluster remains. The final member order is the seriated
 * index permutation. This is the standard `hclust`-order heatmap seriation —
 * not the (more expensive) optimal-leaf-ordering variant, but it reliably
 * groups correlated blocks together, which is the visual goal. Pure math, no
 * external dependency; O(n³), fine at portfolio scale (a few dozen names).
 */
export function seriationOrder(matrix: number[][]): number[] {
  const n = matrix.length;
  const identity = matrix.map((_, i) => i);
  if (n <= 2) return identity;

  const dist = matrix.map((row) =>
    row.map((rho) => Math.max(0, 1 - rho))
  );

  let members: number[][] = identity.map((i) => [i]);
  let clusterDist = dist.map((row) => row.slice());

  while (members.length > 1) {
    let a = 0;
    let b = 1;
    let best = Infinity;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        if (clusterDist[i][j] < best) {
          best = clusterDist[i][j];
          a = i;
          b = j;
        }
      }
    }

    const others = members.map((_, k) => k).filter((k) => k !== a && k !== b);
    const sizeA = members[a].length;
    const sizeB = members[b].length;
    // Lance-Williams update for average linkage: the merged cluster's distance
    // to every remaining cluster is the size-weighted mean of the two merged
    // clusters' distances to it.
    const mergedRow = others.map(
      (k) => (sizeA * clusterDist[a][k] + sizeB * clusterDist[b][k]) / (sizeA + sizeB)
    );

    const nextDist: number[][] = others.map((oi) =>
      others.map((oj) => clusterDist[oi][oj])
    );
    for (let i = 0; i < others.length; i++) nextDist[i].push(mergedRow[i]);
    nextDist.push([...mergedRow, 0]);

    members = [...others.map((k) => members[k]), [...members[a], ...members[b]]];
    clusterDist = nextDist;
  }

  return members[0];
}

/** {@link CorrelationMatrix} with its rows/columns permuted to the seriated
 *  order (see {@link seriationOrder}); the summary stats are order-independent
 *  and pass through unchanged. */
export function seriate(corr: CorrelationMatrix): CorrelationMatrix {
  const order = seriationOrder(corr.matrix);
  return {
    ...corr,
    symbols: order.map((i) => corr.symbols[i]),
    matrix: order.map((i) => order.map((j) => corr.matrix[i][j])),
  };
}
