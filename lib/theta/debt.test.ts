import { describe, expect, it } from "vitest";
import { debtLines, planDebtPayoff } from "./debt";
import { DEFAULT_ASSUMPTIONS } from "./assumptions";
import type { Account } from "./data";

const NOW = new Date("2026-01-01T00:00:00Z");

const acct = (over: Partial<Account>): Account => ({
  id: "a",
  name: "Card",
  institution: "x",
  kind: "credit",
  balance: -1000,
  trend: [],
  mask: "1",
  ...over,
});

describe("debtLines", () => {
  it("extracts liabilities with a positive balance and resolves APRs", () => {
    const accounts = [
      acct({ id: "amex", kind: "credit", balance: -2000 }),
      acct({ id: "auto", kind: "loan", balance: -8000, apr: 0.05 }),
      acct({ id: "chk", kind: "checking", balance: 5000 }),
    ];
    const lines = debtLines(accounts, DEFAULT_ASSUMPTIONS);
    expect(lines).toHaveLength(2); // checking excluded
    expect(lines.find((l) => l.id === "amex")!.apr).toBe(DEFAULT_ASSUMPTIONS.creditApr);
    expect(lines.find((l) => l.id === "auto")!.apr).toBe(0.05); // explicit rate wins
    expect(lines.every((l) => l.balance > 0)).toBe(true);
  });
});

describe("planDebtPayoff", () => {
  const lines = debtLines(
    [
      acct({ id: "amex", kind: "credit", balance: -3000, apr: 0.24 }),
      acct({ id: "store", kind: "credit", balance: -800, apr: 0.28 }),
      acct({ id: "auto", kind: "loan", balance: -6000, apr: 0.06 }),
    ],
    DEFAULT_ASSUMPTIONS
  );

  it("retires all debt and dates the payoff", () => {
    const plan = planDebtPayoff(lines, 800, "avalanche", NOW);
    expect(plan.months).toBeGreaterThan(0);
    expect(plan.months).toBeLessThan(200);
    expect(plan.payoffDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(plan.schedule[plan.schedule.length - 1].remaining).toBeLessThan(1);
    expect(plan.underMinimum).toBe(false);
  });

  it("avalanche pays less total interest than snowball", () => {
    const av = planDebtPayoff(lines, 800, "avalanche", NOW);
    const sn = planDebtPayoff(lines, 800, "snowball", NOW);
    expect(av.totalInterest).toBeLessThanOrEqual(sn.totalInterest);
  });

  it("a bigger budget clears debt faster and cheaper", () => {
    const small = planDebtPayoff(lines, 500, "avalanche", NOW);
    const big = planDebtPayoff(lines, 1200, "avalanche", NOW);
    expect(big.months).toBeLessThan(small.months);
    expect(big.totalInterest).toBeLessThan(small.totalInterest);
  });

  it("flags a budget below the minimum payments", () => {
    const plan = planDebtPayoff(lines, 50, "avalanche", NOW);
    expect(plan.underMinimum).toBe(true);
    expect(plan.payoffDate).toBeNull();
  });

  it("snowball clears the smallest balance first", () => {
    const plan = planDebtPayoff(lines, 800, "snowball", NOW);
    const store = plan.perAccount.find((p) => p.id === "store")!;
    const auto = plan.perAccount.find((p) => p.id === "auto")!;
    expect(store.months).toBeLessThan(auto.months);
  });
});
