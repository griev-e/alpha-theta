/**
 * Pure merge of a SimpleFIN sync into an existing ledger's accounts +
 * transactions. Extracted from the store so the dedup rules — which back a few
 * subtle, user-visible behaviors — are unit-testable in isolation:
 *
 *  - **Deleted accounts stay deleted.** Accounts the user removed are recorded
 *    in `ledger.dismissedSyncAccounts`; their synced rows (and transactions) are
 *    dropped here, so a re-sync doesn't resurrect them.
 *  - **Manual re-tags survive a re-sync.** The server re-derives a category from
 *    the merchant on every pull, so for a transaction already in the ledger we
 *    keep the *existing* category (which reflects any user edit) and only update
 *    the volatile fields (amount, date, pending). Without this a hand-tagged
 *    "ATM Fee" — which no keyword rule places — reverts to "Other" each sync.
 *  - **A corrected account type survives a re-sync**, for the same reason: the
 *    payload carries no account-type field, so `inferKind` re-guesses it from
 *    the name on every pull. An account already in the ledger keeps its
 *    existing `kind` (whatever the user set it to, or the original guess if
 *    they never touched it) rather than being overwritten by a fresh guess.
 *  - **Balance trends extend** rather than reset for an account seen before.
 */
import type { Account, Ledger, Transaction } from "./data";

export type SimplefinSync = { accounts: Account[]; transactions: Transaction[] };

export function mergeSimplefinSync(
  ledger: Ledger,
  sync: SimplefinSync
): { accounts: Account[]; transactions: Transaction[] } {
  const dismissed = new Set(ledger.dismissedSyncAccounts ?? []);
  const incomingAccounts = sync.accounts.filter((a) => !dismissed.has(a.id));
  const incomingTx = sync.transactions.filter((t) => !dismissed.has(t.account));

  // Accounts: upsert by id; keep manual accounts untouched and extend (rather
  // than reset) an existing balance trend on each sync.
  const prevAcct = new Map(ledger.accounts.map((a) => [a.id, a]));
  const synced: Account[] = incomingAccounts.map((a) => {
    const existing = prevAcct.get(a.id);
    if (!existing) return a;
    return {
      ...existing,
      ...a,
      kind: existing.kind, // a user correction (or the original guess) always wins
      trend: [...existing.trend.slice(1), a.balance],
    };
  });
  const syncedIds = new Set(incomingAccounts.map((a) => a.id));
  const accounts = [...ledger.accounts.filter((a) => !syncedIds.has(a.id)), ...synced];

  // Transactions: incoming (stable-id) rows replace prior copies of themselves,
  // but keep the ledger's category so a manual re-tag isn't clobbered.
  const prevTx = new Map(ledger.transactions.map((t) => [t.id, t]));
  const merged = incomingTx.map((t) => {
    const existing = prevTx.get(t.id);
    return existing ? { ...t, category: existing.category } : t;
  });
  const txIds = new Set(merged.map((t) => t.id));
  const transactions = [
    ...merged,
    ...ledger.transactions.filter((t) => !txIds.has(t.id)),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return { accounts, transactions };
}
