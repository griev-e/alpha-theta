import { describe, expect, it } from "vitest";
import { EMPTY_LEDGER, type Account, type Ledger, type Transaction } from "./data";
import { mergeSimplefinSync } from "./simplefinMerge";

const acct = (id: string, balance: number, over: Partial<Account> = {}): Account => ({
  id,
  name: id,
  institution: "Bank",
  kind: "checking",
  balance,
  trend: [1, 2, 3, 4, 5, 6, 7],
  mask: "0000",
  ...over,
});

const tx = (id: string, over: Partial<Transaction> = {}): Transaction => ({
  id,
  date: "2026-07-01",
  merchant: "ATM Fee",
  category: "Other",
  account: "sf:a",
  amount: -3,
  ...over,
});

const ledgerWith = (over: Partial<Ledger>): Ledger => ({ ...EMPTY_LEDGER, ...over });

describe("mergeSimplefinSync", () => {
  it("preserves a manual re-tag when the same transaction is re-synced", () => {
    const ledger = ledgerWith({
      accounts: [acct("sf:a", 100)],
      // The user hand-tagged the ATM Fee as Transfer; the ledger is the truth.
      transactions: [tx("sf:a:t1", { category: "Transfer" })],
    });
    // The server re-derives "Other" (no keyword matches "ATM Fee").
    const sync = { accounts: [acct("sf:a", 120)], transactions: [tx("sf:a:t1", { category: "Other", amount: -3.5 })] };

    const { transactions } = mergeSimplefinSync(ledger, sync);
    const t = transactions.find((x) => x.id === "sf:a:t1");
    expect(t?.category).toBe("Transfer"); // kept the manual tag
    expect(t?.amount).toBe(-3.5); // but took the fresh amount
  });

  it("does not resurrect a deleted (dismissed) account or its transactions", () => {
    const ledger = ledgerWith({ accounts: [], transactions: [], dismissedSyncAccounts: ["sf:gone"] });
    const sync = {
      accounts: [acct("sf:gone", 500), acct("sf:keep", 200)],
      transactions: [tx("sf:gone:t1", { account: "sf:gone" }), tx("sf:keep:t1", { account: "sf:keep" })],
    };

    const { accounts, transactions } = mergeSimplefinSync(ledger, sync);
    expect(accounts.map((a) => a.id)).toEqual(["sf:keep"]);
    expect(transactions.map((t) => t.id)).toEqual(["sf:keep:t1"]);
  });

  it("upserts a seen account and extends its trend instead of resetting it", () => {
    const ledger = ledgerWith({ accounts: [acct("sf:a", 100, { trend: [10, 20, 30, 40, 50, 60, 70] })] });
    const { accounts } = mergeSimplefinSync(ledger, { accounts: [acct("sf:a", 80)], transactions: [] });
    const a = accounts.find((x) => x.id === "sf:a")!;
    expect(a.balance).toBe(80);
    expect(a.trend).toEqual([20, 30, 40, 50, 60, 70, 80]); // slid window, newest appended
  });

  it("keeps manual (non-synced) transactions and new synced ones", () => {
    const ledger = ledgerWith({
      accounts: [acct("sf:a", 100)],
      transactions: [tx("manual1", { account: "chk", date: "2026-06-15" })],
    });
    const sync = { accounts: [acct("sf:a", 100)], transactions: [tx("sf:a:new", { date: "2026-07-02" })] };
    const { transactions } = mergeSimplefinSync(ledger, sync);
    expect(transactions.map((t) => t.id)).toContain("manual1");
    expect(transactions.map((t) => t.id)).toContain("sf:a:new");
    // Sorted newest-first.
    expect(transactions[0].date >= transactions[transactions.length - 1].date).toBe(true);
  });
});
