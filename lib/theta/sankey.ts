/**
 * theta — cash-flow Sankey model.
 *
 * Turns the *current month's* transactions into a conserved, three-column flow
 * graph: income sources → an "Income" hub → spending categories + what's left
 * over. It's a pure derivation (an explicit `now`, like the rest of theta's
 * analytics); the geometry lives in the SVG component that consumes this.
 *
 * Conservation: total inflow always equals total outflow. When you spend more
 * than you earn, the shortfall is drawn from savings — modeled as an extra
 * inflow node so the ribbons still balance rather than overflowing the hub.
 */

import {
  type Category,
  CATEGORY_COLOR,
  type Ledger,
  SPEND_CATEGORIES,
  type Transaction,
} from "./data";

export interface SankeyNode {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  color: string;
}

export interface CashFlowSankey {
  /** Ordered columns of nodes, left → right (sources, hub, outflows). */
  columns: SankeyNode[][];
  links: SankeyLink[];
  /** Total inflow (= total outflow). */
  total: number;
  income: number;
  expenses: number;
  /** income − expenses (may be negative). */
  net: number;
  monthLabel: string;
}

const INCOME_GREEN = "#34d399";
const HUB_COLOR = "#5eead4";
const SAVED_COLOR = "#5eead4";
const DEFICIT_COLOR = "#fb7185";

/** How many distinct income sources to show before folding the rest into "Other". */
const MAX_SOURCES = 6;

const ym = (iso: string) => iso.slice(0, 7);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Build the cash-flow Sankey for the month containing `now`. Returns null when
 * there's no inflow to draw (an empty or income-less month), so the caller can
 * fall back to an empty state.
 */
export function buildCashFlowSankey(
  ledger: Ledger,
  now: Date = new Date()
): CashFlowSankey | null {
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const hidden = new Set(ledger.hiddenAccounts ?? []);
  const hiddenCat = new Set(ledger.hiddenCategories ?? []);
  const visible = (t: Transaction) =>
    !hidden.has(t.account) && !hiddenCat.has(t.category) && ym(t.date) <= curKey;

  // Target the latest month that actually has activity (≤ now), not strictly the
  // calendar month — so the diagram stays meaningful early in a month, or when
  // the newest data is a few weeks old, instead of rendering an empty graph.
  let targetKey = "";
  for (const t of ledger.transactions) {
    if (visible(t)) {
      const key = ym(t.date);
      if (key > targetKey) targetKey = key;
    }
  }
  if (!targetKey) return null;

  const included = (t: Transaction) => visible(t) && ym(t.date) === targetKey;

  // Income by merchant (positive, non-transfer), largest first.
  const incomeByMerchant = new Map<string, number>();
  const spendByCategory = new Map<Category, number>();
  for (const t of ledger.transactions) {
    if (!included(t)) continue;
    if (t.amount > 0 && t.category !== "Income" && t.category !== "Transfer") {
      // A positive amount in a spend category (refund) nets against that category.
      spendByCategory.set(t.category, (spendByCategory.get(t.category) ?? 0) - t.amount);
    }
    if (t.amount > 0 && t.category === "Income") {
      incomeByMerchant.set(t.merchant, (incomeByMerchant.get(t.merchant) ?? 0) + t.amount);
    } else if (t.amount < 0 && SPEND_CATEGORIES.includes(t.category)) {
      spendByCategory.set(t.category, (spendByCategory.get(t.category) ?? 0) + Math.abs(t.amount));
    }
  }

  const income = [...incomeByMerchant.values()].reduce((s, v) => s + v, 0);
  const expenses = [...spendByCategory.values()].reduce((s, v) => s + Math.max(0, v), 0);
  const net = income - expenses;
  const saved = Math.max(0, net);
  const deficit = Math.max(0, -net);
  const total = income + deficit;
  if (total <= 0) return null;

  // ── Sources column ────────────────────────────────────────────────────────
  const sortedSources = [...incomeByMerchant.entries()].sort((a, b) => b[1] - a[1]);
  const sources: SankeyNode[] = [];
  const head = sortedSources.slice(0, MAX_SOURCES);
  const tail = sortedSources.slice(MAX_SOURCES);
  for (const [merchant, value] of head) {
    sources.push({ id: `src:${merchant}`, label: merchant, value, color: INCOME_GREEN });
  }
  const tailSum = tail.reduce((s, [, v]) => s + v, 0);
  if (tailSum > 0) {
    sources.push({ id: "src:other", label: "Other income", value: tailSum, color: INCOME_GREEN });
  }
  if (deficit > 0) {
    sources.push({ id: "draw", label: "From savings", value: deficit, color: DEFICIT_COLOR });
  }

  // ── Hub ───────────────────────────────────────────────────────────────────
  const hub: SankeyNode = { id: "hub", label: "Income", value: total, color: HUB_COLOR };

  // ── Outflows column ───────────────────────────────────────────────────────
  const outflows: SankeyNode[] = [...spendByCategory.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([category, value]) => ({
      id: `cat:${category}`,
      label: category,
      value,
      color: CATEGORY_COLOR[category],
    }));
  if (saved > 0) {
    outflows.push({ id: "saved", label: "Saved", value: saved, color: SAVED_COLOR });
  }

  // ── Links ─────────────────────────────────────────────────────────────────
  const links: SankeyLink[] = [];
  for (const s of sources) links.push({ source: s.id, target: "hub", value: s.value, color: s.color });
  for (const o of outflows) links.push({ source: "hub", target: o.id, value: o.value, color: o.color });

  return {
    columns: [sources, [hub], outflows],
    links,
    total,
    income,
    expenses,
    net,
    monthLabel: MONTHS[Number(targetKey.slice(5, 7)) - 1] ?? "",
  };
}
