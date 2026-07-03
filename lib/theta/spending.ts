/**
 * theta — distribution-ranked spending analytics.
 *
 * Borrows the regime engine's defining principle (`lib/analytics/regime`): rank
 * every signal against *its own* trailing distribution instead of a hand-tuned
 * dollar threshold. A $600 restaurant month is only an anomaly relative to how
 * this person's dining usually runs — so each category's current-month spend is
 * scored by its percentile within its own trailing history, and the month-over-
 * month move is read the same way. All pure; `now` is explicit.
 */

import type { Category, Transaction } from "./data";
import { SPEND_CATEGORIES } from "./data";

const ym = (iso: string) => iso.slice(0, 7);

function monthKey(now: Date, back: number): string {
  const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Fraction of `history` that `value` meets or exceeds (0–1). */
function percentileRank(value: number, history: number[]): number {
  if (history.length === 0) return 0.5;
  const below = history.filter((h) => h <= value).length;
  return below / history.length;
}

export interface CategoryTrend {
  category: Category;
  current: number;
  /** Mean of the trailing months (excluding the current). */
  trailingMean: number;
  /** Percentile of the current month within the trailing distribution (0–1). */
  percentile: number;
  /** Signed month-over-month change vs the trailing mean, as a fraction. */
  deltaVsMean: number;
  months: { key: string; amount: number }[];
}

export interface SpendingReport {
  trends: CategoryTrend[];
  anomalies: SpendingAnomaly[];
  /** Total discretionary spend this month vs the trailing mean. */
  monthTotal: number;
  monthTotalTrailingMean: number;
}

export interface SpendingAnomaly {
  category: Category;
  current: number;
  trailingMean: number;
  percentile: number;
  severity: "elevated" | "high";
  note: string;
}

/**
 * Per-category monthly spend over the trailing window and each category's
 * standing within its own history.
 */
export function analyzeSpending(
  transactions: Transaction[],
  opts: { months?: number; now?: Date } = {}
): SpendingReport {
  const months = opts.months ?? 12;
  const now = opts.now ?? new Date();
  const windowKeys: string[] = [];
  for (let back = months - 1; back >= 0; back--) windowKeys.push(monthKey(now, back));
  const currentKey = windowKeys[windowKeys.length - 1];
  const keyIndex = new Set(windowKeys);

  // category → month key → summed spend (positive dollars out)
  const byCat = new Map<Category, Map<string, number>>();
  for (const t of transactions) {
    if (t.amount >= 0 || !SPEND_CATEGORIES.includes(t.category)) continue;
    const key = ym(t.date);
    if (!keyIndex.has(key)) continue;
    let m = byCat.get(t.category);
    if (!m) byCat.set(t.category, (m = new Map()));
    m.set(key, (m.get(key) ?? 0) + Math.abs(t.amount));
  }

  const trends: CategoryTrend[] = [];
  for (const [category, monthMap] of byCat) {
    const series = windowKeys.map((key) => ({ key, amount: monthMap.get(key) ?? 0 }));
    const current = monthMap.get(currentKey) ?? 0;
    // Rank against real history only: trim the leading run of pre-history zeros
    // (months before this category's first charge) so a category that started
    // recently isn't scored against a padding of zeros that never happened.
    const firstActive = series.findIndex((p) => p.amount > 0);
    const trailing =
      firstActive < 0 || firstActive >= series.length - 1
        ? []
        : series.slice(firstActive, series.length - 1).map((p) => p.amount);
    const trailingMean = trailing.length ? trailing.reduce((s, x) => s + x, 0) / trailing.length : 0;
    trends.push({
      category,
      current,
      trailingMean,
      percentile: percentileRank(current, trailing),
      deltaVsMean: trailingMean > 0 ? (current - trailingMean) / trailingMean : current > 0 ? 1 : 0,
      months: series,
    });
  }
  trends.sort((a, b) => b.current - a.current);

  // Anomaly = a category running hot vs its own history, with at least a few
  // months of context and a material dollar amount (avoids flagging a $12 blip).
  const anomalies: SpendingAnomaly[] = [];
  for (const t of trends) {
    const context = t.months.filter((m) => m.amount > 0).length;
    if (context < 3 || t.current < 50) continue;
    if (t.percentile >= 0.9 && t.current > t.trailingMean * 1.25) {
      const pctOver = Math.round(t.deltaVsMean * 100);
      anomalies.push({
        category: t.category,
        current: t.current,
        trailingMean: t.trailingMean,
        percentile: t.percentile,
        severity: t.percentile >= 0.98 ? "high" : "elevated",
        note: `${t.category} is ${pctOver}% above its usual — highest in ${context} months of history.`,
      });
    }
  }
  anomalies.sort((a, b) => b.percentile - a.percentile || b.current - a.current);

  const monthTotal = trends.reduce((s, t) => s + t.current, 0);
  const monthTotalTrailingMean = trends.reduce((s, t) => s + t.trailingMean, 0);

  return { trends, anomalies, monthTotal, monthTotalTrailingMean };
}
