/**
 * theta — pure derivations over a ledger.
 *
 * Everything the pages display is computed here from the stored ledger, so an
 * edit (a new transaction, a changed budget limit, a goal contribution) ripples
 * everywhere at once. The "current month" is relative to today, so imported
 * data buckets correctly.
 */

import {
  type Budget,
  type Category,
  type Ledger,
  MONTHS,
  type MonthFlow,
  SPEND_CATEGORIES,
  type Transaction,
} from "./data";
import { deriveFlowSeries, deriveNetWorthSeries } from "./history";

export type BudgetStatus = Budget & {
  spent: number;
  /**
   * Envelope balance carried in from prior months — the accumulated
   * `limit − spent` over the trailing window since the ledger's first activity.
   * Positive means you're ahead (unspent rolled forward); negative means past
   * overspending eats into this month. Always 0 for a non-rollover budget.
   */
  carryover: number;
  /** `limit + carryover`, floored at 0 — what "remaining" is measured against. */
  effectiveLimit: number;
};

/** Trailing months that contribute to an envelope budget's carryover balance. */
const ROLLOVER_WINDOW = 12;

export type ThetaView = {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;

  currentMonthLabel: string;
  monthIncome: number;
  monthExpenses: number;
  monthNet: number;
  savingsRate: number;
  prevMonthExpenses: number;

  spending: { category: Category; amount: number }[];
  monthSpend: number;

  budgets: BudgetStatus[];
  totalBudget: number;
  totalBudgetSpent: number;

  cashFlow: MonthFlow[];
  netWorthSeries: { month: string; value: number }[];
  netWorthDelta: number;
  netWorthDeltaPct: number;

  monthlyRecurring: number;
};

const ym = (iso: string) => iso.slice(0, 7);

function currentYearMonth(now: Date): { key: string; label: string } {
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return { key, label: MONTHS[now.getMonth()] };
}

