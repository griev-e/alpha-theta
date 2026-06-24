"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Radar } from "@/components/charts/Radar";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { TickerLogo } from "@/components/ui/TickerLogo";
import {
  LEAD_TAG,
  SUB_SCORE_LABEL,
  suggestionReport,
  type SubScoreId,
  type Suggestion,
  type SuggestionContext,
} from "@/lib/analytics/suggestions";
import { fmtMultiple, fmtPct } from "@/lib/format";
import { usePortfolio } from "@/lib/store";
import type { Sector } from "@/lib/types";

/** Muted dots in the sector menu only — the rest of the page is monochrome + one accent. */
const SECTOR_COLOR: Record<Sector, string> = {
  Technology: "#6ea8fe",
  "Communication Services": "#b58cff",
  "Consumer Discretionary": "#5ec8a8",
  "Consumer Staples": "#9bbf6b",
  Financials: "#e0b15e",
  "Health Care": "#5fb3c9",
  Industrials: "#9aa4b2",
  Energy: "#d98b6a",
  Materials: "#c9a06a",
  Utilities: "#7f9ad1",
  "Real Estate": "#c98aa6",
  Diversified: "#8fa0b5",
  Unknown: "#8a8f99",
};

const SECTOR_LABEL: Partial<Record<Sector, string>> = { Diversified: "ETFs & Funds" };
const sectorLabel = (s: Sector) => SECTOR_LABEL[s] ?? s;

const SECTOR_ORDER: Sector[] = [
  "Technology",
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Financials",
  "Health Care",
  "Industrials",
  "Energy",
  "Materials",
  "Utilities",
  "Real Estate",
  "Diversified",
  "Unknown",
];

/** Sub-score order, shared by the radar axes and the breakdown. */
const SUB_ORDER: SubScoreId[] = [
  "fit",
  "quality",
  "growth",
  "value",
  "momentum",
  "analyst",
];

/** Score → single accent. */
const tierColor = (s: number): string =>
  s >= 62
    ? "var(--color-mint)"
    : s >= 52
      ? "var(--color-sky)"
      : s >= 44
        ? "var(--color-warn)"
        : "var(--color-neg)";

/** Hex twins of the tier colors, for SVG fills that can't take a CSS var alpha. */
const tierHex = (s: number): string =>
  s >= 62 ? "#4ade80" : s >= 52 ? "#6ea8fe" : s >= 44 ? "#fbbf78" : "#f87171";

type Filter = Sector | "all";

