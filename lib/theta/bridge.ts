/**
 * theta ↔ alpha bridge.
 *
 * A theta brokerage / retirement account can carry a `linkedPortfolioId`
 * pointing at one of the user's alpha portfolios. When it does, the account's
 * balance should reflect that portfolio's *live* market value rather than a
 * number the user maintains by hand — the one place the two sister apps
 * genuinely compound. Both stores live in the same provider tree
 * (`PortfolioProvider` wraps `ThetaProvider`), so the theta store can read the
 * alpha value and apply it here.
 *
 * This helper is pure: given the ledger and a map of `portfolioId → live value`,
 * it returns a ledger whose linked accounts have their balance overridden (and
 * their sparkline tail nudged to the new value). Only the *active* alpha
 * portfolio is live-priced by the store, so unresolved links keep their manual
 * balance — an honest floor, never a stale value masquerading as live.
 */

import type { Account, Ledger } from "./data";

/** Apply live portfolio values to any account linked to a resolvable portfolio. */
export function applyPortfolioLinks(
  ledger: Ledger,
  values: Map<string, number>
): Ledger {
  if (values.size === 0 || !ledger.accounts.some((a) => a.linkedPortfolioId)) return ledger;

  let changed = false;
  const accounts = ledger.accounts.map((a): Account => {
    if (!a.linkedPortfolioId) return a;
    const value = values.get(a.linkedPortfolioId);
    if (value === undefined || value === a.balance) return a;
    changed = true;
    // Keep the trend continuous: replace the last sample with the live value.
    const trend = a.trend.length ? [...a.trend.slice(0, -1), value] : [value];
    return { ...a, balance: value, trend };
  });

  return changed ? { ...ledger, accounts } : ledger;
}

/** True when any account in the ledger is bridged to an alpha portfolio. */
export const hasPortfolioLinks = (ledger: Ledger | null): boolean =>
  !!ledger?.accounts.some((a) => a.linkedPortfolioId);
