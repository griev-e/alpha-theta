import { buildPortfolio } from "../analytics/build";
import type { Portfolio, RawHolding } from "../types";

/**
 * Test helpers for building portfolios. Tests run against the real
 * `buildPortfolio` path so the `Position` objects (weights, fundamentals
 * merge, P&L) match exactly what the app produces.
 */

export function holding(
  partial: Partial<RawHolding> & { symbol: string }
): RawHolding {
  const shares = partial.shares ?? 10;
  const price = partial.price ?? 100;
  const averageCost = partial.averageCost ?? price;
  const equity = partial.equity ?? shares * price;
  return {
    name: partial.name ?? partial.symbol,
    symbol: partial.symbol,
    shares,
    price,
    averageCost,
    equity,
    totalReturn: partial.totalReturn ?? equity - shares * averageCost,
  };
}

export function makePortfolio(
  holdings: RawHolding[],
  cash = 0
): Portfolio {
  return buildPortfolio(holdings, cash, "2026-06-10T00:00:00.000Z");
}
