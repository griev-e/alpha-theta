/**
 * theta — historical series derived from the transaction record.
 *
 * The ledger's `flowHistory` / `netWorthHistory` arrays were once the *source*
 * of the cash-flow and net-worth charts: static, hand-anchored numbers with a
 * bare month label ("Jul") and no year, so the series could never span more
 * than a curated stretch and never self-corrected when older transactions were
 * imported. This module derives those series from the real record instead —
 * flows bucketed by calendar month, net worth reconstructed by reverse-walking
 * each account's balance back through its transactions.
 *
 * The stored arrays survive only as a **fallback**: months with genuine
 * transaction coverage are derived; months with none fall back to whatever the
 * ledger shipped (so the sample's curated back-history and a freshly-imported
 * book both render, and neither clobbers the other). Everything here is pure —
 * `now` is an explicit input so a tab left open across midnight re-buckets.
 */

import type { Account, MonthFlow, Transaction } from "./data";
import { MONTHS } from "./data";

/** A cash-flow point, now carrying its `YYYY-MM` key alongside the short label. */
export type FlowPoint = MonthFlow & { key: string };
/** A net-worth point keyed by `YYYY-MM` for unambiguous ordering. */
export type NetWorthPoint = { key: string; month: string; value: number };
/**
 * A net-worth point decomposed into the three stacked bands the trajectory
 * chart draws (§90): liquid cash, invested assets, and liabilities (kept
 * negative, i.e. what's owed). `net` is their algebraic sum, equal to the
 * plain `netWorthTrajectory` value, so the composition never disagrees with
 * the headline number.
 */
export type CompositionPoint = {
  key: string;
  month: string;
  liquid: number;
  invested: number;
  liabilities: number; // ≤ 0
  net: number;
  covered: boolean;
};

/** Milestone crossings the trajectory chart flags. */
export type NetWorthMilestone = { index: number; kind: "zero" | "high"; label: string };

const LIABILITY_KINDS = new Set<Account["kind"]>(["credit", "loan"]);
const INVESTED_KINDS = new Set<Account["kind"]>(["brokerage", "retirement"]);

const ym = (iso: string) => iso.slice(0, 7);

/** `YYYY-MM` key and short label for the month `back` months before `now`. */
function monthKey(now: Date, back: number): { key: string; month: string; monthIdx: number } {
  const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { key, month: MONTHS[d.getMonth()], monthIdx: d.getMonth() };
}

/** Last calendar day of a `YYYY-MM` key, as an ISO `YYYY-MM-DD` string. */
function endOfMonthISO(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(y, m, 0).getDate(); // day 0 of next month = last of this
  return `${key}-${String(last).padStart(2, "0")}`;
}

export interface SeriesOptions {
  /** How many trailing months (including the current one) to cover. */
  months?: number;
  now?: Date;
}

/**
 * Monthly income/expense flows over the trailing window. A transaction counts
 * as income (positive, non-Transfer) or expense (negative, non-Transfer); the
 * `included` predicate applies the same account/category hiding the rest of the
 * derivation honors, so a hidden brokerage's churn never shows up as flow.
 *
 * Months with at least one included transaction are marked `covered` — the
 * caller uses that to decide derived-vs-fallback.
 */
export function monthlyFlows(
  transactions: Transaction[],
  included: (t: Transaction) => boolean,
  opts: SeriesOptions = {}
): (FlowPoint & { covered: boolean })[] {
  const months = opts.months ?? 12;
  const now = opts.now ?? new Date();

  const income = new Map<string, number>();
  const expense = new Map<string, number>();
  const covered = new Set<string>();
  for (const t of transactions) {
    if (!included(t)) continue;
    const key = ym(t.date);
    covered.add(key);
    if (t.category === "Transfer") continue;
    if (t.amount > 0) income.set(key, (income.get(key) ?? 0) + t.amount);
    else if (t.amount < 0) expense.set(key, (expense.get(key) ?? 0) + Math.abs(t.amount));
  }

  const out: (FlowPoint & { covered: boolean })[] = [];
  for (let back = months - 1; back >= 0; back--) {
    const { key, month } = monthKey(now, back);
    out.push({
      key,
      month,
      income: income.get(key) ?? 0,
      expenses: expense.get(key) ?? 0,
      covered: covered.has(key),
    });
  }
  return out;
}

