import { describe, expect, it } from "vitest";
import { detectRecurring, newSubscriptions } from "./detect";
import type { Recurring, Transaction } from "./data";

const tx = (date: string, amount: number, merchant: string, category: Transaction["category"] = "Subscriptions"): Transaction => ({
  id: `${date}-${merchant}`,
  date,
  merchant,
  category,
  account: "amex",
  amount,
});

describe("detectRecurring", () => {
  it("detects a steady monthly subscription", () => {
    const txs = [
      tx("2026-01-05", -15.49, "Netflix"),
      tx("2026-02-05", -15.49, "Netflix"),
      tx("2026-03-05", -15.49, "Netflix"),
      tx("2026-04-05", -15.49, "Netflix"),
    ];
    const found = detectRecurring(txs);
    expect(found).toHaveLength(1);
    expect(found[0].merchant).toBe("Netflix");
    expect(found[0].cadence).toBe("monthly");
    expect(found[0].amount).toBeCloseTo(15.49, 2);
    expect(found[0].annualCost).toBeCloseTo(15.49 * 12, 1);
  });

  it("ignores variable-amount merchants like groceries", () => {
    const txs = [
      tx("2026-01-05", -64, "Whole Foods", "Food & Dining"),
      tx("2026-02-03", -118, "Whole Foods", "Food & Dining"),
      tx("2026-03-14", -42, "Whole Foods", "Food & Dining"),
      tx("2026-04-01", -201, "Whole Foods", "Food & Dining"),
    ];
    expect(detectRecurring(txs)).toHaveLength(0);
  });

  it("requires a minimum number of charges", () => {
    const txs = [tx("2026-01-05", -9.99, "Spotify"), tx("2026-02-05", -9.99, "Spotify")];
    expect(detectRecurring(txs)).toHaveLength(0);
  });

  it("surfaces price creep when the amount trends up", () => {
    const txs = [
      tx("2026-01-05", -15.49, "Netflix"),
      tx("2026-02-05", -15.49, "Netflix"),
      tx("2026-03-05", -17.99, "Netflix"),
      tx("2026-04-05", -17.99, "Netflix"),
    ];
    const found = detectRecurring(txs);
    expect(found[0].priceCreep).toBeDefined();
    expect(found[0].priceCreep!.from).toBeCloseTo(15.49, 2);
    expect(found[0].priceCreep!.to).toBeCloseTo(17.99, 2);
    expect(found[0].priceCreep!.pctChange).toBeGreaterThan(0);
  });

  it("detects a weekly cadence", () => {
    const txs = [
      tx("2026-06-01", -20, "Gym"),
      tx("2026-06-08", -20, "Gym"),
      tx("2026-06-15", -20, "Gym"),
      tx("2026-06-22", -20, "Gym"),
    ];
    expect(detectRecurring(txs)[0].cadence).toBe("weekly");
  });
});

describe("newSubscriptions", () => {
  it("returns only detected charges not already tracked", () => {
    const detected = detectRecurring([
      tx("2026-01-05", -15.49, "Netflix"),
      tx("2026-02-05", -15.49, "Netflix"),
      tx("2026-03-05", -15.49, "Netflix"),
      tx("2026-01-06", -9.99, "Spotify"),
      tx("2026-02-06", -9.99, "Spotify"),
      tx("2026-03-06", -9.99, "Spotify"),
    ]);
    const tracked: Recurring[] = [
      { id: "n", name: "Netflix", category: "Subscriptions", amount: 15.49, cadence: "monthly", nextDate: "2026-04-05" },
    ];
    const fresh = newSubscriptions(detected, tracked);
    expect(fresh.map((d) => d.merchant)).toEqual(["Spotify"]);
  });
});
