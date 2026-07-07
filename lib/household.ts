/**
 * The household view (§121) — a single aggregate read across every portfolio in
 * the set (individual, Roth, joint, …), not just the active one.
 *
 * Honesty is the whole point: only the **active** portfolio is live-priced
 * (`buildPortfolio` runs for it alone), so its value and holdings come from the
 * enriched `Portfolio`; every other book contributes its **last-known** value
 * from its imported prices. The result flags whether any last-known book is
 * folded in, so the UI can say so rather than implying the whole household is
 * live. Pure — takes the raw set + the active live portfolio, returns the
 * blend.
 */

import type { NamedPortfolio } from "./portfolios";
import type { Portfolio } from "./types";

export interface HouseholdBook {
  id: string;
  name: string;
  /** Total value (invested + cash). Live for the active book, last-known else. */
  value: number;
  /** Share of the household total. */
  weight: number;
  isActive: boolean;
  isDemo: boolean;
  count: number;
  /** Whether this book's value is live (only the active one is). */
  live: boolean;
}

export interface HouseholdHolding {
  symbol: string;
  name: string;
  /** Blended market value across every book that holds it. */
  value: number;
  /** Share of the household's invested total. */
  weight: number;
  /** How many books hold it (a name held in two accounts reads as one line). */
  bookCount: number;
}

export interface Household {
  total: number;
  cash: number;
  invested: number;
  books: HouseholdBook[];
  /** Blended holdings, largest first. */
  holdings: HouseholdHolding[];
  /** True when a non-active (last-known) book is folded into the total. */
  anyLastKnown: boolean;
}

interface Contribution {
  symbol: string;
  name: string;
  value: number;
}

/** The value + holdings a single book contributes — live if it's the active one. */
function bookContribution(
  book: NamedPortfolio,
  activeLive: Portfolio | null,
  isActive: boolean
): { value: number; cash: number; holdings: Contribution[] } {
  if (isActive && activeLive && Array.isArray(activeLive.positions)) {
    return {
      value: activeLive.totalValue,
      cash: activeLive.cash,
      holdings: activeLive.positions.map((p) => ({
        symbol: p.symbol,
        name: p.name,
        value: p.equity,
      })),
    };
  }
  const holdings = book.holdings.map((h) => ({
    symbol: h.symbol,
    name: h.name,
    value: Number.isFinite(h.equity) ? h.equity : h.shares * h.price,
  }));
  const invested = holdings.reduce((s, h) => s + h.value, 0);
  return { value: invested + (book.cash ?? 0), cash: book.cash ?? 0, holdings };
}

export function buildHousehold(
  books: NamedPortfolio[],
  activeId: string | null,
  activeLive: Portfolio | null
): Household {
  const bookRows: HouseholdBook[] = [];
  const bySymbol = new Map<string, { name: string; value: number; books: Set<string> }>();
  const activeIsLive = !!activeLive && Array.isArray(activeLive.positions);
  let total = 0;
  let cash = 0;

  for (const book of books) {
    const isActive = book.id === activeId;
    const { value, cash: bookCash, holdings } = bookContribution(book, activeLive, isActive);
    total += value;
    cash += bookCash;
    bookRows.push({
      id: book.id,
      name: book.name,
      value,
      weight: 0, // filled once the total is known
      isActive,
      isDemo: !!book.isDemo,
      count: book.holdings.length,
      live: isActive && activeIsLive,
    });
    for (const h of holdings) {
      if (h.value <= 0) continue;
      const entry = bySymbol.get(h.symbol);
      if (entry) {
        entry.value += h.value;
        entry.books.add(book.id);
      } else {
        bySymbol.set(h.symbol, { name: h.name, value: h.value, books: new Set([book.id]) });
      }
    }
  }

  const invested = total - cash;
  for (const b of bookRows) b.weight = total > 0 ? b.value / total : 0;

  const holdings: HouseholdHolding[] = [...bySymbol.entries()]
    .map(([symbol, e]) => ({
      symbol,
      name: e.name,
      value: e.value,
      weight: invested > 0 ? e.value / invested : 0,
      bookCount: e.books.size,
    }))
    .sort((a, b) => b.value - a.value);

  // Only the active book is live; every other counts as last-known.
  const anyLastKnown = books.some((b) => b.id !== activeId) || !activeIsLive;

  return {
    total,
    cash,
    invested,
    books: bookRows.sort((a, b) => b.value - a.value),
    holdings,
    anyLastKnown,
  };
}
