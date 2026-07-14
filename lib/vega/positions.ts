import { isClosed, tradeRisk } from "./journal";
import type { Trade, VegaQuote } from "./types";

/**
 * Live open-position math — marking the journal's working positions against
 * the quote poll. Pure functions: quotes are an explicit input, and a symbol
 * with no live quote marks to `null` (shown as unpriced), never to a stale or
 * imputed value — the house no-data rule.
 */

export interface PositionMark {
  trade: Trade;
  /** Live mark, or null when the quote poll has nothing for the symbol. */
  last: number | null;
  /** Unrealized P&L at the mark (fees NOT subtracted — they're charged on
   *  the round trip and the journal takes them at close). */
  unrealized: number | null;
  /** Unrealized R-multiple; needs both a mark and a planned stop. */
  unrealizedR: number | null;
  /** Signed % move from entry in the trade's favor (short profits are +). */
  movePct: number | null;
  /** Dollars still at risk to the planned stop from HERE (0 once the mark is
   *  past breakeven-at-stop territory, i.e. the stop now locks in a gain). */
  riskToStop: number | null;
  /** Distance to the stop as % of the mark (negative once breached). */
  stopDistancePct: number | null;
  /** Progress from entry toward the target, 0..1+; null without a target. */
  targetProgress: number | null;
}

export function openTrades(trades: Trade[]): Trade[] {
  return trades.filter((t) => !isClosed(t));
}

/** Mark one open trade against a quote (null quote → unpriced mark). */
export function markPosition(trade: Trade, quote: VegaQuote | undefined): PositionMark {
  const last = quote && Number.isFinite(quote.price) && quote.price > 0 ? quote.price : null;
  const dir = trade.side === "long" ? 1 : -1;
  if (last === null) {
    return {
      trade,
      last: null,
      unrealized: null,
      unrealizedR: null,
      movePct: null,
      riskToStop: null,
      stopDistancePct: null,
      targetProgress: null,
    };
  }
  const unrealized = (last - trade.entry) * trade.qty * dir;
  const risk = tradeRisk(trade);
  const stop = trade.stop;
  const riskToStop =
    stop !== undefined && stop > 0
      ? Math.max(0, (last - stop) * dir) * trade.qty
      : null;
  const target = trade.target;
  const targetSpan = target !== undefined ? (target - trade.entry) * dir : 0;
  return {
    trade,
    last,
    unrealized,
    unrealizedR: risk !== null ? unrealized / risk : null,
    movePct: ((last - trade.entry) / trade.entry) * dir,
    riskToStop,
    stopDistancePct: stop !== undefined && stop > 0 ? ((last - stop) * dir) / last : null,
    targetProgress:
      target !== undefined && targetSpan > 0
        ? ((last - trade.entry) * dir) / targetSpan
        : null,
  };
}

export interface OpenBook {
  positions: PositionMark[];
  /** Count of open trades. */
  count: number;
  /** Sum of unrealized P&L over PRICED positions. Null when none priced. */
  unrealized: number | null;
  /** How many open trades have no live quote right now. */
  unpriced: number;
  /** Total dollars at risk to the planned stops (priced positions with stops). */
  riskToStop: number;
  /** Open trades carrying no stop — unbounded risk the book can't total. */
  noStop: number;
  /** Gross notional at the mark, over priced positions. */
  notional: number;
}

/** The whole working book, marked. Deterministic per (trades, quotes). */
export function markOpenBook(
  trades: Trade[],
  quotes: Record<string, VegaQuote>
): OpenBook {
  const positions = openTrades(trades).map((t) => markPosition(t, quotes[t.symbol]));
  const priced = positions.filter((p) => p.last !== null);
  return {
    positions,
    count: positions.length,
    unrealized:
      priced.length > 0
        ? priced.reduce((s, p) => s + (p.unrealized ?? 0), 0)
        : null,
    unpriced: positions.length - priced.length,
    riskToStop: positions.reduce((s, p) => s + (p.riskToStop ?? 0), 0),
    noStop: positions.filter((p) => p.trade.stop === undefined).length,
    notional: priced.reduce((s, p) => s + (p.last as number) * p.trade.qty, 0),
  };
}
