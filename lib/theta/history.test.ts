import { describe, expect, it } from "vitest";
import {
  accountTrend,
  deriveFlowSeries,
  deriveNetWorthSeries,
  monthlyFlows,
  netWorthTrajectory,
} from "./history";
import type { Account, Transaction } from "./data";

const NOW = new Date("2026-06-27T12:00:00Z");
const all = () => true;

const tx = (date: string, amount: number, category: Transaction["category"], account = "chk"): Transaction => ({
  id: `${date}-${amount}`,
  date,
  merchant: "x",
  category,
  account,
  amount,
});

describe("monthlyFlows", () => {
  it("buckets income and expenses by calendar month and marks coverage", () => {
    const txs = [
      tx("2026-06-01", 4000, "Income"),
      tx("2026-06-10", -1200, "Housing"),
      tx("2026-05-15", 4000, "Income"),
      tx("2026-05-20", -900, "Food & Dining"),
    ];
    const series = monthlyFlows(txs, all, { now: NOW, months: 12 });
    const jun = series.find((p) => p.key === "2026-06")!;
    const may = series.find((p) => p.key === "2026-05")!;
    expect(jun.income).toBe(4000);
    expect(jun.expenses).toBe(1200);
    expect(jun.covered).toBe(true);
    expect(may.income).toBe(4000);
    expect(may.expenses).toBe(900);
    // An untouched month is present but uncovered.
    const apr = series.find((p) => p.key === "2026-04")!;
    expect(apr.covered).toBe(false);
    expect(apr.income).toBe(0);
  });

  it("excludes transfers from both sides but still marks the month covered", () => {
    const txs = [tx("2026-06-01", -500, "Transfer"), tx("2026-06-02", 500, "Transfer", "sav")];
    const jun = monthlyFlows(txs, all, { now: NOW }).find((p) => p.key === "2026-06")!;
    expect(jun.income).toBe(0);
    expect(jun.expenses).toBe(0);
    expect(jun.covered).toBe(true);
  });

  it("honors the included predicate", () => {
    const txs = [tx("2026-06-01", 4000, "Income", "chk"), tx("2026-06-02", 9000, "Other", "bkr")];
    const included = (t: Transaction) => t.account !== "bkr";
    const jun = monthlyFlows(txs, included, { now: NOW }).find((p) => p.key === "2026-06")!;
    expect(jun.income).toBe(4000); // brokerage inflow filtered out
  });
});

describe("netWorthTrajectory", () => {
  const accounts: Account[] = [
    { id: "chk", name: "Checking", institution: "x", kind: "checking", balance: 10000, trend: [], mask: "1" },
  ];

  it("reverse-walks current balance through subsequent transactions", () => {
    // Current balance 10000. In June: +4000 income, −1000 spend (net +3000).
    // So end of May should be 10000 − 3000 = 7000.
    const txs = [tx("2026-06-05", 4000, "Income"), tx("2026-06-20", -1000, "Food & Dining")];
    const series = netWorthTrajectory(accounts, txs, { now: NOW, months: 3 });
    const cur = series[series.length - 1];
    const may = series.find((p) => p.key === "2026-05")!;
    expect(cur.value).toBe(10000); // current point is "as of now"
    expect(may.value).toBe(7000);
  });

  it("nets both legs of an internal transfer to zero across total net worth", () => {
    const txs = [tx("2026-06-05", -500, "Transfer", "chk"), tx("2026-06-05", 500, "Transfer", "sav")];
    const two: Account[] = [
      ...accounts,
      { id: "sav", name: "Savings", institution: "x", kind: "savings", balance: 5000, trend: [], mask: "2" },
    ];
    const series = netWorthTrajectory(two, txs, { now: NOW, months: 2 });
    const may = series.find((p) => p.key === "2026-05")!;
    expect(may.value).toBe(15000); // transfer doesn't move total net worth
  });
});

describe("deriveFlowSeries / deriveNetWorthSeries fallback", () => {
  it("uses stored history for uncovered months and derives covered ones", () => {
    const txs = [tx("2026-06-01", 5000, "Income"), tx("2026-06-10", -2000, "Housing")];
    const storedFlow = [
      { month: "Apr", income: 8000, expenses: 6000 },
      { month: "May", income: 8100, expenses: 5500 },
    ];
    const series = deriveFlowSeries(txs, storedFlow, all, { now: NOW });
    const last = series[series.length - 1];
    expect(last.month).toBe("Jun");
    expect(last.income).toBe(5000); // June derived from transactions
    const may = series.find((p) => p.month === "May")!;
    expect(may.income).toBe(8100); // May uncovered → stored fallback
  });

  it("trims the empty pre-history but keeps the current point", () => {
    const series = deriveFlowSeries([], [], all, { now: NOW });
    expect(series).toHaveLength(1);
    expect(series[0].month).toBe("Jun");
  });

  it("derives a full net-worth series from an imported book with no stored history", () => {
    const accounts: Account[] = [
      { id: "chk", name: "c", institution: "x", kind: "checking", balance: 12000, trend: [], mask: "1" },
    ];
    const txs = [tx("2026-06-05", 3000, "Income"), tx("2026-05-05", 3000, "Income")];
    const series = deriveNetWorthSeries(accounts, txs, [], { now: NOW, months: 3 });
    expect(series[series.length - 1].value).toBe(12000);
    // Two months back (before both incomes) → 12000 − 6000.
    expect(series[0].value).toBe(6000);
  });
});

describe("accountTrend", () => {
  it("reconstructs a per-account sparkline from its own transactions", () => {
    const acct: Account = { id: "chk", name: "c", institution: "x", kind: "checking", balance: 5000, trend: [], mask: "1" };
    const txs = [tx("2026-06-10", 1000, "Income", "chk"), tx("2026-05-10", 500, "Income", "chk")];
    const trend = accountTrend(acct, txs, 4, NOW);
    expect(trend).toHaveLength(4);
    expect(trend[trend.length - 1]).toBe(5000); // ends at current balance
  });

  it("falls back to the stored trend when the account has no transactions", () => {
    const acct: Account = { id: "chk", name: "c", institution: "x", kind: "checking", balance: 5000, trend: [1, 2, 3], mask: "1" };
    expect(accountTrend(acct, [], 4, NOW)).toEqual([1, 2, 3]);
  });
});