/**
 * Net worth at the end of each trailing month, reconstructed from *current*
 * account balances by reverse-walking transactions:
 *
 *   NW(end of month m) = NW(now) − Σ amount(t) for every t dated after m's end
 *
 * Every transaction moved some account's balance by its signed amount, so
 * subtracting all *subsequent* amounts rewinds the total to that point.
 * Transfers between your own accounts net to zero across the sum (both legs
 * cancel) so they don't create phantom net-worth swings — as long as both legs
 * are recorded; a one-legged transfer is the honest limit of the available
 * data. Balance reconstruction uses **all** transactions (hiding only filters
 * flow/spending, never an account's balance).
 */
export function netWorthTrajectory(
  accounts: Account[],
  transactions: Transaction[],
  opts: SeriesOptions = {}
): (NetWorthPoint & { covered: boolean })[] {
  const months = opts.months ?? 12;
  const now = opts.now ?? new Date();
  const current = accounts.reduce((s, a) => s + a.balance, 0);

  // Sum of transaction amounts strictly after a given ISO date.
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const sumAfter = (iso: string): number => {
    let s = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].date <= iso) break;
      s += sorted[i].amount;
    }
    return s;
  };
  const covered = new Set(transactions.map((t) => ym(t.date)));

  const out: (NetWorthPoint & { covered: boolean })[] = [];
  for (let back = months - 1; back >= 0; back--) {
    const { key, month } = monthKey(now, back);
    // The current month's point is "as of now" (current balances); past months
    // rewind to their month-end.
    const value = back === 0 ? current : current - sumAfter(endOfMonthISO(key));
    out.push({ key, month, value, covered: covered.has(key) });
  }
  return out;
}

/**
 * Merge a derived series with the ledger's stored fallback: a derived point is
 * kept when its month has transaction coverage; otherwise the stored point
 * (matched by short label) fills in, and failing that the derived value (often
 * zero / the flat carried balance) stands. The current month is always derived.
 * This keeps the sample's curated back-history intact while an imported book
 * gets a fully real series.
 */
function mergeFallback<T extends { key: string; month: string; covered: boolean }>(
  derived: T[],
  storedByLabel: Map<string, Omit<T, "key" | "covered">>,
  overwrite: (base: T, stored: Omit<T, "key" | "covered">) => T
): T[] {
  return derived.map((point, i) => {
    const isCurrent = i === derived.length - 1;
    if (isCurrent || point.covered) return point;
    const stored = storedByLabel.get(point.month);
    return stored ? overwrite(point, stored) : point;
  });
}

/** The final cash-flow series most pages consume: derived, stored-filled. */
export function deriveFlowSeries(
  transactions: Transaction[],
  storedFlow: MonthFlow[],
  included: (t: Transaction) => boolean,
  opts: SeriesOptions = {}
): FlowPoint[] {
  const derived = monthlyFlows(transactions, included, opts);
  const stored = new Map(storedFlow.map((f) => [f.month, { month: f.month, income: f.income, expenses: f.expenses }]));
  const merged = mergeFallback(derived, stored, (base, s) => ({
    ...base,
    income: s.income,
    expenses: s.expenses,
  }));
  // Drop the leading run of months with no activity and no stored fallback —
  // the empty pre-history before the ledger's earliest data — but always keep
  // the current (last) point so the series is never empty.
  let start = 0;
  while (start < merged.length - 1 && merged[start].income === 0 && merged[start].expenses === 0) {
    start++;
  }
  return merged
    .slice(start)
    .map((p) => ({ key: p.key, month: p.month, income: p.income, expenses: p.expenses }));
}

/** The final net-worth series most pages consume: derived, stored-filled. */
export function deriveNetWorthSeries(
  accounts: Account[],
  transactions: Transaction[],
  storedNW: { month: string; value: number }[],
  opts: SeriesOptions = {}
): NetWorthPoint[] {
  const derived = netWorthTrajectory(accounts, transactions, opts);
  const stored = new Map(storedNW.map((p) => [p.month, { month: p.month, value: p.value }]));
  const merged = mergeFallback(derived, stored, (base, s) => ({ ...base, value: s.value }));
  return merged.map((p) => ({ key: p.key, month: p.month, value: p.value }));
}