export default function DiscoverPage() {
  const { ready, portfolio } = usePortfolio();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const report = useMemo(
    () => (portfolio ? suggestionReport(portfolio) : null),
    [portfolio]
  );

  const sectorOptions = useMemo(() => {
    if (!report) return [];
    const counts = new Map<Sector, number>();
    for (const s of report.suggestions)
      counts.set(s.sector, (counts.get(s.sector) ?? 0) + 1);
    return SECTOR_ORDER.filter((s) => counts.has(s)).map((s) => ({
      sector: s,
      count: counts.get(s)!,
    }));
  }, [report]);

  const list = useMemo(() => {
    if (!report) return [];
    const l =
      filter === "all"
        ? report.suggestions
        : report.suggestions.filter((s) => s.sector === filter);
    return filter === "all" ? l.slice(0, 16) : l;
  }, [report, filter]);

  // Keep the selection valid as the filter changes; default to the top idea.
  useEffect(() => {
    if (list.length === 0) return;
    if (!selected || !list.some((s) => s.symbol === selected)) {
      setSelected(list[0].symbol);
    }
  }, [list, selected]);

  const active = list.find((s) => s.symbol === selected) ?? list[0] ?? null;

  // Optional live overlay: implied upside to the analyst target. Display-only.
  const [prices, setPrices] = useState<Record<string, number>>({});
  const symbolKey = list.map((s) => s.symbol).sort().join(",");
  useEffect(() => {
    if (!symbolKey) return;
    let cancelled = false;
    fetch(`/api/quotes?symbols=${encodeURIComponent(symbolKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.quotes) return;
        const next: Record<string, number> = {};
        for (const k of Object.keys(d.quotes)) {
          const p = d.quotes[k]?.price;
          if (typeof p === "number") next[k] = p;
        }
        setPrices((prev) => ({ ...prev, ...next }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbolKey]);

  const pick = (sym: string) => {
    setSelected(sym);
    // On stacked (mobile) layouts, bring the detail into view.
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      requestAnimationFrame(() =>
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
  };

  if (!ready) return null;
  if (!portfolio || !report) return <EmptyState page="The idea engine" />;

  return (
    <div>
      <PageHeader
        eyebrow="Portfolio"
        title="Discover"
        description="Stocks worth adding — screened for standalone merit and ranked by how well each fills the gaps in what you already own."
        right={
          <SectorSelect value={filter} options={sectorOptions} onChange={setFilter} />
        }
      />

      <ContextLine context={report.context} />

      {list.length === 0 || !active ? (
        <Card className="mt-2 px-8 py-12 text-center" hover={false}>
          <h2 className="font-display text-[15px] font-medium text-ink">
            No ideas in {filter === "all" ? "this view" : sectorLabel(filter)}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-mute">
            You already hold most of this universe. Try another sector.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(300px,360px)_1fr] lg:items-start">
          {/* Master: ranked list */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="panel overflow-hidden p-1.5 lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto"
          >
            <div className="flex items-center justify-between px-2.5 pb-1.5 pt-2">
              <span className="eyebrow">Ranked ideas</span>
              <span className="font-mono text-[10px] text-faint">{list.length}</span>
            </div>
            <div className="flex flex-col">
              {list.map((s, i) => (
                <IdeaRow
                  key={s.symbol}
                  s={s}
                  rank={i + 1}
                  active={s.symbol === active.symbol}
                  onClick={() => pick(s.symbol)}
                />
              ))}
            </div>
          </motion.div>

          {/* Detail */}
          <div ref={detailRef} className="lg:sticky lg:top-20">
            <DetailPanel s={active} price={prices[active.symbol]} />
          </div>
        </div>
      )}

      <p className="mt-8 max-w-2xl text-[11px] leading-relaxed text-faint">
        Model-driven screens over a bundled universe — not investment advice.
        Conviction blends quality, growth, valuation, momentum and analyst
        posture with a portfolio-fit score. Implied upside, when shown, is the
        live price against the mean analyst target.
      </p>
    </div>
  );
}

/* ------------------------------ context line ------------------------------ */

function ContextLine({ context }: { context: SuggestionContext }) {
  const gaps = context.gaps
    .filter((g) => g.gap > 0.02)
    .slice(0, 3)
    .map((g) => sectorLabel(g.sector));
  const concentrated = context.concentration > 0.14;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-mute"
    >
      <span className="text-faint">Tailored to your {context.heldSymbols.length} holdings.</span>
      {gaps.length > 0 && (
        <span>
          Lightest where it counts —{" "}
          <span className="text-ink">{gaps.join(", ")}</span>
          {concentrated && <span className="text-faint"> · concentrated book</span>}
        </span>
      )}
    </motion.div>
  );
}

/* ------------------------------- master row ------------------------------- */

function IdeaRow({
  s,
  rank,
  active,
  onClick,
}: {
  s: Suggestion;
  rank: number;
  active: boolean;
  onClick: () => void;
}) {
  const accent = tierColor(s.score);
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors"
    >
      {active && (
        <motion.span
          layoutId="discover-active"
          className="absolute inset-0 rounded-lg bg-white/[0.06] ring-1 ring-inset ring-white/[0.06]"
          transition={{ type: "spring", stiffness: 520, damping: 40 }}
        />
      )}
      <span
        className={`relative z-10 w-4 shrink-0 text-center font-mono text-[10.5px] ${
          active ? "text-mute" : "text-faint"
        }`}
      >
        {rank}
      </span>
      <span className="relative z-10">
        <TickerLogo symbol={s.symbol} accent={accent} size={30} />
      </span>
      <span className="relative z-10 min-w-0 flex-1">
        <span className="block font-mono text-[13px] font-semibold text-ink">{s.symbol}</span>
        <span className="block truncate text-[10.5px] text-faint">{s.fundamentals.name}</span>
      </span>
      <span className="relative z-10 flex shrink-0 items-center gap-2">
        <span className="h-7 w-1 rounded-full" style={{ background: accent, opacity: active ? 1 : 0.4 }} />
        <span
          className="w-7 text-right font-display text-[17px] font-bold leading-none"
          style={{ color: accent }}
        >
          {Math.round(s.score)}
        </span>
      </span>
    </button>
  );
}

/* ------------------------------ detail panel ------------------------------ */

function DetailPanel({ s, price }: { s: Suggestion; price?: number }) {
  const accent = tierColor(s.score);
  const hex = tierHex(s.score);
  const up = price && price > 0 && s.priceTarget ? s.priceTarget / price - 1 : null;

  const stats: { label: string; value: string; tone?: string }[] = [
    { label: "Fwd P/E", value: fmtMultiple(s.fundamentals.forwardPE) },
    { label: "Rev growth", value: fmtPct(s.fundamentals.revenueGrowth, 0) },
    { label: "ROIC", value: fmtPct(s.fundamentals.roic, 0) },
    { label: "Op margin", value: fmtPct(s.fundamentals.operatingMargin, 0) },
    { label: "Analyst", value: `${s.rating}` },
    {
      label: "Implied upside",
      value: up !== null ? `${up >= 0 ? "+" : ""}${fmtPct(up, 0)}` : "—",
      tone: up !== null ? (up >= 0 ? "text-pos" : "text-neg") : "text-faint",
    },
  ];

  return (
    <motion.section
      key={s.symbol}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="panel overflow-hidden"
    >
      {/* Header band */}
      <div
        className="relative px-6 pb-5 pt-6 sm:px-8"
        style={{
          background: `radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, ${accent} 9%, transparent), transparent 60%)`,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <TickerLogo symbol={s.symbol} accent={accent} size={46} />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[19px] font-semibold text-ink">{s.symbol}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                    color: accent,
                  }}
                >
                  {LEAD_TAG[s.lead]}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[12.5px] text-mute">
                {s.fundamentals.name}
              </div>
              <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">
                {sectorLabel(s.sector)}
              </div>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="eyebrow">conviction</div>
            <div
              className="font-display text-[40px] font-bold leading-none"
              style={{ color: accent }}
            >
              <AnimatedNumber value={s.score} from={0} format={(v) => `${Math.round(v)}`} />
            </div>
            <div className="font-mono text-[10px] text-faint">/ 100</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 px-6 pb-6 sm:px-8 lg:grid-cols-[260px_1fr]">
        {/* Radar profile vs the market baseline */}
        <div className="flex flex-col items-center">
          <Radar
            size={260}
            axes={SUB_ORDER.map((id) => SUB_SCORE_LABEL[id])}
            series={[
              {
                id: "market",
                label: "Market avg",
                color: "#5b6472",
                values: SUB_ORDER.map(() => 50),
                fillOpacity: 0.04,
              },
              {
                id: "cand",
                label: s.symbol,
                color: hex,
                values: SUB_ORDER.map((id) => Math.round(s.subScores[id])),
                fillOpacity: 0.16,
              },
            ]}
          />
        </div>

        {/* Why + breakdown + stats */}
        <div className="min-w-0">
          <div className="eyebrow mb-2">Why it's on the list</div>
          <ul className="space-y-2 border-l border-edge pl-4">
            {s.reasons.map((r, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.08, duration: 0.35 }}
                className="text-[13px] leading-relaxed text-mute"
              >
                {r.text}.
              </motion.li>
            ))}
          </ul>

          <div className="mt-5 grid grid-cols-3 gap-x-4 gap-y-3.5">
            {stats.map((st) => (
              <div key={st.label}>
                <div className="font-mono text-[9.5px] uppercase tracking-wide text-faint">
                  {st.label}
                </div>
                <div className={`mt-0.5 font-mono text-[14px] ${st.tone ?? "text-ink"}`}>
                  {st.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-edge pt-4">
            <span className="font-mono text-[10.5px] text-faint">
              Mean target {targetText(s.priceTarget)} · {s.fundamentals.analyst.count} analysts
            </span>
            <Link
              href={`/research?symbol=${s.symbol}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:border-edge2 hover:bg-white/[0.05]"
            >
              Open in Research
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function targetText(t: number): string {
  return t >= 1000 ? `$${(t / 1000).toFixed(1)}k` : `$${Math.round(t)}`;
}

/* ----------------------------- sector select ----------------------------- */

function SectorSelect({
  value,
  options,
  onChange,
}: {
  value: Filter;
  options: { sector: Sector; count: number }[];
  onChange: (f: Filter) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const total = options.reduce((s, o) => s + o.count, 0);
  const selected = value === "all" ? null : value;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-lg border border-edge bg-white/[0.03] pl-3 pr-2.5 text-[13px] text-ink transition-colors hover:border-edge2"
      >
        <span className="text-mute">Sector</span>
        <span className="font-medium">{selected ? sectorLabel(selected) : "All"}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M5 7.5 L10 12.5 L15 7.5" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 z-50 mt-1.5 max-h-[60vh] w-56 overflow-y-auto rounded-xl border border-edge bg-[#0a0a0a] p-1.5 shadow-2xl shadow-black/60"
          >
            <SelectRow
              label="All ideas"
              count={total}
              active={value === "all"}
              onClick={() => {
                onChange("all");
                setOpen(false);
              }}
            />
            <div className="my-1 h-px bg-edge" />
            {options.map((o) => (
              <SelectRow
                key={o.sector}
                label={sectorLabel(o.sector)}
                count={o.count}
                color={SECTOR_COLOR[o.sector]}
                active={value === o.sector}
                onClick={() => {
                  onChange(o.sector);
                  setOpen(false);
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SelectRow({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${
        active ? "bg-white/[0.07] text-ink" : "text-mute hover:bg-white/[0.04] hover:text-ink"
      }`}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: color ?? "var(--color-faint)" }}
      />
      <span className="flex-1 truncate">{label}</span>
      <span className="font-mono tnum text-[11px] text-faint">{count}</span>
    </button>
  );
}
