"use client";

import { AnimatePresence, m } from "framer-motion";
import { useMemo, useState } from "react";
import { Select } from "@/components/theta/ui";
import {
  CATEGORIES,
  CATEGORY_COLOR,
  type Category,
} from "@/lib/theta/data";
import {
  type LearnedRules,
  merchantKey,
  suggestCategory,
  type SuggestSource,
} from "@/lib/theta/categorize";
import type { CategorizeResponse } from "@/lib/theta/intelligence";
import { fmtUSD } from "@/lib/format";

export type UncatItem = { id: string; merchant: string; amount: number };

type Source = SuggestSource | "ai";

type Row = {
  id: string;
  merchant: string;
  amount: number;
  category: Category;
  confidence: number;
  source: Source;
  include: boolean;
};

const SOURCE_LABEL: Record<Source, string> = {
  history: "From your history",
  keyword: "Keyword match",
  ai: "AI suggestion",
  amount: "Best guess",
  none: "No match",
};

/** Confidence → tone bucket, for the little strength bar + dot. */
function tier(conf: number, source: Source): { color: string; label: string } {
  if (source === "none") return { color: "var(--faint, #6b7280)", label: "Unmatched" };
  if (conf >= 0.8) return { color: "#34d399", label: "High" };
  if (conf >= 0.55) return { color: "#fbbf24", label: "Medium" };
  return { color: "#94a3b8", label: "Low" };
}

function buildRows(items: UncatItem[], learned: LearnedRules): Row[] {
  return items.map((it) => {
    const s = suggestCategory(it.merchant, it.amount, learned);
    return {
      id: it.id,
      merchant: it.merchant,
      amount: it.amount,
      category: s.category === "Other" ? "Shopping" : s.category,
      confidence: s.confidence,
      source: s.source,
      // Pre-check everything the engine could actually place.
      include: s.source !== "none",
    };
  });
}

/**
 * The auto-tagger's review step. Runs theta's local engine (`suggestCategory` +
 * learned history) over every "Other" merchant, shows a confidence-ranked list
 * you can tweak, and — when a Claude key is configured — offers a one-click AI
 * pass to place whatever the keyword rules couldn't. Nothing is written until
 * you press Apply, so it's always a review, never a surprise.
 */
export function AutoTagModal(props: {
  open: boolean;
  onClose: () => void;
  items: UncatItem[];
  learned: LearnedRules;
  onApply: (updates: { id: string; category: Category }[]) => void;
}) {
  // Mount the dialog only while open, so its state initializes fresh on each
  // open (no reset-via-effect) and AnimatePresence still plays the exit.
  return (
    <AnimatePresence>
      {props.open && <AutoTagDialog {...props} />}
    </AnimatePresence>
  );
}

