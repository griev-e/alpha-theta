/**
 * theta — the forward money assumptions.
 *
 * The projection, goal-feasibility and debt engines need a handful of inputs
 * with no observable value: what invested assets return, how volatile they are,
 * what cash yields, inflation, income growth, and the fallback APRs for debt
 * whose rate the ledger doesn't carry. These are the theta analogue of alpha's
 * market assumptions (`lib/data/assumptions.ts`): user-editable, preset-anchored
 * *views*, never frozen data masquerading as fact. The engines take them as an
 * explicit argument so they stay pure; the store (`assumptionsStore.tsx`)
 * persists the user's choices and feeds pages.
 *
 * The cash-yield default can be anchored to the live risk-free rate the sibling
 * alpha app already fetches (`/api/cma`), but the baseline here is a plausible
 * standing figure so theta works with no network at all.
 */

export interface ThetaAssumptions {
  /** Expected annual nominal return on invested assets (brokerage/retirement). */
  investReturn: number;
  /** Annualized volatility of invested assets — drives the projection fan width. */
  investVol: number;
  /** Expected annual yield on cash (checking/savings). */
  cashYield: number;
  /** Assumed annual inflation, for real-terms context. */
  inflation: number;
  /** Assumed annual growth of take-home income (raises contribution capacity). */
  incomeGrowth: number;
  /** Fallback APR for revolving credit when an account carries no explicit rate. */
  creditApr: number;
  /** Fallback APR for installment loans when an account carries no explicit rate. */
  loanApr: number;
}

export const DEFAULT_ASSUMPTIONS: ThetaAssumptions = {
  investReturn: 0.07,
  investVol: 0.15,
  cashYield: 0.04,
  inflation: 0.025,
  incomeGrowth: 0.03,
  creditApr: 0.22,
  loanApr: 0.07,
};

export type PresetId = "base" | "optimistic" | "conservative";

export interface AssumptionPreset {
  id: PresetId;
  label: string;
  blurb: string;
  values: ThetaAssumptions;
}

/**
 * Reference-anchored presets. "Base case" equals the standing defaults;
 * optimistic/conservative shift returns, yields and inflation the way a
 * planning conversation would frame a bull/bear world — the same
 * Market-today / 10-year / Recession spirit as alpha's benchmark presets.
 */
export const ASSUMPTION_PRESETS: AssumptionPreset[] = [
  {
    id: "base",
    label: "Base case",
    blurb: "Long-run averages — a diversified 7% nominal, 4% cash, ~2.5% inflation.",
    values: { ...DEFAULT_ASSUMPTIONS },
  },
  {
    id: "optimistic",
    label: "Optimistic",
    blurb: "A benign decade: higher returns and income growth, tamer inflation.",
    values: {
      investReturn: 0.09,
      investVol: 0.14,
      cashYield: 0.045,
      inflation: 0.02,
      incomeGrowth: 0.04,
      creditApr: 0.2,
      loanApr: 0.06,
    },
  },
  {
    id: "conservative",
    label: "Conservative",
    blurb: "A cautious plan: muted returns, wider swings, stickier inflation and rates.",
    values: {
      investReturn: 0.05,
      investVol: 0.17,
      cashYield: 0.03,
      inflation: 0.035,
      incomeGrowth: 0.02,
      creditApr: 0.24,
      loanApr: 0.08,
    },
  },
];

export const cloneAssumptions = (a: ThetaAssumptions): ThetaAssumptions => ({ ...a });

/** The preset whose values match `a` exactly, or null once the user customizes. */
export function matchPreset(a: ThetaAssumptions): PresetId | null {
  for (const p of ASSUMPTION_PRESETS) {
    const v = p.values;
    if (
      v.investReturn === a.investReturn &&
      v.investVol === a.investVol &&
      v.cashYield === a.cashYield &&
      v.inflation === a.inflation &&
      v.incomeGrowth === a.incomeGrowth &&
      v.creditApr === a.creditApr &&
      v.loanApr === a.loanApr
    ) {
      return p.id;
    }
  }
  return null;
}

import type { Account, AccountKind } from "./data";

/** Whether an account's balance is "invested" (subject to market return/vol). */
export function isInvested(kind: AccountKind): boolean {
  return kind === "brokerage" || kind === "retirement";
}

/** The effective APR for a liability: its own rate, else the kind's fallback. */
export function effectiveApr(account: Account, a: ThetaAssumptions): number {
  if (typeof account.apr === "number" && account.apr > 0) return account.apr;
  return account.kind === "credit" ? a.creditApr : a.loanApr;
}
