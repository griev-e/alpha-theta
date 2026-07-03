import { describe, expect, it } from "vitest";
import { analyzeSpending } from "./spending";
import type { Transaction } from "./data";

const NOW = new Date("2026-06-15T00:00:00Z");

const tx = (date: string, amount: number, category: Transaction["category"], merchant = "m"): Transaction => ({
  id: `${date}-${amount}-${merchant}`,
  date,
  merchant,
  category,
  account: "chk",
  amount,
});

describe("analyzeSpending", () => {
  it("builds per-category trailing series and ranks the current month", () => {
    // Dining ~200/mo for months, then a 600 spike in June.
    const txs: Transaction[] = [];
    for (let m = 1; m <= 5; m++) txs.push(tx(`2026-0${m}-10`, -200, "Food & Dining"));
    txs.push(tx("2026-06-10", -600, "Food & Dining"));
    const r = analyzeSpending(txs, { now: NOW });
    const dining = r.trends.find((t) => t.category === "Food & Dining")!;
    expect(dining.current).toBe(600);
    expect(dining.trailingMean).toBeCloseTo(200, 0);
    expect(dining.percentile).toBeGreaterThanOrEqual(0.9);
    expect(dining.deltaVsMean).toBeGreaterThan(1); // 200%+ over
  });

  it("flags a category running hot against its own history", () => {
    const txs: Transaction[] = [];
    for (let m = 1; m <= 5; m++) txs.push(tx(`2026-0${m}-10`, -200, "Shopping"));
    txs.push(tx("2026-06-10", -900, "Shopping"));
    const r = analyzeSpending(txs, { now: NOW });
    expect(r.anomalies.length).toBeGreaterThan(0);
    expect(r.anomalies[0].category).toBe("Shopping");
    expect(r.anomalies[0].note).toMatch(/above its usual/);
  });

  it("does not flag steady spending or tiny blips", () => {
    const txs: Transaction[] = [];
    for (let m = 1; m <= 6; m++) txs.push(tx(`2026-0${m}-10`, -200, "Utilities"));
    txs.push(tx("2026-06-11", -12, "Entertainment")); // tiny, low history
    const r = analyzeSpending(txs, { now: NOW });
    expect(r.anomalies).toHaveLength(0);
  });

  it("excludes income and transfers from spending", () => {
    const txs = [tx("2026-06-01", 5000, "Income"), tx("2026-06-02", -500, "Transfer")];
    const r = analyzeSpending(txs, { now: NOW });
    expect(r.trends).toHaveLength(0);
    expect(r.monthTotal).toBe(0);
  });
});
