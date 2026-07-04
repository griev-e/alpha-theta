import { describe, expect, it } from "vitest";
import {
  categorize,
  CATEGORIZE_RULES,
  learnRules,
  merchantKey,
  suggestCategory,
} from "./categorize";
import type { Transaction } from "./data";

const tx = (merchant: string, category: Transaction["category"], amount = -10): Transaction => ({
  id: merchant + category + amount,
  date: "2026-06-01",
  merchant,
  category,
  account: "chk",
  amount,
});

describe("categorize", () => {
  it("matches common merchants to their category", () => {
    expect(categorize("Whole Foods Market")).toBe("Food & Dining");
    expect(categorize("UBER *TRIP")).toBe("Transport");
    expect(categorize("Netflix.com")).toBe("Subscriptions");
    expect(categorize("ConEdison")).toBe("Utilities");
    expect(categorize("CVS/PHARMACY #1234")).toBe("Health");
    expect(categorize("AMC THEATRES")).toBe("Entertainment");
    expect(categorize("Amazon.com")).toBe("Shopping");
  });

  it("treats payroll/interest as income regardless of casing", () => {
    expect(categorize("ACME CORP PAYROLL")).toBe("Income");
    expect(categorize("Interest Earned")).toBe("Income");
  });

  it("treats moves between accounts as transfers", () => {
    expect(categorize("Transfer to Savings")).toBe("Transfer");
    expect(categorize("Venmo cashout")).toBe("Transfer");
  });

  it("falls back to Other for unknown merchants", () => {
    expect(categorize("Zorp Industries LLC")).toBe("Other");
    expect(categorize("")).toBe("Other");
  });

  it("prefers the first matching rule (specific before generic)", () => {
    // "apple store" is Shopping; income keywords should not be reachable here.
    expect(categorize("APPLE STORE R123")).toBe("Shopping");
    expect(CATEGORIZE_RULES.length).toBeGreaterThan(0);
  });
});

describe("merchantKey", () => {
  it("strips processor prefixes, store numbers and punctuation", () => {
    expect(merchantKey("SQ *BLUE BOTTLE 041")).toBe("blue bottle");
    expect(merchantKey("TST* Sweetgreen #123")).toBe("sweetgreen");
    expect(merchantKey("AMAZON.COM*A12BC")).toBe("amazon com a bc");
  });

  it("collapses variants of the same merchant to one key", () => {
    expect(merchantKey("Blue Bottle Coffee #12")).toBe(merchantKey("SQ *BLUE BOTTLE COFFEE 998"));
  });
});

describe("learnRules", () => {
  it("learns a merchant's category from confirmed history and ignores Other", () => {
    const rules = learnRules([
      tx("Joe's Diner", "Food & Dining"),
      tx("Joe's Diner", "Food & Dining"),
      tx("Mystery LLC", "Other"),
    ]);
    expect(rules.get(merchantKey("Joe's Diner"))?.category).toBe("Food & Dining");
    expect(rules.get(merchantKey("Joe's Diner"))?.count).toBe(2);
    expect(rules.has(merchantKey("Mystery LLC"))).toBe(false);
  });

  it("takes the majority category when a merchant was tagged inconsistently", () => {
    const rules = learnRules([
      tx("Corner Store", "Shopping"),
      tx("Corner Store", "Shopping"),
      tx("Corner Store", "Food & Dining"),
    ]);
    const r = rules.get(merchantKey("Corner Store"));
    expect(r?.category).toBe("Shopping");
    expect(r?.confidence).toBeCloseTo(2 / 3, 5);
  });
});

describe("suggestCategory", () => {
  it("prefers learned history over the keyword table", () => {
    // "Apple Store" would key to Shopping, but the user always tags it Health here.
    const learned = learnRules([
      tx("Apple Store", "Health"),
      tx("Apple Store", "Health"),
      tx("Apple Store", "Health"),
      tx("Apple Store", "Health"),
    ]);
    const s = suggestCategory("Apple Store #42", -50, learned);
    expect(s.category).toBe("Health");
    expect(s.source).toBe("history");
    expect(s.confidence).toBeGreaterThan(0.85);
  });

  it("falls back to keyword rules with a confidence and source", () => {
    const s = suggestCategory("Netflix.com", -15.49);
    expect(s.category).toBe("Subscriptions");
    expect(s.source).toBe("keyword");
    expect(s.confidence).toBeGreaterThan(0.5);
  });

  it("guesses income for an unmatched deposit, Other for an unmatched charge", () => {
    expect(suggestCategory("Zorp Industries LLC", 900).category).toBe("Income");
    expect(suggestCategory("Zorp Industries LLC", 900).source).toBe("amount");
    expect(suggestCategory("Zorp Industries LLC", -40).category).toBe("Other");
    expect(suggestCategory("Zorp Industries LLC", -40).confidence).toBe(0);
  });
});
