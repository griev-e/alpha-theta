import { describe, expect, it } from "vitest";
import { householdRisk } from "./household";

const base = {
  investedExposed: 100_000,
  portfolioBeta: 1.2,
  portfolioVol: 0.2,
  netWorth: 200_000,
  liquidAssets: 30_000,
  monthlySpend: 5_000,
};

describe("householdRisk", () => {
  it("returns null with no exposure or non-positive net worth", () => {
    expect(householdRisk({ ...base, investedExposed: 0 })).toBeNull();
    expect(householdRisk({ ...base, netWorth: 0 })).toBeNull();
  });

  it("beta-scales each market shock onto the exposed sleeve", () => {
    const r = householdRisk(base)!;
    const bear = r.scenarios.find((s) => s.label === "Bear market")!;
    // β1.2 × −20% = −24% portfolio move → −$24k on $100k.
    expect(bear.portfolioShock).toBeCloseTo(-0.24, 6);
    expect(bear.loss).toBeCloseTo(-24_000, 2);
    expect(bear.newNetWorth).toBeCloseTo(176_000, 2);
    expect(bear.netWorthDropPct).toBeCloseTo(-0.12, 6); // 24k / 200k
  });

  it("floors an extreme high-beta move at −95%", () => {
    const r = householdRisk({ ...base, portfolioBeta: 4 })!;
    const crash = r.scenarios.find((s) => s.label === "Severe crash")!;
    // 4 × −35% = −140%, clamped to −95%.
    expect(crash.portfolioShock).toBeCloseTo(-0.95, 6);
    expect(crash.loss).toBeCloseTo(-95_000, 2);
  });

  it("reports liquid runway independent of the market drawdown", () => {
    const r = householdRisk(base)!;
    expect(r.runwayMonths).toBeCloseTo(6, 6); // 30k / 5k
    expect(r.exposurePct).toBeCloseTo(0.5, 6); // 100k / 200k
  });

  it("null runway when there's no spend to divide by", () => {
    expect(householdRisk({ ...base, monthlySpend: 0 })!.runwayMonths).toBeNull();
  });

  it("estimates a typical bad year from volatility", () => {
    expect(householdRisk(base)!.typicalBadYear).toBeCloseTo(20_000, 2); // 100k × 0.20
  });
});