/** `YYYY-MM` keys for the `count` months immediately before `now`, oldest → newest. */
function priorMonthKeys(now: Date, count: number): string[] {
  const keys: string[] = [];
  for (let back = count; back >= 1; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/** Normalize a recurring charge to a per-month figure. */
export function recurringPerMonth(amount: number, cadence: string): number {
  if (cadence === "yearly") return amount / 12;
  if (cadence === "weekly") return (amount * 52) / 12;
  return amount;
}

export function deriveTheta(ledger: Ledger, now: Date = new Date()): ThetaView {
  const { key: curKey, label: curLabel } = currentYearMonth(now);

  // Net worth is always over every account — hiding an account only filters its
  // transactions out of the flow/spending math, never its balance from assets.
  const totalAssets = ledger.accounts
    .filter((a) => a.balance > 0)
    .reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = ledger.accounts
    .filter((a) => a.balance < 0)
    .reduce((s, a) => s + Math.abs(a.balance), 0);
  const netWorth = totalAssets - totalLiabilities;

  // Transaction-derived figures (income, spending, budget pacing, cash flow)
  // honor the account/category filters: a hidden brokerage account's trades or
  // a hidden category's churn shouldn't be counted as income or spending.
  const hiddenAccounts = new Set(ledger.hiddenAccounts ?? []);
  const hiddenCategories = new Set(ledger.hiddenCategories ?? []);
  const included = (t: Transaction) =>
    !hiddenAccounts.has(t.account) && !hiddenCategories.has(t.category);

  // This month's flows, derived from transactions dated in the current month.
  // Transfers are excluded from BOTH sides — moving money between your own
  // accounts is neither income nor spending (the receiving leg would otherwise
  // inflate income).
  const thisMonth = ledger.transactions.filter((t) => ym(t.date) === curKey && included(t));
  const monthIncome = thisMonth
    .filter((t) => t.amount > 0 && t.category !== "Transfer")
    .reduce((s, t) => s + t.amount, 0);
  const monthExpenses = thisMonth
    .filter((t) => t.amount < 0 && t.category !== "Transfer")
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const monthNet = monthIncome - monthExpenses;
  const savingsRate = monthIncome > 0 ? monthNet / monthIncome : 0;

  // Spending by category this month (living spend only).
  const spendMap = new Map<Category, number>();
  for (const t of thisMonth) {
    if (t.amount >= 0 || !SPEND_CATEGORIES.includes(t.category)) continue;
    spendMap.set(t.category, (spendMap.get(t.category) ?? 0) + Math.abs(t.amount));
  }
  const spending = [...spendMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  const monthSpend = spending.reduce((s, x) => s + x.amount, 0);

  // Per-(prior month, category) spend over the rollover window, plus the set of
  // months with any activity — both needed to derive envelope carryover. Built
  // once here so a ledger with many rollover budgets stays a single pass.
  const priorKeys = priorMonthKeys(now, ROLLOVER_WINDOW);
  const priorKeySet = new Set(priorKeys);
  const coveredMonths = new Set<string>();
  const spendByMonthCat = new Map<string, Map<Category, number>>();
  for (const t of ledger.transactions) {
    if (!included(t)) continue;
    const key = ym(t.date);
    if (!priorKeySet.has(key)) continue;
    coveredMonths.add(key);
    if (t.amount >= 0 || !SPEND_CATEGORIES.includes(t.category)) continue;
    let cat = spendByMonthCat.get(key);
    if (!cat) {
      cat = new Map();
      spendByMonthCat.set(key, cat);
    }
    cat.set(t.category, (cat.get(t.category) ?? 0) + Math.abs(t.amount));
  }
  // Accumulate limit − spent across prior months, but only from the ledger's
  // first covered month onward — so months of empty pre-history don't fabricate
  // an envelope balance the user never actually saved.
  const carryoverFor = (category: Category, limit: number): number => {
    let started = false;
    let carry = 0;
    for (const key of priorKeys) {
      if (!started) {
        if (!coveredMonths.has(key)) continue;
        started = true;
      }
      carry += limit - (spendByMonthCat.get(key)?.get(category) ?? 0);
    }
    return carry;
  };

  // Budgets: limit is stored, spent is derived from this month's transactions.
  // A rollover budget also carries an accumulated envelope balance forward.
  const budgets: BudgetStatus[] = ledger.budgets.map((b) => {
    const carryover = b.rollover ? carryoverFor(b.category, b.limit) : 0;
    return {
      ...b,
      spent: spendMap.get(b.category) ?? 0,
      carryover,
      effectiveLimit: Math.max(0, b.limit + carryover),
    };
  });
  // "Budgeted" reflects the effective (rolled-over) limits, so remaining and the
  // overall ring account for envelope balances too.
  const totalBudget = budgets.reduce((s, b) => s + b.effectiveLimit, 0);
  const totalBudgetSpent = budgets.reduce((s, b) => s + b.spent, 0);

  // Series derived from the transaction record over a trailing window, with the
  // stored history as a fallback for months no transaction covers (see
  // lib/theta/history.ts). The current month is always the live derived point,
  // so the tail still equals this month's flows / current net worth.
  const cashFlow: MonthFlow[] = deriveFlowSeries(
    ledger.transactions,
    ledger.flowHistory,
    included,
    { now }
  );
  const netWorthSeries = deriveNetWorthSeries(
    ledger.accounts,
    ledger.transactions,
    ledger.netWorthHistory,
    { now }
  );
  const prevPoint = netWorthSeries[netWorthSeries.length - 2];
  const netWorthDelta = prevPoint ? netWorth - prevPoint.value : 0;
  const netWorthDeltaPct =
    prevPoint && prevPoint.value !== 0 ? netWorthDelta / prevPoint.value : 0;

  const prevFlow = cashFlow[cashFlow.length - 2];
  const prevMonthExpenses = prevFlow ? prevFlow.expenses : monthExpenses;

  const monthlyRecurring = ledger.recurring.reduce(
    (s, r) => s + recurringPerMonth(r.amount, r.cadence),
    0
  );

  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    currentMonthLabel: curLabel,
    monthIncome,
    monthExpenses,
    monthNet,
    savingsRate,
    prevMonthExpenses,
    spending,
    monthSpend,
    budgets,
    totalBudget,
    totalBudgetSpent,
    cashFlow,
    netWorthSeries,
    netWorthDelta,
    netWorthDeltaPct,
    monthlyRecurring,
  };
}

/**
 * Next charge date for a recurring item after marking it paid. Month/year
 * advances clamp to the last day of the target month — a charge anchored on
 * Jan 31 recurs Feb 28 (not Mar 3, the raw setMonth rollover, which would
 * permanently drift the anchor forward through the calendar).
 */
export function advanceRecurring(nextDate: string, cadence: string): string {
  const d = new Date(`${nextDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return nextDate;
  if (cadence === "weekly") {
    d.setDate(d.getDate() + 7);
  } else {
    const day = d.getDate();
    const monthsAhead = cadence === "yearly" ? 12 : 1;
    d.setDate(1);
    d.setMonth(d.getMonth() + monthsAhead);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
  }
  // Format from local parts — toISOString() renders UTC, which shifts a local
  // midnight to the *previous* calendar day in any UTC+ timezone.
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
