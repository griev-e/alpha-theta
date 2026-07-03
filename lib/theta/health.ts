/**
 * theta — financial health scorecard.
 *
 * theta's analogue of alpha's quality scorecard (`lib/analytics/quality.ts`): a
 * weighted, 0–100 blend of the ratios a planner actually watches, each scored
 * against a published reference band rather than a hand-picked threshold, with
 * the methodology surfaced so it reads as a *model, not advice*.
 *
 * Metrics (weight):
 *  - Emergency runway  (0.30) — liquid savings ÷ essential monthly spend, in months.
 *  - Savings rate      (0.25) — share of income kept this month.
 *  - Debt-to-income    (0.20) — monthly debt service ÷ monthly income.
 *  - Credit utilization(0.10) — revolving balance ÷ revolving limit.
 *  - Liquidity         (0.10) — liquid assets ÷ total assets.
 *  - Housing burden    (0.05) — housing spend ÷ income.
 *
 * Each metric maps its value onto 0–100 via a piecewise-linear curve anchored at
 * a "poor" and a "good" reference; the composite is the coverage-reweighted mean
 * of the metrics whose inputs exist (a metric with no data is dropped and the
 * remaining weights renormalize, exactly like alpha's coverage handling).
 */

export type HealthGrade = "A" | "B" | "C" | "D" | "F";

export interface HealthMetric {
  key: string;
  label: string;
  /** Raw value in the metric's natural unit (months, ratio…). */
  value: number | null;
  /** How to render `value`. */
  format: "months" | "pct" | "ratio";
  /** 0–100 sub-score, or null when the inputs don't exist. */
  score: number | null;
  weight: number;
  /** The reference band, for the "vs healthy" copy. */
  poor: number;
  good: number;
  lowerIsBetter: boolean;
  description: string;
}

export interface HealthReport {
  composite: number; // 0–100
  grade: HealthGrade;
  metrics: HealthMetric[];
  /** Share of the intended weight that had data behind it (0–1). */
  coverage: number;
  /** Short, ranked plain-language notes on the biggest drags. */
  flags: string[];
}

export interface HealthInputs {
  liquidAssets: number; // cash + savings
  totalAssets: number;
  monthlyIncome: number;
  /** Essential (non-discretionary) monthly spend — housing, utilities, food, transport, health. */
  essentialMonthly: number;
  /** This month's savings rate as a fraction (already income-net). */
  savingsRate: number;
  /** Monthly debt service (minimum payments across liabilities). */
  monthlyDebtService: number;
  /** Revolving (credit-card) balance and limit, for utilization. */
  revolvingBalance: number;
  revolvingLimit: number;
  /** Monthly housing spend. */
  housingMonthly: number;
}

/**
 * Piecewise-linear score interpolating `poor`→0 and `good`→100, clamped to
 * [0,100]. Direction is encoded by the anchors themselves: a "lower is better"
 * metric simply passes `poor > good` (e.g. DTI poor 0.43, good 0.10), so no
 * separate flag is needed here.
 */
function bandScore(value: number, poor: number, good: number): number {
  const frac = (value - poor) / (good - poor);
  return Math.round(Math.max(0, Math.min(1, frac)) * 100);
}

