"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyPanel } from "@/components/ui/EmptyState";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { Table, type TableColumn } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { PnlCalendar } from "@/components/vega/PnlCalendar";
import { fmtNum, fmtUSD } from "@/lib/format";
import {
  dailyPnl,
  holdMinutes,
  journalStats,
  tradePnl,
  tradeR,
} from "@/lib/vega/journal";
import { markPosition } from "@/lib/vega/positions";
import { useVega } from "@/lib/vega/store";
import { SETUPS, type NewTrade, type Trade, type TradeSide } from "@/lib/vega/types";
import { useVegaQuotes } from "@/lib/vega/useVegaQuotes";

interface TradeFormState {
  symbol: string;
  side: TradeSide;
  qty: string;
  entry: string;
  exit: string;
  stop: string;
  target: string;
  fees: string;
  setup: string;
  entryAt: string;
  /** When the round trip closed (datetime-local); used when exit is set. */
  exitAt: string;
  notes: string;
}

const num = (s: string): number | undefined => {
  const v = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(v) && v > 0 ? v : undefined;
};

/** Local "now" in the datetime-local input's format. */
const nowLocal = (): string => {
  const d = new Date();
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
};

/** An ISO timestamp in the datetime-local input's LOCAL format. */
const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return nowLocal();
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return nowLocal();
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
};

const EMPTY_FORM: TradeFormState = {
  symbol: "",
  side: "long",
  qty: "",
  entry: "",
  exit: "",
  stop: "",
  target: "",
  fees: "",
  setup: "ORB",
  entryAt: "",
  exitAt: "",
  notes: "",
};

/** A logged trade back into form fields — the edit path. */
const toForm = (t: Trade): TradeFormState => ({
  symbol: t.symbol,
  side: t.side,
  qty: String(t.qty),
  entry: String(t.entry),
  exit: t.exit !== null && t.exit !== undefined ? String(t.exit) : "",
  stop: t.stop !== undefined ? String(t.stop) : "",
  target: t.target !== undefined ? String(t.target) : "",
  fees: t.fees !== undefined ? String(t.fees) : "",
  setup: t.setup ?? "Other",
  entryAt: toLocalInput(t.entryAt),
  exitAt: toLocalInput(t.exitAt ?? t.entryAt),
  notes: t.notes ?? "",
});

/**
 * The trade journal — log every round trip with its plan (stop, target,
 * setup), get P&L and R computed for you, and watch the calendar fill in.
 * The discipline layer the analytics page feeds on.
 */
