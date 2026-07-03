import { describe, expect, it } from "vitest";
import { migrateLedger, SAMPLE_LEDGER } from "./data";

describe("migrateLedger", () => {
  it("passes a well-formed ledger through with all arrays intact", () => {
    const out = migrateLedger(SAMPLE_LEDGER)!;
    expect(out.accounts).toHaveLength(SAMPLE_LEDGER.accounts.length);
    expect(out.transactions).toHaveLength(SAMPLE_LEDGER.transactions.length);
  });

  it("fills missing arrays on a shape-drifted ledger", () => {
    const out = migrateLedger({ accounts: [], transactions: [] })!;
    expect(out.budgets).toEqual([]);
    expect(out.goals).toEqual([]);
    expect(out.recurring).toEqual([]);
    expect(out.netWorthHistory).toEqual([]);
    expect(out.flowHistory).toEqual([]);
  });

  it("preserves the new optional account fields (apr, linkedPortfolioId)", () => {
    const out = migrateLedger({
      accounts: [
        { id: "a", name: "x", institution: "y", kind: "credit", balance: -100, trend: [], mask: "1", apr: 0.2 },
        { id: "b", name: "z", institution: "w", kind: "brokerage", balance: 1000, trend: [], mask: "2", linkedPortfolioId: "p1" },
      ],
    })!;
    expect(out.accounts[0].apr).toBe(0.2);
    expect(out.accounts[1].linkedPortfolioId).toBe("p1");
  });

  it("defends against a null trend and non-array fields", () => {
    const out = migrateLedger({
      accounts: [{ id: "a", name: "x", institution: "y", kind: "checking", balance: 5, mask: "1" }],
      transactions: "not-an-array",
    })!;
    expect(out.accounts[0].trend).toEqual([]);
    expect(out.transactions).toEqual([]);
  });

  it("returns null for non-object input", () => {
    expect(migrateLedger(null)).toBeNull();
    expect(migrateLedger("nope")).toBeNull();
  });
});