function AutoTagDialog({
  onClose,
  items,
  learned,
  onApply,
}: {
  onClose: () => void;
  items: UncatItem[];
  learned: LearnedRules;
  onApply: (updates: { id: string; category: Category }[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => buildRows(items, learned));
  const [aiState, setAiState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  const selected = useMemo(() => rows.filter((r) => r.include).length, [rows]);
  const unmatched = useMemo(() => rows.filter((r) => r.source === "none").length, [rows]);
  const allOn = rows.length > 0 && selected === rows.length;

  const setRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  function toggleAll() {
    const next = !allOn;
    setRows((rs) => rs.map((r) => ({ ...r, include: next })));
  }

  async function improveWithAI() {
    // Send the rows the local engine was least sure about to Claude.
    const targets = rows.filter((r) => r.source === "none" || r.confidence < 0.55);
    if (targets.length === 0) return;
    setAiState("loading");
    setAiMsg(null);
    try {
      const res = await fetch("/api/theta/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: targets.map((r) => ({ merchant: r.merchant, amount: r.amount })) }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<CategorizeResponse> & { error?: string };
      if (!res.ok) {
        setAiState("error");
        setAiMsg(
          res.status === 501
            ? "AI categorizer isn't configured on this deployment."
            : (data.error ?? "Couldn't reach the categorizer.")
        );
        return;
      }
      const byKey = new Map((data.results ?? []).map((r) => [merchantKey(r.merchant), r.category]));
      let applied = 0;
      setRows((rs) =>
        rs.map((r) => {
          if (r.source !== "none" && r.confidence >= 0.55) return r;
          const cat = byKey.get(merchantKey(r.merchant));
          if (!cat || cat === "Other") return r;
          applied++;
          return { ...r, category: cat, confidence: 0.85, source: "ai", include: true };
        })
      );
      setAiState("done");
      setAiMsg(applied > 0 ? `AI placed ${applied} more merchant${applied === 1 ? "" : "s"}.` : "AI had nothing to add.");
    } catch {
      setAiState("error");
      setAiMsg("Couldn't reach the categorizer.");
    }
  }

  function apply() {
    const updates = rows
      .filter((r) => r.include && r.category !== "Other")
      .map((r) => ({ id: r.id, category: r.category }));
    onApply(updates);
    onClose();
  }

  return (
    <m.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <m.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="panel relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col p-0"
      >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-edge px-5 py-4">
              <div>
                <div className="eyebrow mb-0.5">Cleanup</div>
                <h2 className="font-display text-[15px] font-medium text-ink">Auto-tag transactions</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-mute">
                  {rows.length} merchant{rows.length === 1 ? "" : "s"} in{" "}
                  <span className="text-ink">Other</span>. Suggestions come from your own history
                  and theta&apos;s keyword rules — review, then apply.
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-mute transition-colors hover:bg-white/[0.06] hover:text-ink"
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 border-b border-edge/60 px-5 py-2.5">
              <button
                onClick={toggleAll}
                className="inline-flex items-center gap-2 text-[12.5px] text-mute transition-colors hover:text-ink"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    allOn ? "border-vio/60 bg-vio/70" : "border-edge2"
                  }`}
                >
                  {allOn && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                    </svg>
                  )}
                </span>
                {selected} of {rows.length} selected
              </button>
              <button
                onClick={improveWithAI}
                disabled={aiState === "loading"}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-vio/40 px-2.5 text-[12px] text-vio transition-colors hover:bg-vio/10 disabled:opacity-40"
                title="Ask Claude to place the merchants the local rules couldn't"
              >
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5 8.4 10.1 4 8.5l4.4-1.6z" />
                </svg>
                {aiState === "loading" ? "Asking Claude…" : "Improve with AI"}
              </button>
            </div>

            {/* List */}
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {rows.map((r) => {
                const accent = CATEGORY_COLOR[r.category];
                const t = tier(r.confidence, r.source);
                return (
                  <div
                    key={r.id}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.03] ${
                      r.include ? "" : "opacity-55"
                    }`}
                  >
                    <button
                      onClick={() => setRow(r.id, { include: !r.include })}
                      aria-label={r.include ? "Exclude" : "Include"}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        r.include ? "border-vio/60 bg-vio/70" : "border-edge2"
                      }`}
                    >
                      {r.include && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                        </svg>
                      )}
                    </button>

                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[13px] font-medium"
                      style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}
                    >
                      {r.merchant.charAt(0)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] text-ink">{r.merchant}</div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />
                        <span className="text-[11px] text-faint">{SOURCE_LABEL[r.source]}</span>
                      </div>
                    </div>

                    <span className="hidden shrink-0 font-mono tnum text-[12px] text-mute sm:block">
                      {r.amount > 0 ? "+" : "−"}
                      {fmtUSD(Math.abs(r.amount))}
                    </span>

                    <div className="w-36 shrink-0">
                      <Select
                        value={r.category}
                        onChange={(e) => setRow(r.id, { category: e.target.value as Category, include: true })}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                );
              })}
              {rows.length === 0 && (
                <p className="px-3 py-8 text-center text-[13px] text-faint">Nothing to categorize.</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-edge px-5 py-3.5">
              <span className="text-[11.5px] text-faint">
                {aiMsg ? (
                  <span className={aiState === "error" ? "text-neg" : "text-mute"}>{aiMsg}</span>
                ) : unmatched > 0 ? (
                  `${unmatched} still unmatched — pick a category or try AI.`
                ) : (
                  "Applying also tags future charges from these merchants."
                )}
              </span>
              <div className="flex gap-2">
                <button onClick={onClose} className="btn-secondary">Cancel</button>
                <button onClick={apply} disabled={selected === 0} className="btn-primary disabled:opacity-40">
                  Apply {selected} tag{selected === 1 ? "" : "s"}
                </button>
              </div>
            </div>
      </m.div>
    </m.div>
  );
}
