import { describe, expect, it } from "vitest";
import { buildCashFlowSankey } from "./sankey";
import { type Ledger, SAMPLE_LEDGER } from "./data";

const NOW = new Date("2026-06-27T12:00:00Z");

const empty = (over: Partial<Ledger> = {}): Ledger => ({
  accounts: [],
  transactions: [],
  budgets: [],
  goals: [],
  recurring: [],
  netWorthHistory: [],
  flowHistory: [],
  ...over,
});

describe("buildCashFlowSankey", () => {
  it("returns null when there's no inflow to draw", () => {
    expect(buildCashFlowSankey(empty(), NOW)).toBeNull();
  });

  it("conserves flow: every column sums to the same total", () => {
    const s = buildCashFlowSankey(SAMPLE_LEDGER, NOW)!;
    expect(s).not.toBeNull();
    for (const col of s.columns) {
      const colTotal = col.reduce((acc, n) => acc + n.value, 0);
      expect(colTotal).toBeCloseTo(s.total, 2);
    }
  });

  it("routes a surplus into a 'Saved' node and no deficit source", () => {
    const l = empty({
      transactions: [
        { id: "p", date: "2026-06-01", merchant: "Payroll", category: "Income", account: "chk", amount: 5000 },
        { id: "r", date: "2026-06-02", merchant: "Rent", category: "Housing", account: "chk", amount: -2000 },
      ],
    });
    const s = buildCashFlowSankey(l, NOW)!;
    expect(s.net).toBeCloseTo(3000, 2);
    expect(s.total).toBeCloseTo(5000, 2);
    expect(s.columns[2].find((n) => n.id === "saved")?.value).toBeCloseTo(3000, 2);
    expect(s.columns[0].some((n) => n.id === "draw")).toBe(false);
  });

  it("models a deficit as an inflow drawn from savings so ribbons still balance", () => {
    const l = empty({
      transactions: [
        { id: "p", date: "2026-06-01", merchant: "Payroll", category: "Income", account: "chk", amount: 2000 },
        { id: "r", date: "2026-06-02", merchant: "Rent", category: "Housing", account: "chk", amount: -3000 },
      ],
    });
    const s = buildCashFlowSankey(l, NOW)!;
    expect(s.net).toBeCloseTo(-1000, 2);
    // Inflow = income 2000 + drawdown 1000 = 3000 = outflow (Housing 3000).
    expect(s.total).toBeCloseTo(3000, 2);
    expect(s.columns[0].find((n) => n.id === "draw")?.value).toBeCloseTo(1000, 2);
    expect(s.columns[2].some((n) => n.id === "saved")).toBe(false);
  });

  it("groups income by merchant and folds the long tail into 'Other income'", () => {
    const txs = Array.from({ length: 9 }, (_, i) => ({
      id: `i${i}`,
      date: "2026-06-01",
      merchant: `Source ${i}`,
      category: "Income" as const,
      account: "chk",
      amount: 1000 - i * 10,
    }));
    const s = buildCashFlowSankey(empty({ transactions: txs }), NOW)!;
    // 6 named sources + one "Other income" fold.
    expect(s.columns[0].filter((n) => n.id.startsWith("src:")).length).toBe(7);
    expect(s.columns[0].some((n) => n.id === "src:other")).toBe(true);
  });

  it("excludes hidden accounts and categories", () => {
    const l = empty({
      transactions: [
        { id: "p", date: "2026-06-01", merchant: "Payroll", category: "Income", account: "chk", amount: 4000 },
        { id: "b", date: "2026-06-02", merchant: "Stock Buy", category: "Other", account: "bkr", amount: -3000 },
      ],
      hiddenAccounts: ["bkr"],
    });
    const s = buildCashFlowSankey(l, NOW)!;
    // The brokerage outflow is hidden, so it's all income → saved.
    expect(s.total).toBeCloseTo(4000, 2);
    expect(s.columns[2].every((n) => n.id !== "cat:Other")).toBe(true);
  });
});
