/**
 * theta — recurring charge auto-detection.
 *
 * theta's `Recurring` list was entirely hand-maintained. This derives it from
 * the transaction record: a merchant billed repeatedly at a steady cadence and
 * amount is almost certainly a subscription or bill, whether or not the user
 * ever entered it. On top of detection it surfaces two things commercial tools
 * charge for — **new subscriptions** the ledger doesn't yet track, and
 * **price creep** (the charge that quietly climbed from $15.49 to $17.99).
 *
 * Detection is structural, not threshold-tuned: group by normalized merchant,
 * look for ≥3 charges whose inter-charge gaps cluster around a known cadence
 * (weekly / monthly / yearly) with a stable amount. Pure; `now` is explicit.
 */

import type { Category, Recurring, Transaction } from "./data";

export type Cadence = Recurring["cadence"];

export interface DetectedRecurring {
  merchant: string;
  category: Category;
  /** Most recent charge amount (positive dollars). */
  amount: number;
  cadence: Cadence;
  /** Number of matched charges. */
  count: number;
  /** ISO date of the most recent charge. */
  lastDate: string;
  /** Projected next charge date. */
  nextDate: string;
  /** Estimated annual cost at the current amount + cadence. */
  annualCost: number;
  /** The matched charge amounts in chronological order — powers the row spark. */
  amounts: number[];
  /** Set when the amount has trended up over the observed charges. */
  priceCreep?: { from: number; to: number; pctChange: number };
}

/** Canonical merchant key used to group charges and to match dismissals. */
export const normalizeMerchant = (merchant: string): string =>
  merchant.trim().toLowerCase().replace(/\s+/g, " ");
const normalize = normalizeMerchant;

const CADENCE_DAYS: Record<Cadence, number> = { weekly: 7, monthly: 30.44, yearly: 365.25 };
const PER_YEAR: Record<Cadence, number> = { weekly: 52, monthly: 12, yearly: 1 };

const dayNum = (iso: string) => new Date(`${iso}T00:00:00`).getTime() / (24 * 3600 * 1000);

/** Best-fit cadence for a set of inter-charge gaps (in days), or null. */
function fitCadence(gaps: number[]): Cadence | null {
  if (gaps.length === 0) return null;
  const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  let best: Cadence | null = null;
  let bestErr = Infinity;
  for (const cad of ["weekly", "monthly", "yearly"] as Cadence[]) {
    const err = Math.abs(median - CADENCE_DAYS[cad]) / CADENCE_DAYS[cad];
    if (err < bestErr) {
      bestErr = err;
      best = cad;
    }
  }
  // Require the median gap within ~35% of the cadence to accept the fit.
  return bestErr <= 0.35 ? best : null;
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + Math.round(days));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function detectRecurring(
  transactions: Transaction[],
  opts: { now?: Date; minCount?: number } = {}
): DetectedRecurring[] {
  const minCount = opts.minCount ?? 3;

  // Group outflows by normalized merchant.
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.amount >= 0 || t.category === "Transfer") continue;
    const key = normalize(t.merchant);
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }

  const out: DetectedRecurring[] = [];
  for (const txs of groups.values()) {
    if (txs.length < minCount) continue;
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) gaps.push(dayNum(sorted[i].date) - dayNum(sorted[i - 1].date));
    const cadence = fitCadence(gaps);
    if (!cadence) continue;

    // Amount stability: coefficient of variation must be modest (bills wobble a
    // little; a variable merchant like a grocery store won't pass).
    const amounts = sorted.map((t) => Math.abs(t.amount));
    const mean = amounts.reduce((s, x) => s + x, 0) / amounts.length;
    const variance = amounts.reduce((s, x) => s + (x - mean) ** 2, 0) / amounts.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    if (cv > 0.25) continue;

    const last = sorted[sorted.length - 1];
    const amount = Math.abs(last.amount);
    const firstAmt = amounts[0];
    const creep =
      firstAmt > 0 && amount > firstAmt * 1.03
        ? { from: firstAmt, to: amount, pctChange: (amount - firstAmt) / firstAmt }
        : undefined;

    out.push({
      merchant: last.merchant.trim(),
      category: last.category,
      amount,
      cadence,
      count: sorted.length,
      lastDate: last.date,
      nextDate: addDaysISO(last.date, CADENCE_DAYS[cadence]),
      annualCost: amount * PER_YEAR[cadence],
      amounts,
      priceCreep: creep,
    });
  }

  return out.sort((a, b) => b.annualCost - a.annualCost);
}

/**
 * Detected charges the ledger's `recurring` list doesn't already track — the
 * "new subscription detected" surface. Matched by normalized merchant name.
 */
export function newSubscriptions(
  detected: DetectedRecurring[],
  tracked: Recurring[]
): DetectedRecurring[] {
  const known = new Set(tracked.map((r) => normalize(r.name)));
  return detected.filter((d) => !known.has(normalize(d.merchant)));
}
