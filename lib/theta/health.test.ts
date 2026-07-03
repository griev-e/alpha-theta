import { describe, expect, it } from "vitest";
import { scoreHealth, type HealthInputs } from "./health";

const strong: HealthInputs = {
  liquidAssets: 40000,
  totalAssets: 120000,
  monthlyIncome: 8000,
  essentialMonthly: 4000, // 10 months runway
  savingsRate: 0.3,
  monthlyDebtService: 400, // 5% DTI
  revolvingBalance: 200,
  revolvingLimit: 10000, // 2% utilization
  housingMonthly: 1600, // 20%
};

const weak: HealthInputs = {
  liquidAssets: 1000,
  totalAssets: 60000,
  monthlyIncome: 5000,
  essentialMonthly: 3500, // <1 month runway
  savingsRate: 0.02,
  monthlyDebtService: 2000, // 40% DTI
  revolvingBalance: 4500,
  revolvingLimit: 5000, // 90% utilization
  housingMonthly: 2200, // 44%
};

describe("scoreHealth", () => {
  it("scores a strong balance sheet highly", () => {
    const r = scoreHealth(strong);
    expect(r.composite).toBeGreaterThan(80);
    expect(["A", "B"]).toContain(r.grade);
    expect(r.flags).toHaveLength(0);
    expect(r.coverage).toBeCloseTo(1, 6);
  });

  it("scores a stressed balance sheet poorly and flags the worst metrics", () => {
    const r = scoreHealth(weak);
    expect(r.composite).toBeLessThan(45);
    expect(["D", "F"]).toContain(r.grade);
    expect(r.flags.length).toBeGreaterThan(0);
    // Flags are the (up to 3) worst-scoring metrics; 90% utilization bottoms out.
    expect(r.flags.some((f) => /utilization/i.test(f))).toBe(true);
  });

  it("drops metrics with no inputs and renormalizes coverage", () => {
    const partial: HealthInputs = {
      ...strong,
      revolvingLimit: 0, // no utilization data
      monthlyIncome: 0, // kills DTI + housing + (savings still passed directly)
    };
    const r = scoreHealth(partial);
    expect(r.coverage).toBeLessThan(1);
    const util = r.metrics.find((m) => m.key === "utilization")!;
    expect(util.score).toBeNull();
  });

  it("rewards a high savings rate", () => {
    const low = scoreHealth({ ...strong, savingsRate: 0 });
    const high = scoreHealth({ ...strong, savingsRate: 0.4 });
    expect(high.composite).toBeGreaterThan(low.composite);
  });
});