/**
 * Net worth decomposed into liquid / invested / liability bands at each
 * trailing month-end (§90), reverse-walking each account's *own* balance the
 * same way `netWorthTrajectory` walks the total — but bucketed by account kind
 * so the trajectory chart can stack the three bands. Accounts with no
 * transactions hold their current balance flat back through the window (the
 * honest limit of the data). `net` sums the three bands, so it equals the plain
 * total trajectory for the same inputs.
 */
export function netWorthComposition(
  accounts: Account[],
  transactions: Transaction[],
  opts: SeriesOptions = {}
): CompositionPoint[] {
  const months = opts.months ?? 12;
  const now = opts.now ?? new Date();

  // Per-account transactions, sorted, so each account rewinds independently.
  const byAccount = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const arr = byAccount.get(t.account);
    if (arr) arr.push(t);
    else byAccount.set(t.account, [t]);
  }
  for (const arr of byAccount.values()) arr.sort((a, b) => a.date.localeCompare(b.date));

  const sumAfter = (arr: Transaction[] | undefined, iso: string): number => {
    if (!arr) return 0;
    let s = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].date <= iso) break;
      s += arr[i].amount;
    }
    return s;
  };
  const covered = new Set(transactions.map((t) => ym(t.date)));

  const out: CompositionPoint[] = [];
  for (let back = months - 1; back >= 0; back--) {
    const { key, month } = monthKey(now, back);
    const iso = endOfMonthISO(key);
    let liquid = 0;
    let invested = 0;
    let liabilities = 0;
    for (const a of accounts) {
      const bal = back === 0 ? a.balance : a.balance - sumAfter(byAccount.get(a.id), iso);
      if (LIABILITY_KINDS.has(a.kind)) liabilities += bal;
      else if (INVESTED_KINDS.has(a.kind)) invested += bal;
      else liquid += bal;
    }
    out.push({
      key,
      month,
      liquid,
      invested,
      liabilities,
      net: liquid + invested + liabilities,
      covered: covered.has(key),
    });
  }
  return out;
}

/**
 * Anchor a composition's total to the headline net-worth series so the
 * trajectory chart never disagrees with the number the rest of the app shows.
 * For a fully-covered book the two totals are already identical (both are the
 * same reverse-walk) so this is a no-op; for months the transaction record
 * doesn't reach — where the headline falls back to stored history — the bands
 * are rescaled to that total while keeping their proportions, rather than
 * drawing a flat pre-history the record can't actually support. A sign flip has
 * no meaningful proportional map, so those points just adopt the target total.
 * Matched by month label (unique within a trailing-year window).
 */
export function alignCompositionToSeries(
  comp: CompositionPoint[],
  series: { month: string; value: number }[]
): CompositionPoint[] {
  const target = new Map(series.map((p) => [p.month, p.value]));
  return comp.map((c) => {
    const t = target.get(c.month);
    if (t === undefined) return c;
    if (c.net === 0 || t === 0 || Math.sign(c.net) !== Math.sign(t)) {
      return { ...c, net: t };
    }
    const f = t / c.net;
    return {
      ...c,
      liquid: c.liquid * f,
      invested: c.invested * f,
      liabilities: c.liabilities * f,
      net: t,
    };
  });
}

/**
 * The milestones the trajectory chart flags: the month net worth first turned
 * non-negative ("crossed $0"), and the all-time high within the window — each
 * flagged at most once, and never both on the same point, so the chart stays
 * quiet rather than annotating a monotonic climb at every step.
 */
export function netWorthMilestones(points: { net: number }[]): NetWorthMilestone[] {
  const out: NetWorthMilestone[] = [];
  if (points.length < 2) return out;

  let zeroIdx = -1;
  for (let i = 1; i < points.length; i++) {
    if (points[i - 1].net < 0 && points[i].net >= 0) {
      out.push({ index: i, kind: "zero", label: "Crossed $0 — net worth turned positive" });
      zeroIdx = i;
      break;
    }
  }

  let hiIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].net > points[hiIdx].net) hiIdx = i;
  }
  // Only worth flagging if the peak is a genuine climb, and not the same point
  // the zero-crossing already marks.
  if (hiIdx > 0 && hiIdx !== zeroIdx && points[hiIdx].net > points[0].net) {
    out.push({ index: hiIdx, kind: "high", label: "New high — highest net worth in this window" });
  }
  return out;
}
