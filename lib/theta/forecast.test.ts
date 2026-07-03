import { describe, expect, it } from "vitest";
import { forecastCashFlow } from "./forecast";
import type { Recurring } from "./data";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("forecastCashFlow", () => {
  it("projects a rising balance when income exceeds spend", () => {
    const r = forecastCashFlow({
      liquid: 5000,
      recurring: [],
      discretionaryMonthly: 2000,
      monthlyIncome: 5000,
      days: 30,
      now: NOW,
    });
    expect(r.endBalance).toBeGreaterThan(5000);
    expect(r.netChange).toBeGreaterThan(0);
    expect(r.runwayDays).toBeNull(); // not declining
    expect(r.lowBalanceDate).toBeNull();
  });

  it("drops the balance on a scheduled recurring charge", () => {
    const rent: Recurring = { id: "rent", name: "Rent", category: "Housing", amount: 2000, cadence: "monthly", nextDate: "2026-06-05" };
    const r = forecastCashFlow({
      liquid: 3000,
      recurring: [rent],
      discretionaryMonthly: 0,
      monthlyIncome: 0,
      days: 30,
      now: NOW,
    });
    // Rent lands on day 4-5, pushing the balance to 1000.
    expect(r.minBalance).toBeCloseTo(1000, 0);
  });

  it("flags an overdraft date and computes runway when declining", () => {
    const r = forecastCashFlow({
      liquid: 500,
      recurring: [],
      discretionaryMonthly: 3000,
      monthlyIncome: 0,
      days: 30,
      now: NOW,
    });
    expect(r.netChange).toBeLessThan(0);
    expect(r.runwayDays).not.toBeNull();
    expect(r.lowBalanceDate).not.toBeNull();
  });

  it("expands a weekly charge multiple times across the window", () => {
    const sub: Recurring = { id: "s", name: "Weekly", category: "Food & Dining", amount: 100, cadence: "weekly", nextDate: "2026-06-02" };
    const withSub = forecastCashFlow({ liquid: 5000, recurring: [sub], discretionaryMonthly: 0, monthlyIncome: 0, days: 30, now: NOW });
    const without = forecastCashFlow({ liquid: 5000, recurring: [], discretionaryMonthly: 0, monthlyIncome: 0, days: 30, now: NOW });
    // 5 weekly hits of 100 across the 30-day window (Jun 2, 9, 16, 23, 30).
    expect(without.endBalance - withSub.endBalance).toBeCloseTo(500, 0);
  });
});
