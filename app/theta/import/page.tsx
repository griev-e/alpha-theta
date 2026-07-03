"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useTheta } from "@/lib/theta/store";
import { SimplefinCard } from "@/components/theta/SimplefinCard";
import type { CategorizeResponse } from "@/lib/theta/intelligence";

export default function ThetaImportPage() {
  const { ready, ledger, isSample, loadSample, clear, setTransactionCategory } = useTheta();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [categorizing, setCategorizing] = useState(false);

  // One representative transaction id per uncategorized merchant — the set the
  // AI categorizer can clean up (everything still sitting in "Other").
  const uncategorized = useMemo(() => {
    const byMerchant = new Map<string, { id: string; merchant: string; amount: number }>();
    for (const t of ledger?.transactions ?? []) {
      if (t.category !== "Other") continue;
      const key = t.merchant.trim().toLowerCase();
      if (!byMerchant.has(key)) byMerchant.set(key, { id: t.id, merchant: t.merchant, amount: t.amount });
    }
    return [...byMerchant.values()];
  }, [ledger]);

  if (!ready) return null;
  const accounts = ledger?.accounts ?? [];

  async function autoCategorize() {
    if (uncategorized.length === 0) return;
    setCategorizing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/theta/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: uncategorized.map((u) => ({ merchant: u.merchant, amount: u.amount })) }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<CategorizeResponse> & { error?: string };
      if (!res.ok) {
        setMsg({
          tone: "err",
          text:
            res.status === 501
              ? "AI categorizer isn't configured on this deployment (set ANTHROPIC_API_KEY)."
              : (data.error ?? "Couldn't reach the categorizer. Try again."),
        });
        return;
      }
      const byMerchant = new Map(uncategorized.map((u) => [u.merchant.trim().toLowerCase(), u.id]));
      let applied = 0;
      for (const r of data.results ?? []) {
        if (r.category === "Other") continue;
        const id = byMerchant.get(r.merchant.trim().toLowerCase());
        if (id) {
          setTransactionCategory(id, r.category);
          applied++;
        }
      }
      setMsg({
        tone: "ok",
        text: applied > 0 ? `Categorized ${applied} merchant${applied === 1 ? "" : "s"}.` : "Nothing new to categorize.",
      });
    } catch {
      setMsg({ tone: "err", text: "Couldn't reach the categorizer. Try again." });
    } finally {
      setCategorizing(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Import & Data"
        description="Connect a bank to sync balances and transactions automatically, or manage the sample ledger."
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          <SimplefinCard i={0} />

          <Card className="px-5 py-5" i={1}>
            <CardHeader
              eyebrow="Cleanup"
              title="Auto-categorize with AI"
              className="mb-3"
            />
            <p className="mb-3 text-[13px] leading-relaxed text-mute">
              Synced and manually-added transactions that the keyword rules
              couldn&apos;t place stay in <span className="text-ink">Other</span>. Let
              Claude sort the rest into theta&apos;s categories in one pass.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={autoCategorize}
                disabled={categorizing || uncategorized.length === 0}
                className="btn-primary disabled:opacity-40"
              >
                {categorizing ? "Categorizing…" : "Categorize"}
              </button>
              <span className="text-[12px] text-faint">
                {uncategorized.length > 0
                  ? `${uncategorized.length} merchant${uncategorized.length === 1 ? "" : "s"} in "Other"`
                  : "Nothing uncategorized"}
              </span>
            </div>
          </Card>
        </div>

        <Card className="px-5 py-5" i={2}>
          <CardHeader eyebrow="Ledger" title="Your data" className="mb-4" />
          <div className="flex flex-col divide-y divide-edge/60 text-[13px]">
            <Stat2 label="Accounts" value={accounts.length} />
            <Stat2 label="Transactions" value={ledger?.transactions.length ?? 0} />
            <Stat2 label="Budgets" value={ledger?.budgets.length ?? 0} />
            <Stat2 label="Goals" value={ledger?.goals.length ?? 0} />
            <Stat2 label="Recurring" value={ledger?.recurring.length ?? 0} />
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <button onClick={() => { loadSample(); setMsg({ tone: "ok", text: "Sample ledger loaded." }); }} className="btn-secondary w-full">
              Load sample ledger
            </button>
            <button
              onClick={() => { clear(); setMsg({ tone: "ok", text: "Ledger cleared." }); }}
              className="inline-flex h-8 w-full items-center justify-center rounded-lg border border-neg/30 text-[13px] font-medium text-neg/90 transition-colors hover:bg-neg/10"
            >
              Clear all data
            </button>
          </div>

          <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
            {isSample ? "Currently showing sample data. " : ""}
            Everything is stored in this browser only — nothing leaves your device.
          </p>
        </Card>
      </div>

      {msg && (
        <div className={`mt-5 rounded-md border px-3 py-2 text-[12.5px] ${
          msg.tone === "ok" ? "border-pos/30 bg-pos/10 text-pos" : "border-neg/30 bg-neg/10 text-neg"
        }`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

function Stat2({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
      <span className="text-mute">{label}</span>
      <span className="font-mono tnum text-ink">{value}</span>
    </div>
  );
}
