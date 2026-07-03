import { describe, expect, it } from "vitest";
import { applyPortfolioLinks, hasPortfolioLinks } from "./bridge";
import type { Account, Ledger } from "./data";

const acct = (over: Partial<Account>): Account => ({
  id: "a",
  name: "Brokerage",
  institution: "Fidelity",
  kind: "brokerage",
  balance: 50000,
  trend: [40000, 45000, 50000],
  mask: "1",
  ...over,
});

const ledger = (accounts: Account[]): Ledger => ({
  accounts,
  transactions: [],
  budgets: [],
  goals: [],
  recurring: [],
  netWorthHistory: [],
  flowHistory: [],
});

describe("applyPortfolioLinks", () => {
  it("overrides a linked account's balance with the live portfolio value", () => {
    const l = ledger([acct({ id: "bkr", linkedPortfolioId: "p1", balance: 50000 })]);
    const out = applyPortfolioLinks(l, new Map([["p1", 63210.5]]));
    expect(out.accounts[0].balance).toBe(63210.5);
    // Trend tail is nudged to the live value, keeping the sparkline continuous.
    expect(out.accounts[0].trend[out.accounts[0].trend.length - 1]).toBe(63210.5);
  });

  it("leaves unlinked accounts and unresolved links untouched", () => {
    const l = ledger([
      acct({ id: "bkr", linkedPortfolioId: "p2", balance: 50000 }), // no live value for p2
      acct({ id: "chk", kind: "checking", balance: 8000 }),
    ]);
    const out = applyPortfolioLinks(l, new Map([["p1", 99999]]));
    expect(out).toBe(l); // no changes → same reference
    expect(out.accounts[0].balance).toBe(50000);
    expect(out.accounts[1].balance).toBe(8000);
  });

  it("returns the same ledger when there are no links at all", () => {
    const l = ledger([acct({ id: "bkr" })]);
    expect(applyPortfolioLinks(l, new Map([["p1", 100]]))).toBe(l);
  });

  it("does not churn identity when the live value equals the current balance", () => {
    const l = ledger([acct({ id: "bkr", linkedPortfolioId: "p1", balance: 50000 })]);
    expect(applyPortfolioLinks(l, new Map([["p1", 50000]]))).toBe(l);
  });
});

describe("hasPortfolioLinks", () => {
  it("detects a linked account", () => {
    expect(hasPortfolioLinks(ledger([acct({ linkedPortfolioId: "p1" })]))).toBe(true);
    expect(hasPortfolioLinks(ledger([acct({})]))).toBe(false);
    expect(hasPortfolioLinks(null)).toBe(false);
  });
});