function gradeFrom(score: number): HealthGrade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function scoreHealth(inp: HealthInputs): HealthReport {
  const runwayMonths =
    inp.essentialMonthly > 0 ? inp.liquidAssets / inp.essentialMonthly : inp.liquidAssets > 0 ? 12 : null;
  const dti = inp.monthlyIncome > 0 ? inp.monthlyDebtService / inp.monthlyIncome : null;
  const utilization = inp.revolvingLimit > 0 ? inp.revolvingBalance / inp.revolvingLimit : null;
  const liquidity = inp.totalAssets > 0 ? inp.liquidAssets / inp.totalAssets : null;
  const housing = inp.monthlyIncome > 0 ? inp.housingMonthly / inp.monthlyIncome : null;

  // Each metric declares its reference band. `good`/`poor` are the anchors the
  // score interpolates between (poor→0, good→100).
  const metrics: HealthMetric[] = [
    {
      key: "runway",
      label: "Emergency runway",
      value: runwayMonths,
      format: "months",
      weight: 0.3,
      poor: 0,
      good: 6,
      lowerIsBetter: false,
      description: "Months of essential spending your liquid savings could cover. 3–6 months is the standard cushion.",
      score: runwayMonths === null ? null : bandScore(runwayMonths, 0, 6),
    },
    {
      key: "savings",
      label: "Savings rate",
      value: inp.savingsRate,
      format: "pct",
      weight: 0.25,
      poor: 0,
      good: 0.2,
      lowerIsBetter: false,
      description: "Share of income kept this month. 20%+ is a strong, wealth-building pace.",
      score: bandScore(inp.savingsRate, 0, 0.2),
    },
    {
      key: "dti",
      label: "Debt-to-income",
      value: dti,
      format: "pct",
      weight: 0.2,
      poor: 0.43,
      good: 0.1,
      lowerIsBetter: true,
      description: "Monthly debt payments vs income. Under ~36% is comfortable; lenders balk above 43%.",
      score: dti === null ? null : bandScore(dti, 0.43, 0.1),
    },
    {
      key: "utilization",
      label: "Credit utilization",
      value: utilization,
      format: "pct",
      weight: 0.1,
      poor: 0.6,
      good: 0.1,
      lowerIsBetter: true,
      description: "Revolving balance vs limit. Keeping it under 30% (ideally under 10%) protects your score.",
      score: utilization === null ? null : bandScore(utilization, 0.6, 0.1),
    },
    {
      key: "liquidity",
      label: "Liquidity",
      value: liquidity,
      format: "pct",
      weight: 0.1,
      poor: 0.05,
      good: 0.3,
      lowerIsBetter: false,
      description: "Share of assets you can reach quickly. Some illiquidity is healthy; too little leaves no buffer.",
      score: liquidity === null ? null : bandScore(liquidity, 0.05, 0.3),
    },
    {
      key: "housing",
      label: "Housing burden",
      value: housing,
      format: "pct",
      weight: 0.05,
      poor: 0.4,
      good: 0.2,
      lowerIsBetter: true,
      description: "Housing spend vs income. The 30% rule is the classic ceiling.",
      score: housing === null ? null : bandScore(housing, 0.4, 0.2),
    },
  ];

  // Coverage-reweighted composite: drop metrics with no data, renormalize.
  const scored = metrics.filter((m) => m.score !== null);
  const totalWeight = metrics.reduce((s, m) => s + m.weight, 0);
  const liveWeight = scored.reduce((s, m) => s + m.weight, 0);
  const composite =
    liveWeight > 0 ? scored.reduce((s, m) => s + (m.score as number) * m.weight, 0) / liveWeight : 0;
  const coverage = totalWeight > 0 ? liveWeight / totalWeight : 0;

  // Flags: the lowest-scoring metrics that have data, most-dragging first.
  const flags = scored
    .filter((m) => (m.score as number) < 55)
    .sort((a, b) => (a.score as number) - (b.score as number))
    .slice(0, 3)
    .map((m) => flagFor(m));

  return {
    composite: Math.round(composite),
    grade: gradeFrom(composite),
    metrics,
    coverage,
    flags,
  };
}

function flagFor(m: HealthMetric): string {
  switch (m.key) {
    case "runway":
      return `Emergency runway is thin (${(m.value ?? 0).toFixed(1)} mo) — aim for 3–6 months of essentials.`;
    case "savings":
      return `Savings rate is low (${Math.round((m.value ?? 0) * 100)}%) — even 10–15% compounds fast.`;
    case "dti":
      return `Debt service is heavy (${Math.round((m.value ?? 0) * 100)}% of income) — paying down frees cash flow.`;
    case "utilization":
      return `Credit utilization is high (${Math.round((m.value ?? 0) * 100)}%) — under 30% helps your score.`;
    case "liquidity":
      return `Little of your wealth is liquid (${Math.round((m.value ?? 0) * 100)}%) — keep an accessible buffer.`;
    case "housing":
      return `Housing takes a large share (${Math.round((m.value ?? 0) * 100)}%) of income.`;
    default:
      return m.label;
  }
}
