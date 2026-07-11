import type { PriceAlert, VegaQuote } from "./types";

/**
 * Price-alert evaluation — the pure half of vega's client-side alert engine.
 * Alerts live in the persisted vega blob and are checked against the 30s
 * quote poll: no server state, no push infrastructure, just the tape the
 * cockpit is already watching.
 *
 * Firing is TRUE-CROSS semantics (the TradingView convention): an "above"
 * alert fires only when the previous observed price was below the level and
 * the current one is at/through it — so creating an alert under the market, or
 * a page reload mid-session, never fires it spuriously. A fired alert stays
 * (with its timestamp) until dismissed; it never re-arms.
 */

export interface AlertSweep {
  /** Alerts that crossed on this tick, already stamped with `firedAt`. */
  fired: PriceAlert[];
  /** The full alert list with fired ones stamped — persist this. */
  next: PriceAlert[];
}

/** Latest observed price per symbol (extended-hours aware). */
export type PriceMap = Record<string, number>;

export function pricesFromQuotes(quotes: Record<string, VegaQuote>): PriceMap {
  const out: PriceMap = {};
  for (const [sym, q] of Object.entries(quotes)) {
    if (Number.isFinite(q.price) && q.price > 0) out[sym] = q.price;
  }
  return out;
}

const crossed = (a: PriceAlert, prev: number, cur: number): boolean =>
  a.dir === "above" ? prev < a.price && cur >= a.price : prev > a.price && cur <= a.price;

/**
 * Sweep the alert list against a previous/current price snapshot. Pure:
 * returns the fired subset and the stamped next state; the caller persists
 * `next` and surfaces `fired`. Symbols absent from either snapshot are
 * skipped (no data ≠ a cross).
 */
export function sweepAlerts(
  alerts: PriceAlert[],
  prev: PriceMap,
  cur: PriceMap,
  nowIso: string
): AlertSweep {
  const fired: PriceAlert[] = [];
  let changed = false;
  const next = alerts.map((a) => {
    if (a.firedAt) return a;
    const p = prev[a.symbol];
    const c = cur[a.symbol];
    if (p === undefined || c === undefined) return a;
    if (!crossed(a, p, c)) return a;
    const hit = { ...a, firedAt: nowIso };
    fired.push(hit);
    changed = true;
    return hit;
  });
  return { fired, next: changed ? next : alerts };
}

/**
 * Cap-aware insert. At the ALERTS_MAX ceiling the oldest FIRED alert makes
 * room (it already rang; the list is history at that point) — but an armed
 * alert is never silently evicted: when the list is all armed, the add is
 * refused (returns null) so the UI can say "cap reached" instead of a level
 * quietly vanishing while a trader is counting on it.
 */
export function withAlertAdded(
  alerts: PriceAlert[],
  alert: PriceAlert,
  max: number
): PriceAlert[] | null {
  if (alerts.length < max) return [...alerts, alert];
  const fired = alerts.filter((a) => a.firedAt);
  if (fired.length === 0) return null;
  const oldest = fired.reduce((a, b) =>
    (a.firedAt as string) <= (b.firedAt as string) ? a : b
  );
  return [...alerts.filter((a) => a.id !== oldest.id), alert];
}

/** Armed (not-yet-fired) alerts for a symbol, nearest level first. */
export function armedAlerts(alerts: PriceAlert[], symbol?: string): PriceAlert[] {
  return alerts
    .filter((a) => !a.firedAt && (symbol === undefined || a.symbol === symbol))
    .sort((a, b) => a.symbol.localeCompare(b.symbol) || a.price - b.price);
}

/** Fired alerts, most recent first. */
export function firedAlerts(alerts: PriceAlert[]): PriceAlert[] {
  return alerts
    .filter((a) => !!a.firedAt)
    .sort((a, b) => (b.firedAt as string).localeCompare(a.firedAt as string));
}
