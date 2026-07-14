"use client";

import { useRef, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { SymbolSearch } from "@/components/vega/SymbolSearch";
import { parseTradesCsv, tradesToCsv } from "@/lib/vega/csv";
import { useVega } from "@/lib/vega/store";
import { WATCHLIST_MAX, WATCHLIST_PRESETS } from "@/lib/vega/types";

/**
 * Import & Data — journal CSV round-trip, the watchlist editor, sample data,
 * and the reset switches. Everything vega persists lives in this browser
 * (localStorage); nothing is sent anywhere.
 */
export default function VegaImportPage() {
  const {
    state,
    importTrades,
    addToWatchlist,
    addManyToWatchlist,
    removeFromWatchlist,
    loadSampleJournal,
    clearJournal,
    clearAll,
  } = useVega();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState<null | "journal" | "all">(null);

  const loadPreset = (label: string, symbols: readonly string[]) => {
    const n = addManyToWatchlist([...symbols]);
    toast(
      n > 0
        ? `Added ${n} from ${label}`
        : state.watchlist.length >= WATCHLIST_MAX
          ? "The board is full — remove something first"
          : "Already watching all of those"
    );
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    const { trades, skipped } = parseTradesCsv(text);
    if (trades.length === 0) {
      toast(skipped > 0 ? `No usable rows (${skipped} skipped)` : "That file has no trade rows");
      return;
    }
    importTrades(trades);
    toast(`Imported ${trades.length} trades${skipped > 0 ? ` · ${skipped} skipped` : ""}`);
  };

  const exportCsv = () => {
    const blob = new Blob([tradesToCsv(state.trades)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vega-journal-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Import & Data"
        description="Bring a journal in, take it out, tune the board. Everything stays in this browser."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Journal I/O */}
        <Card i={0} className="p-5">
          <CardHeader eyebrow="Journal" title="Import trades (CSV)" />
          <p className="mt-2 text-[12.5px] leading-relaxed text-mute">
            Any column order; headers like <code className="font-mono text-[11px]">symbol, side, qty, entry, exit, stop, entryAt, setup</code>{" "}
            (broker aliases understood). Re-importing skips exact duplicates.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button onClick={() => fileRef.current?.click()} className="btn-primary">
              Choose CSV…
            </button>
            <button
              onClick={exportCsv}
              className="btn-secondary"
              disabled={state.trades.length === 0}
            >
              Export {state.trades.length > 0 ? `${state.trades.length} trades` : "journal"}
            </button>
          </div>
        </Card>

        {/* Sample + resets */}
        <Card i={1} className="p-5">
          <CardHeader eyebrow="Data" title="Sample & reset" />
          <p className="mt-2 text-[12.5px] leading-relaxed text-mute">
            The sample journal is an illustrative month of day trades — badged everywhere it
            shows, and replaced the moment you log or import your own.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button onClick={() => { loadSampleJournal(); toast("Sample journal loaded"); }} className="btn-secondary">
              Load sample journal
            </button>
            {confirmClear === "journal" ? (
              <button
                onClick={() => { clearJournal(); setConfirmClear(null); toast("Journal cleared"); }}
                className="btn-secondary border-[color-mix(in_srgb,var(--color-neg)_50%,transparent)] text-neg"
              >
                Confirm clear journal
              </button>
            ) : (
              <button onClick={() => setConfirmClear("journal")} className="btn-secondary">
                Clear journal
              </button>
            )}
            {confirmClear === "all" ? (
              <button
                onClick={() => { clearAll(); setConfirmClear(null); toast("vega reset"); }}
                className="btn-secondary border-[color-mix(in_srgb,var(--color-neg)_50%,transparent)] text-neg"
              >
                Confirm full reset
              </button>
            ) : (
              <button onClick={() => setConfirmClear("all")} className="btn-secondary">
                Reset everything
              </button>
            )}
          </div>
        </Card>
      </div>

      {/* Watchlist editor */}
      <Card i={2} className="mt-4 p-5">
        <CardHeader
          eyebrow={`${state.watchlist.length} of ${WATCHLIST_MAX}`}
          title="Watchlist"
          right={
            <SymbolSearch
              onSelect={addToWatchlist}
              buttonLabel="Add"
              placeholder="Add symbol or name…"
              disabled={state.watchlist.length >= WATCHLIST_MAX}
            />
          }
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {state.watchlist.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[12px] text-ink"
            >
              {s}
              <button
                onClick={() => removeFromWatchlist(s)}
                title={`Remove ${s}`}
                aria-label={`Remove ${s}`}
                className="text-faint transition-colors hover:text-neg"
              >
                <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 5 L15 15 M15 5 L5 15" />
                </svg>
              </button>
            </span>
          ))}
          {state.watchlist.length === 0 && (
            <span className="text-[12.5px] text-faint">Empty board — add a symbol above.</span>
          )}
        </div>
        {/* Preset boards — one tap fills a coherent theme, cap-aware. */}
        <div className="mt-4 border-t border-edge pt-3">
          <span className="eyebrow">Preset boards</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {WATCHLIST_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => loadPreset(p.label, p.symbols)}
                title={p.symbols.join(" · ")}
                className="btn-secondary h-7 px-2.5 text-[12px]"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          The whole board quotes in one batched request per 30s poll, so the {WATCHLIST_MAX}-symbol
          cap keeps vega comfortably inside the keyless provider&apos;s tolerance. Index tickers (^VIX,
          ^TNX) quote fine but don&apos;t chart intraday.
        </p>
      </Card>

      {/* Privacy note */}
      <p className="mt-4 max-w-3xl text-[11.5px] leading-relaxed text-faint">
        vega&apos;s journal, watchlist and settings persist in this browser&apos;s localStorage — they never
        leave your machine. Quotes and bars are proxied through this deployment&apos;s caching endpoints
        (Yahoo Finance; Finnhub only ever gap-fills alpha&apos;s fundamentals).
      </p>
    </>
  );
}
