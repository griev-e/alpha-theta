/**
 * theta — debt payoff planner.
 *
 * Amortizes the ledger's liabilities (credit cards, loans) forward month by
 * month under a chosen extra-payment strategy, so the accounts page can answer
 * "when am I debt-free, and what does it cost in interest?" — and "what does an
 * extra $200/mo do?".
 *
 *  - **avalanche** routes every spare dollar to the highest-APR balance first
 *    (mathematically cheapest);
 *  - **snowball** routes it to the smallest balance first (fastest first win).
 *
 * Each month every debt accrues interest and takes at least its minimum; the
 * leftover of the monthly budget above the summed minimums is thrown entirely
 * at the strategy's current target. APRs come from each account (or the
 * assumption fallback via `effectiveApr`). Pure; `now` is explicit.
 */

import type { ThetaAssumptions } from "./assumptions";
import { effectiveApr } from "./assumptions";
import type { Account } from "./data";

export type DebtStrategy = "avalanche" | "snowball";

/** Per-month minimum payment model: interest plus a slice of principal, floored. */
const MIN_PRINCIPAL_RATE = 0.01;
const MIN_FLOOR = 25;

export interface DebtLine {
  id: string;
  name: string;
  kind: Account["kind"];
  balance: number; // positive
  apr: number;
}

export interface AccountPayoff {
  id: string;
  name: string;
  months: number;
  payoffDate: string;
  interestPaid: number;
}

export interface DebtPlan {
  strategy: DebtStrategy;
  /** Months until every debt is cleared (0 when debt-free already). */
  months: number;
  payoffDate: string | null;
  totalInterest: number;
  totalPaid: number;
  /** Sum of the first month's minimum payments — the floor a budget must clear. */
  totalMinimum: number;
  /** True when the monthly budget can't even cover the minimums (plan won't converge). */
  underMinimum: boolean;
  /** Aggregate remaining balance per month, for the payoff curve. */
  schedule: { month: number; remaining: number; interest: number; principal: number }[];
  perAccount: AccountPayoff[];
}

/** Extract the payable liabilities from the ledger's accounts. */
export function debtLines(accounts: Account[], a: ThetaAssumptions): DebtLine[] {
  return accounts
    .filter((acc) => acc.balance < 0)
    .map((acc) => ({
      id: acc.id,
      name: acc.name,
      kind: acc.kind,
      balance: Math.abs(acc.balance),
      apr: effectiveApr(acc, a),
    }));
}

function addMonthsISO(now: Date, months: number): string {
  const d = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MAX_MONTHS = 600;

export function planDebtPayoff(
  lines: DebtLine[],
  monthlyBudget: number,
  strategy: DebtStrategy,
  now: Date = new Date()
): DebtPlan {
  // Work on a mutable copy; preserve id/name for per-account reporting.
  const debts = lines
    .filter((l) => l.balance > 0)
    .map((l) => ({ ...l, interestPaid: 0, clearedMonth: 0 }));

  const priority = (): typeof debts =>
    [...debts]
      .filter((d) => d.balance > 1e-6)
      .sort((x, y) => (strategy === "avalanche" ? y.apr - x.apr : x.balance - y.balance));

  const minPayment = (d: (typeof debts)[number]): number => {
    const interest = (d.balance * d.apr) / 12;
    return Math.min(d.balance + interest, Math.max(MIN_FLOOR, d.balance * MIN_PRINCIPAL_RATE) + interest);
  };

  const totalMinimum = debts.reduce((s, d) => s + (d.balance > 0 ? minPayment(d) : 0), 0);
  const schedule: DebtPlan["schedule"] = [
    { month: 0, remaining: debts.reduce((s, d) => s + d.balance, 0), interest: 0, principal: 0 },
  ];

  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;
  const underMinimum = monthlyBudget < totalMinimum - 1e-6;

  while (debts.some((d) => d.balance > 1e-6) && month < MAX_MONTHS) {
    month++;
    let budget = monthlyBudget;
    let monthInterest = 0;
    let monthPrincipal = 0;

    // 1) Accrue interest and take minimums on every live debt.
    for (const d of debts) {
      if (d.balance <= 1e-6) continue;
      const interest = (d.balance * d.apr) / 12;
      d.balance += interest;
      d.interestPaid += interest;
      totalInterest += interest;
      monthInterest += interest;

      let pay = Math.min(minPayment(d), d.balance, budget);
      if (pay < 0) pay = 0;
      d.balance -= pay;
      budget -= pay;
      totalPaid += pay;
      monthPrincipal += pay - interest;
    }

    // 2) Throw the remaining budget at the strategy's current target(s).
    for (const d of priority()) {
      if (budget <= 1e-6) break;
      const pay = Math.min(d.balance, budget);
      d.balance -= pay;
      budget -= pay;
      totalPaid += pay;
      monthPrincipal += pay;
    }

    for (const d of debts) {
      if (d.balance <= 1e-6 && d.clearedMonth === 0) d.clearedMonth = month;
    }

    schedule.push({
      month,
      remaining: debts.reduce((s, d) => s + Math.max(0, d.balance), 0),
      interest: monthInterest,
      principal: monthPrincipal,
    });

    // Under-minimum budgets never converge — bail once we can prove divergence.
    if (underMinimum && month > 12) break;
  }

  const cleared = debts.every((d) => d.balance <= 1e-6);

  return {
    strategy,
    // Months elapsed — equals the true payoff month when cleared, or the cap/bail
    // month when the budget can't retire the debt (underMinimum flags that case).
    months: month,
    payoffDate: cleared && lines.length > 0 ? addMonthsISO(now, month) : null,
    totalInterest,
    totalPaid,
    totalMinimum,
    underMinimum,
    schedule,
    perAccount: debts.map((d) => ({
      id: d.id,
      name: d.name,
      months: d.clearedMonth,
      payoffDate: d.clearedMonth ? addMonthsISO(now, d.clearedMonth) : "",
      interestPaid: d.interestPaid,
    })),
  };
}
