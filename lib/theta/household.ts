/**
 * theta ↔ alpha, deepened.
 *
 * The bridge (`lib/theta/bridge.ts`) already lets a theta account mirror an
 * alpha portfolio's live value. This module goes one step further and reads the
 * portfolio's *risk* — its beta and volatility — to answer the question theta
 * actually cares about: how exposed is my **net worth** to an equity drawdown,
 * and does a bad market threaten my safety net?
 *
 * Pure: it takes plain numbers (the invested value, the portfolio's beta/vol,
 * net worth, liquid savings, monthly spend), so it's trivially testable and
 * carries no alpha/theta store coupling. The caller wires the live values in.
 */

export interface DrawdownScenario {
  label: string;
  /** Broad-market move assumed (e.g. −0.20 for a bear market). */
  marketShock: number;
  /** Beta-scaled move applied to the exposed sleeve, floored at −95%. */
  portfolioShock: number;
  /** Dollar hit to the exposed sleeve (negative). */
  loss: number;
  newNetWorth: number;
  /** loss / netWorth — the share of net worth erased (negative). */
  netWorthDropPct: number;
}

export interface HouseholdRisk {
  /** Market value that moves with the linked portfolio. */
  investedExposed: number;
  /** investedExposed / netWorth — how much of your worth rides the market. */
  exposurePct: number;
  /** Months of spending your *liquid* savings cover — untouched by a drawdown. */
  runwayMonths: number | null;
  /** A rough one-bad-year (−1σ) dollar move on the exposed sleeve (magnitude). */
  typicalBadYear: number;
  scenarios: DrawdownScenario[];
}

/** Reference equity drawdowns, mild → severe. */
const MARKET_SHOCKS: { label: string; shock: number }[] = [
  { label: "Correction", shock: -0.1 },
  { label: "Bear market", shock: -0.2 },
  { label: "Severe crash", shock: -0.35 },
];

export function householdRisk(inputs: {
  investedExposed: number;
  portfolioBeta: number;
  portfolioVol: number;
  netWorth: number;
  liquidAssets: number;
  monthlySpend: number;
}): HouseholdRisk | null {
  const { investedExposed, portfolioBeta, portfolioVol, netWorth, liquidAssets, monthlySpend } = inputs;
  if (investedExposed <= 0 || netWorth <= 0) return null;

  const scenarios: DrawdownScenario[] = MARKET_SHOCKS.map(({ label, shock }) => {
    // Beta scales the market move into a portfolio move; floor at −95% so a
    // high-beta book can't imply a >100% loss.
    const portfolioShock = Math.max(-0.95, portfolioBeta * shock);
    const loss = investedExposed * portfolioShock;
    const newNetWorth = netWorth + loss;
    return {
      label,
      marketShock: shock,
      portfolioShock,
      loss,
      newNetWorth,
      netWorthDropPct: loss / netWorth,
    };
  });

  return {
    investedExposed,
    exposurePct: investedExposed / netWorth,
    runwayMonths: monthlySpend > 0 ? liquidAssets / monthlySpend : null,
    // A one-standard-deviation down year on the exposed sleeve, as a dollar
    // magnitude — the "normal bad year" next to the tail scenarios above.
    typicalBadYear: investedExposed * portfolioVol,
    scenarios,
  };
}