export default function JournalPage() {
  const { state, ready, addTrade, updateTrade, deleteTrade, loadSampleJournal } = useVega();
  const toast = useToast();

  const [form, setForm] = useState<TradeFormState>(() => ({
    ...EMPTY_FORM,
    entryAt: nowLocal(),
    exitAt: nowLocal(),
  }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [closePrices, setClosePrices] = useState<Record<string, string>>({});
  // Trade-log filters — slice the record by setup, side, or symbol/notes text.
  const [filterSetup, setFilterSetup] = useState("all");
  const [filterSide, setFilterSide] = useState<"all" | TradeSide>("all");
  const [filterText, setFilterText] = useState("");

  const stats = useMemo(() => journalStats(state.trades), [state.trades]);
  const daily = useMemo(() => dailyPnl(state.trades), [state.trades]);
  const open = useMemo(
    () => state.trades.filter((t) => t.exit === null || t.exit === undefined),
    [state.trades]
  );
  const closed = useMemo(
    () =>
      state.trades
        .filter((t) => t.exit !== null && t.exit !== undefined)
        .sort((a, b) => (b.exitAt ?? b.entryAt).localeCompare(a.exitAt ?? a.entryAt)),
    [state.trades]
  );

  // Open positions marked against the live poll — one batched call for the
  // handful of open symbols, so "Close" can prefill the actual last print.
  const openSymbols = useMemo(
    () => [...new Set(open.map((t) => t.symbol))],
    [open]
  );
  const { quotes } = useVegaQuotes(ready ? openSymbols : []);
  const marks = useMemo(
    () => new Map(open.map((t) => [t.id, markPosition(t, quotes[t.symbol])])),
    [open, quotes]
  );

  const setupOptions = useMemo(() => {
    const seen = new Set(closed.map((t) => t.setup ?? "untagged"));
    return ["all", ...[...seen].sort()];
  }, [closed]);
  const filtered = useMemo(() => {
    const text = filterText.trim();
    const sym = text.toUpperCase();
    const lower = text.toLowerCase();
    return closed.filter(
      (t) =>
        (filterSetup === "all" || (t.setup ?? "untagged") === filterSetup) &&
        (filterSide === "all" || t.side === filterSide) &&
        (!text ||
          t.symbol.includes(sym) ||
          (t.notes ?? "").toLowerCase().includes(lower))
    );
  }, [closed, filterSetup, filterSide, filterText]);
  const isFiltered =
    filterSetup !== "all" || filterSide !== "all" || filterText.trim() !== "";
  const filteredPnl = useMemo(
    () => filtered.reduce((s, t) => s + (tradePnl(t) ?? 0), 0),
    [filtered]
  );

  const resetForm = (keep?: Pick<TradeFormState, "side" | "setup">) =>
    setForm({
      ...EMPTY_FORM,
      ...(keep ?? {}),
      entryAt: nowLocal(),
      exitAt: nowLocal(),
    });

  const startEdit = (t: Trade) => {
    setEditingId(t.id);
    setForm(toForm(t));
    document.getElementById("log")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = form.symbol.trim().toUpperCase();
    const qty = num(form.qty);
    const entry = num(form.entry);
    if (!symbol || qty === undefined || entry === undefined) {
      toast("A trade needs at least a symbol, size and entry");
      return;
    }
    const exit = num(form.exit);
    const payload: NewTrade = {
      symbol,
      side: form.side,
      qty,
      entry,
      exit: exit ?? null,
      stop: num(form.stop),
      target: num(form.target),
      fees: form.fees ? Number(form.fees.replace(/[$,\s]/g, "")) || undefined : undefined,
      entryAt: new Date(form.entryAt || nowLocal()).toISOString(),
      // A back-dated round trip exits when the user says it did — stamping
      // "now" would file yesterday's loss under today's circuit breaker.
      exitAt:
        exit !== undefined
          ? new Date(
              form.exitAt && form.exitAt >= form.entryAt ? form.exitAt : form.entryAt
            ).toISOString()
          : null,
      setup: form.setup || undefined,
      notes: form.notes.trim() || undefined,
    };
    if (editingId !== null) {
      // Full-field patch: the edit form owns every field, so a cleared
      // stop/target/fees genuinely clears on the stored trade.
      updateTrade(editingId, payload);
      setEditingId(null);
      resetForm();
      toast(`Updated ${symbol}`);
    } else {
      addTrade(payload);
      resetForm({ side: form.side, setup: form.setup });
      toast(`Logged ${symbol}`);
    }
  };

  const columns = useMemo<TableColumn<Trade>[]>(
    () => [
      {
        key: "when",
        header: "Exited",
        align: "left",
        sortable: true,
        sortValue: (t) => t.exitAt ?? t.entryAt,
        cell: (t) => (
          <span className="font-mono text-[11px] text-faint">
            {(t.exitAt ?? t.entryAt).slice(0, 10)}
          </span>
        ),
      },
      {
        key: "symbol",
        header: "Symbol",
        align: "left",
        sortable: true,
        sortValue: (t) => t.symbol,
        cell: (t) => (
          <span className="font-mono text-[12.5px] text-ink">
            {t.symbol}
            <span className={`ml-1.5 text-[9.5px] uppercase ${t.side === "long" ? "text-pos" : "text-neg"}`}>
              {t.side}
            </span>
          </span>
        ),
      },
      {
        key: "qty",
        header: "Size",
        align: "right",
        cell: (t) => <span className="font-mono tnum text-[12px] text-mute">{t.qty}</span>,
      },
      {
        key: "fill",
        header: "Entry → Exit",
        align: "right",
        cell: (t) => (
          <span className="font-mono tnum text-[12px] text-mute">
            {t.entry.toFixed(2)} → {t.exit?.toFixed(2) ?? "—"}
          </span>
        ),
      },
      {
        key: "pnl",
        header: "P&L",
        align: "right",
        sortable: true,
        sortValue: (t) => tradePnl(t) ?? 0,
        cell: (t) => {
          const pnl = tradePnl(t);
          if (pnl === null) return <span className="text-faint">—</span>;
          return (
            <span className={`font-mono tnum text-[12.5px] ${pnl > 0 ? "text-pos" : pnl < 0 ? "text-neg" : "text-mute"}`}>
              {fmtUSD(pnl)}
            </span>
          );
        },
      },
      {
        key: "r",
        header: "R",
        align: "right",
        sortable: true,
        sortValue: (t) => tradeR(t) ?? -99,
        cell: (t) => {
          const r = tradeR(t);
          return r === null ? (
            <span className="text-faint" title="No stop was logged — R needs a planned risk">
              —
            </span>
          ) : (
            <span className={`font-mono tnum text-[12px] ${r >= 0 ? "text-pos" : "text-neg"}`}>
              {fmtNum(r, 1)}R
            </span>
          );
        },
      },
      {
        key: "hold",
        header: "Hold",
        align: "right",
        cell: (t) => {
          const h = holdMinutes(t);
          return (
            <span className="font-mono tnum text-[11px] text-faint">
              {h === null ? "—" : h >= 60 ? `${(h / 60).toFixed(1)}h` : `${Math.round(h)}m`}
            </span>
          );
        },
      },
      {
        key: "setup",
        header: "Setup",
        align: "left",
        sortable: true,
        sortValue: (t) => t.setup ?? "",
        cell: (t) => <span className="text-[11.5px] text-mute">{t.setup ?? "—"}</span>,
      },
      {
        key: "actions",
        header: "",
        align: "right",
        width: "w-[68px]",
        cell: (t) => (
          <span className="flex justify-end gap-0.5">
            <button
              onClick={() => startEdit(t)}
              title="Edit trade"
              aria-label={`Edit ${t.symbol} trade`}
              className="btn-ghost h-6 w-6"
            >
              <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13.5 3.5 L16.5 6.5 L7.5 15.5 L3.8 16.2 L4.5 12.5 Z" />
              </svg>
            </button>
            <button
              onClick={() => deleteTrade(t.id)}
              title="Delete trade"
              aria-label={`Delete ${t.symbol} trade`}
              className="btn-ghost danger h-6 w-6"
            >
              <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M4 6 H16 M8.5 3.5 H11.5 M6 6 L7 16.5 H13 L14 6 M8.5 9 V13.5 M11.5 9 V13.5" />
              </svg>
            </button>
          </span>
        ),
      },
    ],
    [deleteTrade]
  );

  if (ready && state.trades.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Performance" title="Journal" description="Log the round trips; the analytics write themselves." />
        <EmptyPanel
          watermark="ν"
          icon={
            <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke="var(--color-gold)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="12" height="14" rx="1.8" />
              <path d="M7.2 7 H12.8 M7.2 10 H12.8 M7.2 13 H10.6" />
            </svg>
          }
          heading="No trades logged yet"
          body="Every closed trade feeds the win rate, expectancy, R distribution, and the calendar. Log your first — or load the sample journal to see the machinery move."
          primary={
            <a href="#log" className="btn-primary">
              Log a trade
            </a>
          }
          secondary={
            <button onClick={loadSampleJournal} className="btn-secondary">
              Load sample journal
            </button>
          }
        />
        <div id="log" className="mt-8">
          <TradeForm form={form} setForm={setForm} onSubmit={submit} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Performance"
        title="Journal"
        description="The trade log — entries, exits, and the plan behind each. Closed trades feed the analytics."
      />

      {/* Quick stats + calendar */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card i={0} className="p-5 lg:col-span-2">
          <CardHeader eyebrow="Trailing weeks" title="Trading calendar" />
          <div className="mt-4">
            <PnlCalendar daily={daily} />
          </div>
        </Card>
        <Card i={1} className="p-5">
          <CardHeader eyebrow="All closed trades" title="Quick read" />
          {stats ? (
            <dl className="mt-3 space-y-2 text-[12.5px]">
              {[
                ["Net P&L", fmtUSD(stats.totalPnl), stats.totalPnl >= 0 ? "text-pos" : "text-neg"],
                ["Win rate", `${Math.round(stats.winRate * 100)}%`, "text-ink"],
                ["Expectancy / trade", fmtUSD(stats.expectancy), stats.expectancy >= 0 ? "text-pos" : "text-neg"],
                ["Avg R", stats.avgR !== null ? `${fmtNum(stats.avgR, 2)}R` : "—", "text-ink"],
                ["Streak", stats.streak > 0 ? `${stats.streak} wins` : stats.streak < 0 ? `${-stats.streak} losses` : "—", stats.streak > 0 ? "text-pos" : stats.streak < 0 ? "text-neg" : "text-mute"],
              ].map(([label, value, cls]) => (
                <div key={label as string} className="flex items-baseline justify-between gap-3">
                  <dt className="text-faint">{label}</dt>
                  <dd className={`font-mono tnum ${cls}`}>{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-[12.5px] text-faint">Close a trade to start the tally.</p>
          )}
        </Card>
      </div>

      {/* Open positions */}
      {open.length > 0 && (
        <Card i={2} className="mb-4 p-5">
          <CardHeader eyebrow={`${open.length} open`} title="Working positions" />
          <ul className="mt-3 divide-y divide-edge/60">
            {open.map((t) => {
              const p = marks.get(t.id);
              const upnl = p?.unrealized ?? null;
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="font-mono text-[12.5px] text-ink">
                    {t.symbol}
                    <span className={`ml-1.5 text-[9.5px] uppercase ${t.side === "long" ? "text-pos" : "text-neg"}`}>
                      {t.side}
                    </span>
                  </span>
                  <span className="font-mono tnum text-[12px] text-mute">
                    {t.qty} @ {t.entry.toFixed(2)}
                  </span>
                  {t.stop !== undefined && (
                    <span className="font-mono tnum text-[11px] text-faint">stop {t.stop.toFixed(2)}</span>
                  )}
                  {/* Live mark — the quote poll pricing this position now. */}
                  {p?.last != null && (
                    <span className="font-mono tnum text-[12px] text-mute">
                      last {p.last.toFixed(2)}
                      <span
                        className={`ml-1.5 ${
                          upnl === null ? "text-faint" : upnl > 0 ? "text-pos" : upnl < 0 ? "text-neg" : "text-mute"
                        }`}
                      >
                        {upnl === null ? "" : fmtUSD(upnl)}
                      </span>
                      {p.unrealizedR !== null && (
                        <span className={`ml-1.5 text-[10.5px] ${p.unrealizedR >= 0 ? "text-pos" : "text-neg"}`}>
                          {fmtNum(p.unrealizedR, 1)}R
                        </span>
                      )}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => startEdit(t)}
                      title="Edit trade"
                      aria-label={`Edit ${t.symbol} trade`}
                      className="btn-ghost h-7 w-7"
                    >
                      <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13.5 3.5 L16.5 6.5 L7.5 15.5 L3.8 16.2 L4.5 12.5 Z" />
                      </svg>
                    </button>
                    <input
                      value={closePrices[t.id] ?? ""}
                      onChange={(e) => setClosePrices((m) => ({ ...m, [t.id]: e.target.value }))}
                      placeholder="Exit price"
                      aria-label={`Exit price for ${t.symbol}`}
                      className="field h-7 w-24 text-[12px]"
                    />
                    {p?.last != null && (
                      <button
                        onClick={() =>
                          setClosePrices((m) => ({ ...m, [t.id]: (p.last as number).toFixed(2) }))
                        }
                        title="Prefill the live mark as the exit"
                        className="btn-ghost h-7 px-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em]"
                      >
                        mark
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const px = num(closePrices[t.id] ?? "");
                        if (px === undefined) {
                          toast("Enter the exit fill first");
                          return;
                        }
                        updateTrade(t.id, { exit: px, exitAt: new Date().toISOString() });
                        setClosePrices((m) => ({ ...m, [t.id]: "" }));
                      }}
                      className="btn-secondary h-7 px-2.5 text-[12px]"
                    >
                      Close
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div id="log">
        <TradeForm
          form={form}
          setForm={setForm}
          onSubmit={submit}
          i={3}
          editing={editingId !== null}
          onCancel={cancelEdit}
        />
      </div>

      <Card i={4} className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5">
          <CardHeader
            eyebrow={
              isFiltered ? `${filtered.length} of ${closed.length} closed` : `${closed.length} closed`
            }
            title="Trade log"
          />
          {/* Filters — slice the record without leaving the page. */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Symbol or notes…"
              aria-label="Filter trades by symbol or notes"
              className="field h-7 w-36 text-[12px]"
            />
            <Select
              value={filterSetup}
              onChange={setFilterSetup}
              options={setupOptions.map((s) => ({
                value: s,
                label: s === "all" ? "All setups" : s,
              }))}
              ariaLabel="Filter by setup"
            />
            <Segmented
              value={filterSide}
              onChange={setFilterSide}
              options={[
                { value: "all", label: "All" },
                { value: "long", label: "Long" },
                { value: "short", label: "Short" },
              ]}
            />
            {isFiltered && (
              <button
                onClick={() => {
                  setFilterText("");
                  setFilterSetup("all");
                  setFilterSide("all");
                }}
                className="btn-ghost h-7 px-2 font-mono text-[10.5px] uppercase tracking-[0.08em]"
              >
                clear
              </button>
            )}
          </div>
        </div>
        {isFiltered && filtered.length > 0 && (
          <p className="px-5 pt-2 font-mono text-[11px] text-faint">
            selection net{" "}
            <span className={filteredPnl > 0 ? "text-pos" : filteredPnl < 0 ? "text-neg" : "text-mute"}>
              {fmtUSD(filteredPnl)}
            </span>
          </p>
        )}
        <div className="mt-3">
          <Table
            columns={columns}
            rows={filtered}
            rowKey={(t) => t.id}
            defaultSort={{ key: "when", asc: false }}
            density="compact"
            minWidth="min-w-[760px]"
            emptyLabel={isFiltered ? "No trades match the filter." : "No closed trades yet."}
          />
        </div>
      </Card>
    </>
  );
}

function TradeForm({
  form,
  setForm,
  onSubmit,
  i = 0,
  editing = false,
  onCancel,
}: {
  form: TradeFormState;
  setForm: React.Dispatch<React.SetStateAction<TradeFormState>>;
  onSubmit: (e: React.FormEvent) => void;
  i?: number;
  /** True when the form holds an existing trade — submit updates in place. */
  editing?: boolean;
  onCancel?: () => void;
}) {
  // Imported journals can carry free-form setups outside the starter list —
  // keep whatever the trade says selectable instead of silently retagging.
  const setupChoices = SETUPS.includes(form.setup as (typeof SETUPS)[number])
    ? [...SETUPS]
    : [form.setup, ...SETUPS];
  const field = (
    key: Exclude<keyof TradeFormState, "side">,
    label: string,
    placeholder: string,
    span = ""
  ) => (
    <label className={`block ${span}`}>
      <span className="eyebrow mb-1 block">{label}</span>
      <input
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="field h-8"
      />
    </label>
  );
  return (
    <Card i={i} className={`p-5 ${editing ? "ring-1 ring-gold/30" : ""}`}>
      <CardHeader
        eyebrow={editing ? "Editing" : "Log a trade"}
        title={editing ? `Edit ${form.symbol || "trade"}` : "New entry"}
        right={
          editing && onCancel ? (
            <button onClick={onCancel} className="btn-ghost h-7 px-2 text-[12px]">
              Cancel
            </button>
          ) : undefined
        }
      />
      <form onSubmit={onSubmit} className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {field("symbol", "Symbol", "NVDA")}
        <label className="block">
          <span className="eyebrow mb-1 block">Side</span>
          <Select<TradeSide>
            value={form.side}
            onChange={(side) => setForm((f) => ({ ...f, side }))}
            options={[
              { value: "long", label: "Long" },
              { value: "short", label: "Short" },
            ]}
            ariaLabel="Trade side"
          />
        </label>
        {field("qty", "Size", "100")}
        {field("entry", "Entry", "172.40")}
        {field("exit", "Exit (blank = open)", "—")}
        {field("stop", "Stop", "171.60")}
        {field("target", "Target", "174.00")}
        {field("fees", "Fees", "1.50")}
        <label className="block">
          <span className="eyebrow mb-1 block">Setup</span>
          <Select
            value={form.setup}
            onChange={(setup) => setForm((f) => ({ ...f, setup }))}
            options={setupChoices.map((s) => ({ value: s, label: s }))}
            ariaLabel="Setup"
          />
        </label>
        <label className="block col-span-2">
          <span className="eyebrow mb-1 block">Entered at</span>
          <input
            type="datetime-local"
            value={form.entryAt}
            onChange={(e) => setForm((f) => ({ ...f, entryAt: e.target.value }))}
            className="field h-8"
          />
        </label>
        <label className="block col-span-2">
          <span className="eyebrow mb-1 block">Exited at</span>
          <input
            type="datetime-local"
            value={form.exitAt}
            min={form.entryAt}
            onChange={(e) => setForm((f) => ({ ...f, exitAt: e.target.value }))}
            disabled={!form.exit.trim()}
            aria-label="Exited at (used when an exit price is set)"
            className="field h-8 disabled:opacity-40"
          />
        </label>
        {field("notes", "Notes", "What was the read?", "col-span-2 md:col-span-3")}
        <div className="col-span-2 flex items-end md:col-span-1">
          <button type="submit" className="btn-primary w-full">
            {editing ? "Save changes" : "Log trade"}
          </button>
        </div>
      </form>
      <p className="mt-3 text-[11px] leading-relaxed text-faint">
        Log the stop even after the fact — it&apos;s what turns P&L into R-multiples, the unit the
        analytics reason in.
      </p>
    </Card>
  );
}
