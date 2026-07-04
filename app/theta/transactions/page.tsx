"use client";

import { Fragment, useMemo, useState } from "react";
import { m } from "framer-motion";
import { TransactionFilter } from "@/components/theta/TransactionFilter";
import { AddTransactionButton } from "@/components/theta/modals";
import { ThetaEmpty } from "@/components/theta/ui";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { CATEGORIES, type Category, type Transaction } from "@/lib/theta/data";
import { learnRules } from "@/lib/theta/categorize";
import { ledgerHasData, useTheta } from "@/lib/theta/store";
import { fmtUSD } from "@/lib/format";
import { TxRow } from "./TxRow";
import { AutoTagModal, type UncatItem } from "./AutoTagModal";

const FILTERS: (Category | "All")[] = [
  "All",
  "Food & Dining",
  "Shopping",
  "Transport",
  "Housing",
  "Utilities",
  "Health",
  "Entertainment",
  "Subscriptions",
  "Travel",
  "Income",
  "Transfer",
];

/** "Today" / "Yesterday" / "Mon, Jun 26" for a date-section header. */
function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function TransactionsPage() {
  const {
    ready,
    ledger,
    deleteTransaction,
    setTransactionCategory,
    setTransactionCategories,
    toggleAccountHidden,
    toggleCategoryHidden,
    resetTransactionFilters,
  } = useTheta();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Category | "All">("All");
  const [autoTagOpen, setAutoTagOpen] = useState(false);

  const transactions = useMemo(() => ledger?.transactions ?? [], [ledger]);
  const accounts = useMemo(() => ledger?.accounts ?? [], [ledger]);
  const hiddenAccounts = useMemo(() => ledger?.hiddenAccounts ?? [], [ledger]);
  const hiddenCategories = useMemo(() => ledger?.hiddenCategories ?? [], [ledger]);
  const hiddenAcctSet = useMemo(() => new Set(hiddenAccounts), [hiddenAccounts]);
  const hiddenCatSet = useMemo(() => new Set(hiddenCategories), [hiddenCategories]);
  const acctName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;

  // Categories actually present in the ledger, in the canonical order.
  const presentCategories = useMemo(() => {
    const seen = new Set(transactions.map((t) => t.category));
    return CATEGORIES.filter((c) => seen.has(c));
  }, [transactions]);

  // The auto-tagger operates only on visible activity: an excluded account
  // (e.g. a brokerage whose buys/sells you've hidden) must never surface in the
  // banner or the review modal — those trades don't belong to any spending
  // category, so nagging to tag them, or asking the AI to, is exactly the noise
  // the exclusion was meant to remove. Learn only from visible rows too.
  const visibleForTagging = useMemo(
    () => transactions.filter((t) => !hiddenAcctSet.has(t.account) && !hiddenCatSet.has(t.category)),
    [transactions, hiddenAcctSet, hiddenCatSet]
  );
  const learned = useMemo(() => learnRules(visibleForTagging), [visibleForTagging]);
  const uncategorized = useMemo<UncatItem[]>(() => {
    const byMerchant = new Map<string, UncatItem>();
    for (const t of visibleForTagging) {
      if (t.category !== "Other") continue;
      const key = t.merchant.trim().toLowerCase();
      if (!byMerchant.has(key)) byMerchant.set(key, { id: t.id, merchant: t.merchant, amount: t.amount });
    }
    return [...byMerchant.values()];
  }, [visibleForTagging]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (hiddenAcctSet.has(t.account)) return false;
      if (hiddenCatSet.has(t.category)) return false;
      if (cat !== "All" && t.category !== cat) return false;
      if (q && !t.merchant.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [transactions, query, cat, hiddenAcctSet, hiddenCatSet]);

  // Group the visible rows into date sections (input is already newest-first).
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const arr = map.get(t.date);
      if (arr) arr.push(t);
      else map.set(t.date, [t]);
    }
    return [...map.entries()];
  }, [filtered]);

  if (!ready) return null;
  if (!ledger || !ledgerHasData(ledger)) return <ThetaEmpty page="Transactions" />;

  const moneyIn = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const moneyOut = filtered
    .filter((t) => t.amount < 0 && t.category !== "Transfer")
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const net = moneyIn - moneyOut;

  let rowIndex = 0; // running index across groups, for the row stagger

  return (
    <div>
      <PageHeader
        eyebrow="Money"
        title="Transactions"
        description="Every charge and deposit across your accounts, newest first."
        right={<AddTransactionButton />}
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="px-5 py-4" i={0} hover={false}>
          <Stat label="Money in" value={moneyIn} format={(v) => fmtUSD(v, true)} size="sm" toneClass="text-pos" />
        </Card>
        <Card className="px-5 py-4" i={1} hover={false}>
          <Stat label="Money out" value={moneyOut} format={(v) => fmtUSD(v, true)} size="sm" />
        </Card>
        <Card className="px-5 py-4" i={2} hover={false}>
          <Stat
            label="Net"
            value={net}
            format={(v) => `${v >= 0 ? "+" : "−"}${fmtUSD(Math.abs(v), true)}`}
            size="sm"
            toneClass={net >= 0 ? "text-pos" : "text-neg"}
          />
        </Card>
      </div>

      {uncategorized.length > 0 && (
        <m.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          onClick={() => setAutoTagOpen(true)}
          className="group mb-4 flex w-full items-center gap-3 rounded-xl border border-vio/30 bg-vio/[0.07] px-4 py-3 text-left transition-colors hover:bg-vio/[0.12]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vio/15 text-vio">
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2.5l1.7 4.6 4.6 1.7-4.6 1.7L10 15.1 8.3 10.5 3.7 8.8l4.6-1.7z" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium text-ink">
              {uncategorized.length} merchant{uncategorized.length === 1 ? " needs" : "s need"} a category
            </span>
            <span className="block text-[12px] text-mute">
              Auto-tag them from your history and keyword rules — review before applying.
            </span>
          </span>
          <span className="inline-flex h-8 shrink-0 items-center rounded-lg bg-vio px-3 text-[12.5px] font-medium text-black transition-transform group-hover:scale-[1.03]">
            Auto-tag
          </span>
        </m.button>
      )}

      <Card className="overflow-hidden" i={3}>
        <div className="flex flex-col gap-3 border-b border-edge px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 lg:w-72">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
                <circle cx="8.6" cy="8.6" r="5.4" />
                <path d="M12.6 12.6 L17 17" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search merchants..."
                className="h-9 w-full rounded-md border border-edge bg-white/[0.03] pl-9 pr-3 text-[13px] text-ink placeholder:text-faint outline-none transition-colors focus:border-edge2"
              />
            </div>
            <TransactionFilter
              accounts={accounts}
              categories={presentCategories}
              hiddenAccounts={hiddenAccounts}
              hiddenCategories={hiddenCategories}
              onToggleAccount={toggleAccountHidden}
              onToggleCategory={toggleCategoryHidden}
              onReset={resetTransactionFilters}
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-[12px] transition-colors ${
                  cat === c ? "border-edge2 bg-white/[0.08] text-ink" : "border-edge text-mute hover:text-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <tbody>
              {groups.map(([date, rows]) => {
                const dayNet = rows.reduce((s, t) => s + t.amount, 0);
                return (
                  <Fragment key={date}>
                    <tr className="border-b border-edge/60 bg-white/[0.015]">
                      <td colSpan={4} className="px-6 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-faint">
                            {dayLabel(date)}
                          </span>
                          <span className={`font-mono tnum text-[11px] ${dayNet >= 0 ? "text-pos/80" : "text-faint"}`}>
                            {dayNet >= 0 ? "+" : "−"}{fmtUSD(Math.abs(dayNet))}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {rows.map((t) => (
                      <TxRow
                        key={t.id}
                        t={t}
                        i={rowIndex++}
                        accountName={acctName(t.account)}
                        onDelete={deleteTransaction}
                        onChangeCategory={setTransactionCategory}
                      />
                    ))}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-6 py-10 text-center text-[13px] text-faint">No transactions match.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <AutoTagModal
        open={autoTagOpen}
        onClose={() => setAutoTagOpen(false)}
        items={uncategorized}
        learned={learned}
        onApply={setTransactionCategories}
      />
    </div>
  );
}
