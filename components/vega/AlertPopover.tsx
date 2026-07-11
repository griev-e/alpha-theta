"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { requestAlertPermission } from "@/lib/vega/useAlertEngine";
import type { PriceAlert } from "@/lib/vega/types";

/**
 * The chart's alert control — a small popover to arm a price cross on the
 * focused symbol and manage what's already armed. Alerts are client-side:
 * swept against the 30s quote poll by useAlertEngine (mounted in VegaShell),
 * drawn on the chart as flagged levels, surfaced as toasts + browser
 * notifications when they fire.
 */
export function AlertPopover({
  symbol,
  currentPrice,
  alerts,
  onAdd,
  onDelete,
}: {
  symbol: string;
  currentPrice: number | null;
  /** Armed alerts for this symbol. */
  alerts: PriceAlert[];
  onAdd: (a: { symbol: string; price: number; dir: "above" | "below"; note?: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape — standard popover manners.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const parsed = Number.parseFloat(price);
  const valid = Number.isFinite(parsed) && parsed > 0;
  // Direction derives from where the level sits vs the market — an alert at
  // 105 with the tape at 100 is a cross-above by construction.
  const dir: "above" | "below" =
    valid && currentPrice !== null && parsed < currentPrice ? "below" : "above";

  const arm = () => {
    if (!valid) return;
    onAdd({ symbol, price: parsed, dir, note: note.trim() || undefined });
    requestAlertPermission();
    setPrice("");
    setNote("");
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] transition-colors ${
          alerts.length > 0
            ? "border-gold/50 bg-gold/[0.07] text-gold"
            : "border-edge text-faint hover:text-ink"
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 3 C7 3 5.6 5.2 5.6 8 V11.4 L4 14 H16 L14.4 11.4 V8 C14.4 5.2 13 3 10 3 Z" />
          <path d="M8.4 16.4 A1.8 1.8 0 0 0 11.6 16.4" />
        </svg>
        {alerts.length > 0 ? `${alerts.length} armed` : "Alert"}
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="overlay absolute right-0 top-9 z-50 w-72 rounded-lg border border-edge bg-[#0c0c0c] p-3 shadow-xl"
          >
            <div className="eyebrow mb-2">Arm a price alert · {symbol}</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                arm();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={currentPrice !== null ? currentPrice.toFixed(2) : "Price…"}
                aria-label="Alert price"
                inputMode="decimal"
                className="field h-8 w-24 tnum"
                autoFocus
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                aria-label="Alert note"
                className="field h-8 flex-1"
              />
              <button type="submit" disabled={!valid} className="btn-secondary h-8 shrink-0 disabled:opacity-40">
                Arm
              </button>
            </form>
            {valid && (
              <p className="mt-1.5 font-mono text-[10px] text-faint">
                fires when {symbol} crosses {dir} {parsed.toFixed(2)}
              </p>
            )}

            {alerts.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-edge pt-2.5">
                {alerts.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-gold">{a.dir === "above" ? "↑" : "↓"}</span>
                    <span className="tnum text-mute">{a.price.toFixed(2)}</span>
                    {a.note && <span className="truncate text-faint">{a.note}</span>}
                    <button
                      onClick={() => onDelete(a.id)}
                      aria-label={`Remove alert at ${a.price.toFixed(2)}`}
                      className="btn-ghost danger ml-auto h-5 w-5 shrink-0"
                    >
                      <svg width="9" height="9" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M5 5 L15 15 M15 5 L5 15" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2.5 text-[10px] leading-relaxed text-faint">
              Client-side: checked against the 30s quote poll while a vega tab is open. True-cross
              semantics — it arms, it crosses, it rings once.
            </p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
