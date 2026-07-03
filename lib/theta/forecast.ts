/**
 * theta — short-horizon cash-flow forecast.
 *
 * Projects the liquid cash balance forward day by day so the dashboard can warn
 * before a scheduled charge overdraws the account, and put a number on runway.
 * The model is deliberately transparent:
 *
 *  - a smooth daily **baseline drift** = (expected monthly income − discretionary
 *    monthly spend) ÷ ~30.44, applied every day — the steady in/out that isn't a
 *    named recurring bill;
 *  - discrete **recurring charges** dropped on their scheduled dates, each
 *    expanded across the horizon by its cadence.
 *
 * The result exposes the running balance, its low point, the first day it dips
 * below a threshold, and a runway estimate. Pure; `now` is explicit.
 */

import type { Recurring } from "./data";

const DAY_MS = 24 * 3600 * 1000;
const MONTH_DAYS = 30.44;

export interface ForecastInputs {
  /** Starting liquid balance (checking + savings). */
  liquid: number;
  recurring: Recurring[];
  /** Trailing discretionary (non-recurring) monthly spend. */
  discretionaryMonthly: number;
  /** Expected monthly income (paychecks, etc.). */
  monthlyIncome: number;
  days?: number;
  /** Balance threshold to flag (default 0 — an overdraft). */
  threshold?: number;
  now?: Date;
}

export interface ForecastResult {
  points: { date: string; balance: number }[];
  minBalance: number;
  minDate: string;
  endBalance: number;
  /** First date the balance drops below the threshold, or null if it never does. */
  lowBalanceDate: string | null;
  /** Days until the balance would hit zero at the projected drift, or null if not declining. */
  runwayDays: number | null;
  /** Net projected change over the horizon. */
  netChange: number;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Step a date forward by one cadence period. */
function stepCadence(d: Date, cadence: Recurring["cadence"]): Date {
  const n = new Date(d);
  if (cadence === "weekly") n.setDate(n.getDate() + 7);
  else if (cadence === "yearly") n.setFullYear(n.getFullYear() + 1);
  else n.setMonth(n.getMonth() + 1);
  return n;
}

export function forecastCashFlow(inputs: ForecastInputs): ForecastResult {
  const days = inputs.days ?? 60;
  const now = inputs.now ?? new Date();
  const threshold = inputs.threshold ?? 0;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Bucket recurring outflows onto their scheduled day-offsets in the window.
  const outflowByDay = new Map<number, number>();
  for (const r of inputs.recurring) {
    let when = new Date(`${r.nextDate}T00:00:00`);
    if (Number.isNaN(when.getTime())) continue;
    // Advance a past due-date up to the window start.
    while (when < start) when = stepCadence(when, r.cadence);
    for (; when <= new Date(start.getTime() + days * DAY_MS); when = stepCadence(when, r.cadence)) {
      const offset = Math.round((when.getTime() - start.getTime()) / DAY_MS);
      outflowByDay.set(offset, (outflowByDay.get(offset) ?? 0) + Math.abs(r.amount));
    }
  }

  // Baseline excludes recurring (those are charged discretely above): expected
  // income minus discretionary spend, spread evenly per day.
  const dailyBaseline = (inputs.monthlyIncome - inputs.discretionaryMonthly) / MONTH_DAYS;

  const points: { date: string; balance: number }[] = [];
  let balance = inputs.liquid;
  let minBalance = balance;
  let minDate = iso(start);
  let lowBalanceDate: string | null = balance < threshold ? iso(start) : null;

  for (let day = 0; day <= days; day++) {
    if (day > 0) {
      balance += dailyBaseline;
      balance -= outflowByDay.get(day) ?? 0;
    }
    const date = iso(new Date(start.getTime() + day * DAY_MS));
    points.push({ date, balance });
    if (balance < minBalance) {
      minBalance = balance;
      minDate = date;
    }
    if (lowBalanceDate === null && balance < threshold) lowBalanceDate = date;
  }

  const endBalance = balance;
  const netChange = endBalance - inputs.liquid;
  // Runway: only meaningful when the projected drift is negative.
  const dailyNet = netChange / days;
  const runwayDays = dailyNet < -1e-6 ? Math.max(0, Math.floor(inputs.liquid / -dailyNet)) : null;

  return { points, minBalance, minDate, endBalance, lowBalanceDate, runwayDays, netChange };
}
