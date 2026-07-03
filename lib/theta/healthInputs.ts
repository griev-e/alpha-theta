/**
 * Adapter: assemble the pure `HealthInputs` for `scoreHealth` from a ledger +
 * its derived view + assumptions. Kept out of `health.ts` so the scorer stays a
 * pure function of its inputs (and unit-testable without the whole ledger), the
 * same separation alpha keeps between `buildPortfolio` and `quality.ts`.
 */

import type { ThetaView } from "./compute";
import type { Category, Ledger } from "./data";
import { isInvested, type ThetaAssumptions } from "./assumptions";
import { debtLines, planDebtPayoff } from "./debt";
import type { HealthInputs } from "./health";

/** Categories treated as essential (non-discretionary) monthly spend. */
const ESSENTIAL: Category[] = ["Housing", "Utilities", "Food & Dining", "Transport", "Health"];

export function healthInputsFromLedger(
  ledger: Ledger,
  view: ThetaView,
  a: ThetaAssumptions
): HealthInputs {
  const accounts = ledger.accounts;
  const liquidAssets = accounts
    .filter((acc) => acc.balance > 0 && !isInvested(acc.kind))
    .reduce((s, acc) => s + acc.balance, 0);
  const totalAssets = accounts.filter((acc) => acc.balance > 0).reduce((s, acc) => s + acc.balance, 0);

  const essentialMonthly = view.spending
    .filter((s) => ESSENTIAL.includes(s.category))
    .reduce((s, x) => s + x.amount, 0);
  const housingMonthly = view.spending.find((s) => s.category === "Housing")?.amount ?? 0;

  const monthlyDebtService = planDebtPayoff(debtLines(accounts, a), Number.MAX_SAFE_INTEGER, "avalanche").totalMinimum;

  const credit = accounts.filter((acc) => acc.kind === "credit");
  const revolvingBalance = credit.reduce((s, acc) => s + Math.max(0, -acc.balance), 0);
  const revolvingLimit = credit.reduce((s, acc) => s + (acc.creditLimit ?? 0), 0);

  return {
    liquidAssets,
    totalAssets,
    monthlyIncome: view.monthIncome,
    essentialMonthly,
    savingsRate: view.savingsRate,
    monthlyDebtService,
    revolvingBalance,
    revolvingLimit,
    housingMonthly,
  };
}
