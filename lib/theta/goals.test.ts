import { describe, expect, it } from "vitest";
import { assessGoal } from "./goals";
import { DEFAULT_ASSUMPTIONS } from "./assumptions";
import type { Goal } from "./data";

const NOW = new Date("2026-01-01T00:00:00Z");

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: "g",
  name: "Test",
  target: 12000,
  saved: 0,
  monthly: 1000,
  targetDate: "2027-01-01",
  accent: "#fff",
  ...over,
});

describe("assessGoal", () => {
  it("marks a fully-saved goal funded with certainty", () => {
    const r = assessGoal(goal({ saved: 12000 }), DEFAULT_ASSUMPTIONS, NOW);
    expect(r.status).toBe("funded");
    expect(r.fundedPct).toBeGreaterThanOrEqual(1);
    expect(r.successProb).toBe(1);
    expect(r.projectedMonths).toBe(0);
  });

  it("projects ~12 months to reach a 12k goal at 1k/mo", () => {
    const r = assessGoal(goal(), DEFAULT_ASSUMPTIONS, NOW);
    // Cash yield helps slightly, so it lands at or just under 12 months.
    expect(r.projectedMonths).toBeGreaterThan(10);
    expect(r.projectedMonths).toBeLessThanOrEqual(12);
    expect(r.projectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("computes the contribution required to hit the date", () => {
    const r = assessGoal(goal({ monthly: 0 }), DEFAULT_ASSUMPTIONS, NOW);
    // 12 months to save 12000 ≈ ~1000/mo (a touch less with yield).
    expect(r.requiredMonthly).toBeGreaterThan(900);
    expect(r.requiredMonthly).toBeLessThan(1000);
    expect(r.status).toBe("no-contribution");
  });

  it("flags a badly-underfunded goal as at-risk", () => {
    const r = assessGoal(goal({ monthly: 100 }), DEFAULT_ASSUMPTIONS, NOW);
    expect(r.status).toBe("at-risk");
    expect(r.successProb).toBeLessThan(0.5);
  });

  it("marks an adequately-funded pace on-track with high probability", () => {
    const r = assessGoal(goal({ monthly: 1100 }), DEFAULT_ASSUMPTIONS, NOW);
    expect(r.status).toBe("on-track");
    expect(r.successProb!).toBeGreaterThan(0.5);
  });
});
