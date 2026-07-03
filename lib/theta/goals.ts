/**
 * theta — goal feasibility.
 *
 * A `Goal` stores only target / saved / monthly / targetDate; the goals page
 * used to just draw `saved / target`. This turns that display into analysis:
 * how many months the current pace needs, the date it projects to, the
 * contribution required to hit the stated date, an on-track/behind status, and
 * a probability of success from a light Monte Carlo.
 *
 * Goal pots are modeled as **short-horizon savings** — cash / short bonds, not
 * the equity book — so growth compounds at the assumed cash yield and the MC
 * uses a low volatility (`GOAL_VOL`), not the invested-asset sigma. That keeps
 * the success probability honest: a two-year down-payment fund shouldn't inherit
 * a stock portfolio's swing. All pure; `now` is explicit.
 */

import { mulberry32 } from "@/lib/analytics/mathUtils";
import type { ThetaAssumptions } from "./assumptions";
import type { Goal } from "./data";

/** Assumed annualized volatility of a goal savings pot (short-horizon, cash-like). */
export const GOAL_VOL = 0.05;

export type GoalStatus = "funded" | "on-track" | "behind" | "at-risk" | "no-contribution";

export interface GoalFeasibility {
  id: string;
  name: string;
  target: number;
  saved: number;
  monthly: number;
  targetDate: string;
  accent: string;
  remaining: number;
  fundedPct: number;
  /** Whole months from now until the stated target date (null if undated/past). */
  monthsUntilTarget: number | null;
  /** Months to reach the target at the current pace + yield (null if never). */
  projectedMonths: number | null;
  /** ISO date the goal projects to complete, or null if it never does. */
  projectedDate: string | null;
  /** Monthly contribution needed to hit the target by the stated date. */
  requiredMonthly: number | null;
  status: GoalStatus;
  /** Probability of reaching the target by the stated date (null if undated). */
  successProb: number | null;
}

const MONTH_MS = 30.44 * 24 * 3600 * 1000;

function monthsBetween(from: Date, toISO: string): number | null {
  const to = new Date(`${toISO}T00:00:00`);
  if (Number.isNaN(to.getTime())) return null;
  return Math.round((to.getTime() - from.getTime()) / MONTH_MS);
}

function addMonthsISO(from: Date, months: number): string {
  const d = new Date(from.getFullYear(), from.getMonth() + months, from.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Future value of `saved` plus `monthly` contributions after `n` months at monthly rate `r`. */
function fv(saved: number, monthly: number, r: number, n: number): number {
  if (n <= 0) return saved;
  if (Math.abs(r) < 1e-12) return saved + monthly * n;
  const g = Math.pow(1 + r, n);
  return saved * g + monthly * ((g - 1) / r);
}

export function assessGoal(
  goal: Goal,
  a: ThetaAssumptions,
  now: Date = new Date()
): GoalFeasibility {
  const r = a.cashYield / 12;
  const remaining = Math.max(0, goal.target - goal.saved);
  const fundedPct = goal.target > 0 ? goal.saved / goal.target : 1;
  const monthsUntilTarget = monthsBetween(now, goal.targetDate);

  // Months to reach the target at the current pace (cap the search at 100y).
  let projectedMonths: number | null = null;
  if (goal.saved >= goal.target) {
    projectedMonths = 0;
  } else if (goal.monthly > 0 || r > 0) {
    for (let n = 1; n <= 1200; n++) {
      if (fv(goal.saved, goal.monthly, r, n) >= goal.target) {
        projectedMonths = n;
        break;
      }
    }
  }
  const projectedDate = projectedMonths === null ? null : addMonthsISO(now, projectedMonths);

  // Contribution required to hit the stated date.
  let requiredMonthly: number | null = null;
  if (monthsUntilTarget !== null && monthsUntilTarget > 0) {
    const g = Math.pow(1 + r, monthsUntilTarget);
    const grownSaved = goal.saved * g;
    if (grownSaved >= goal.target) {
      requiredMonthly = 0;
    } else {
      const annuityFactor = Math.abs(r) < 1e-12 ? monthsUntilTarget : (g - 1) / r;
      requiredMonthly = (goal.target - grownSaved) / annuityFactor;
    }
  }

  const successProb =
    monthsUntilTarget !== null && monthsUntilTarget > 0
      ? successProbability(goal, r, monthsUntilTarget)
      : goal.saved >= goal.target
        ? 1
        : null;

  const status = classify(goal, monthsUntilTarget, requiredMonthly);

  return {
    id: goal.id,
    name: goal.name,
    target: goal.target,
    saved: goal.saved,
    monthly: goal.monthly,
    targetDate: goal.targetDate,
    accent: goal.accent,
    remaining,
    fundedPct,
    monthsUntilTarget,
    projectedMonths,
    projectedDate,
    requiredMonthly,
    status,
    successProb,
  };
}

function classify(
  goal: Goal,
  monthsUntilTarget: number | null,
  requiredMonthly: number | null
): GoalStatus {
  if (goal.saved >= goal.target) return "funded";
  if (goal.monthly <= 0) return "no-contribution";
  if (monthsUntilTarget === null || requiredMonthly === null) return "on-track";
  // Contributing enough (with a little slack) to hit the date → on track.
  if (goal.monthly >= requiredMonthly * 0.98) return "on-track";
  // Within reach with a modest bump vs badly short.
  return goal.monthly >= requiredMonthly * 0.6 ? "behind" : "at-risk";
}

/** Light seeded MC: fraction of paths whose pot reaches the target by the date. */
function successProbability(goal: Goal, r: number, months: number, paths = 1200): number {
  const dt = 1 / 12;
  const sigma = GOAL_VOL;
  const drift = r - 0.5 * sigma * sigma * dt; // per-month log drift around the cash rate
  const diffusion = sigma * Math.sqrt(dt);
  const seed =
    (Math.round(goal.target) ^ (Math.round(goal.saved) << 3) ^ Math.round(goal.monthly * 13) ^ (months << 10)) >>> 0;
  const rnd = mulberry32(seed || 7);
  let spare: number | null = null;
  const normal = () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    while (u === 0) u = rnd();
    const v = rnd();
    const rr = Math.sqrt(-2 * Math.log(u));
    spare = rr * Math.sin(2 * Math.PI * v);
    return rr * Math.cos(2 * Math.PI * v);
  };

  let hits = 0;
  for (let p = 0; p < paths; p++) {
    let pot = goal.saved;
    for (let m = 0; m < months; m++) {
      pot = pot * Math.exp(drift + diffusion * normal()) + goal.monthly;
    }
    if (pot >= goal.target) hits++;
  }
  return hits / paths;
}

export const assessGoals = (goals: Goal[], a: ThetaAssumptions, now: Date = new Date()): GoalFeasibility[] =>
  goals.map((g) => assessGoal(g, a, now));
