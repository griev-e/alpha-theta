"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { m } from "framer-motion";
import { TickerSearch } from "@/components/research/TickerSearch";

// Rendered only once price history has loaded; deferred so the search box and
// fundamentals paint without the chart's JS in the initial route bundle.
const PriceChart = dynamic(
  () => import("@/components/charts/PriceChart").then((m) => m.PriceChart),
  { ssr: false }
);
import { Card, CardHeader } from "@/components/ui/Card";
import { deltaToneClass } from "@/components/ui/Delta";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { TickerLogo } from "@/components/ui/TickerLogo";
import { Tooltip } from "@/components/ui/Tooltip";
import { factorScores } from "@/lib/analytics/factors";
import { liveBenchmarkProfiles } from "@/lib/live/cma";
import {
  daysUntil,
  fmtDate,
  fmtMultiple,
  fmtPct,
  fmtShares,
  fmtUSD,
  fmtUSDCompact,
  relativeTime,
} from "@/lib/format";
import type { HistoryRange } from "@/lib/research/types";
import type { PriceEvent } from "@/components/charts/PriceChart";
import {
  useResearchTarget,
  usePriceHistory,
  type ResearchTarget,
} from "@/lib/research/useResearch";
import { usePortfolio } from "@/lib/store";
import { useWatchlist } from "@/lib/watchlist";
import type { AnalystRating, Fundamentals, Position } from "@/lib/types";
import { TerminalSkeleton } from "@/components/ui/Skeleton";

const RANGES: { id: HistoryRange; label: string }[] = [
  { id: "1m", label: "1M" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "5y", label: "5Y" },
];

const STARTER_TICKERS = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "SPY"];

export default function ResearchPage() {
  const { ready, portfolio } = usePortfolio();
  const [symbol, setSymbol] = useState<string | null>(null);
  const [range, setRange] = useState<HistoryRange>("1y");
  const [touched, setTouched] = useState(false);

  // A ?symbol= deep-link wins over the default and counts as a deliberate pick
  // so the largest-holding default doesn't clobber it.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("symbol");
    if (q) {
      setTouched(true);
      setSymbol(q.toUpperCase());
    }
  }, []);

  // Default to the largest holding once the portfolio loads, unless the user
  // has already picked a ticker themselves.
  const defaultSymbol = portfolio?.positions[0]?.symbol ?? null;
  useEffect(() => {
    if (!touched && defaultSymbol) setSymbol(defaultSymbol);
  }, [touched, defaultSymbol]);

  const select = (s: string) => {
    setTouched(true);
    setSymbol(s);
  };

  const holding = useMemo(
    () => portfolio?.positions.find((p) => p.symbol === symbol) ?? null,
    [portfolio, symbol]
  );

  const portfolioIncome = useMemo(() => {
    if (!portfolio) return 0;
    return portfolio.positions.reduce(
      (s, p) => s + p.equity * (p.fundamentals?.dividendYield ?? 0),
      0
    );
  }, [portfolio]);

  const { symbols: watchSymbols } = useWatchlist();

  // Ordered list backing the rail + j/k navigation: your holdings first, then
  // watchlist names you don't hold, then (with no book) the starters.
  const railSymbols = useMemo(() => {
    const held = portfolio?.positions.map((p) => p.symbol) ?? [];
    const base = held.length > 0 ? held : STARTER_TICKERS;
    const extra = watchSymbols.filter((s) => !base.includes(s));
    return [...base, ...extra];
  }, [portfolio, watchSymbols]);

  // j / k step through the rail like a terminal, ignoring text fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if ((e.key !== "j" && e.key !== "k") || railSymbols.length === 0) return;
      e.preventDefault();
      const idx = symbol ? railSymbols.indexOf(symbol) : -1;
      const delta = e.key === "j" ? 1 : -1;
      const next = idx < 0 ? 0 : (idx + delta + railSymbols.length) % railSymbols.length;
      setTouched(true);
      setSymbol(railSymbols[next]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [railSymbols, symbol]);

  if (!ready) return <TerminalSkeleton />;

  const picks = portfolio?.positions.map((p) => p.symbol) ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Research"
        title="Research"
        description="Look up any stock, ETF or fund — live price history, fundamentals, and how it stacks up against the S&P 500."
      />

      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-5"
      >
        <TickerSearch onSelect={select} />
      </m.div>

      {/* Mobile keeps the horizontal quick-pick chips; desktop gets the rail. */}
      <div className="lg:hidden">
        <QuickPicks
          label={picks.length > 0 ? "Your holdings" : "Popular"}
          symbols={picks.length > 0 ? picks : STARTER_TICKERS}
          active={symbol}
          positions={portfolio?.positions ?? []}
          onSelect={select}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[236px_minmax(0,1fr)]">
        <ResearchRail
          className="hidden lg:block"
          holdings={portfolio?.positions ?? []}
          watchlist={watchSymbols}
          active={symbol}
          onSelect={select}
        />

        <div className="min-w-0">
          {symbol ? (
            // Keyed remount (no AnimatePresence exit gating) so switching tickers
            // fades the new view straight in instead of leaving a blank frame
            // while the old one animates out.
            <m.div
              key={symbol}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <ResearchView
                symbol={symbol}
                range={range}
                onRange={setRange}
                holding={holding}
                portfolioIncome={portfolioIncome}
              />
            </m.div>
          ) : (
            <Card className="px-8 py-12 text-center">
              <h2 className="font-display text-lg font-semibold text-ink">
                Search any ticker to begin
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-mute">
                Type a symbol or company name above, or pick from the rail. No
                portfolio required — research works for any security, with live
                market data when available.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/** The star toggle for the current ticker — add/remove from the watchlist. */
function WatchStar({ symbol }: { symbol: string }) {
  const { has, toggle } = useWatchlist();
  const on = has(symbol);
  return (
    <button
      onClick={() => toggle(symbol)}
      title={on ? "Remove from watchlist" : "Add to watchlist"}
      aria-label={on ? "Remove from watchlist" : "Add to watchlist"}
      aria-pressed={on}
      className="btn-ghost"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 20 20"
        fill={on ? "var(--color-warn)" : "none"}
        stroke={on ? "var(--color-warn)" : "currentColor"}
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        <path d="M10 2.6l2.35 4.76 5.25.77-3.8 3.7.9 5.22L10 14.9l-4.7 2.47.9-5.22-3.8-3.7 5.25-.77z" />
      </svg>
    </button>
  );
}

/**
 * The left terminal rail: your holdings and watchlist as a scannable list,
 * j/k to move between them, the active ticker lit. Replaces the quick-pick
 * chips on desktop; the security — not the search box — anchors the page.
 */
function ResearchRail({
  className = "",
  holdings,
  watchlist,
  active,
  onSelect,
}: {
  className?: string;
  holdings: Position[];
  watchlist: string[];
  active: string | null;
  onSelect: (s: string) => void;
}) {
  const bySymbol = new Map(holdings.map((p) => [p.symbol, p]));
  const held = holdings.map((p) => p.symbol);
  const heldSet = new Set(held);
  const watchOnly = watchlist.filter((s) => !heldSet.has(s));
  const hasBook = held.length > 0;
  const primary = hasBook ? held : STARTER_TICKERS;

  const Row = (s: string) => {
    const p = bySymbol.get(s);
    const isActive = s === active;
    return (
      <button
        key={s}
        onClick={() => onSelect(s)}
        className={`group flex w-full items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2.5 text-left transition-colors ${
          isActive ? "bg-mint/[0.08]" : "hover:bg-white/[0.04]"
        }`}
      >
        <span
          aria-hidden
          className={`h-7 w-[2px] shrink-0 rounded-full ${isActive ? "bg-mint" : "bg-transparent"}`}
        />
        <span
          className={`min-w-0 flex-1 truncate font-mono text-[12.5px] font-medium ${
            isActive ? "text-mint" : "text-ink"
          }`}
        >
          {s}
        </span>
        {p ? (
          <span className={`font-mono tnum text-[11px] ${deltaToneClass(p.returnPct)}`}>
            {fmtPct(p.returnPct, 1, true)}
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-wide text-faint">
            watch
          </span>
        )}
      </button>
    );
  };

  return (
    <aside className={`${className} h-fit lg:sticky lg:top-16`}>
      <div className="panel overflow-hidden">
        <div className="max-h-[68vh] overflow-y-auto p-1.5">
          <div className="eyebrow px-2 pb-1 pt-1.5">
            {hasBook ? "Your holdings" : "Popular"}
          </div>
          {primary.map(Row)}
          {watchOnly.length > 0 && (
            <>
              <div className="eyebrow px-2 pb-1 pt-3">Watchlist</div>
              {watchOnly.map(Row)}
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 border-t border-edge px-3 py-2 text-[10px] text-faint">
          <span className="kbd">j</span>
          <span className="kbd">k</span>
          <span>to move</span>
        </div>
      </div>
    </aside>
  );
}

function QuickPicks({
  label,
  symbols,
  active,
  positions,
  onSelect,
}: {
  label: string;
  symbols: string[];
  active: string | null;
  positions: Position[];
  onSelect: (s: string) => void;
}) {
  if (symbols.length === 0) return null;
  const bySymbol = new Map(positions.map((p) => [p.symbol, p]));
  return (
    <div className="mb-6">
      <div className="eyebrow mb-2">{label}</div>
      <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {symbols.map((s) => {
          const p = bySymbol.get(s);
          const isActive = s === active;
          return (
            <button
              key={s}
              onClick={() => onSelect(s)}
              className={`shrink-0 rounded-xl border px-3.5 py-2 text-left transition-colors ${
                isActive
                  ? "border-mint/35 bg-mint/[0.08]"
                  : "border-edge bg-panel hover:border-edge2"
              }`}
            >
              <div
                className={`font-mono text-[13px] font-medium ${
                  isActive ? "text-mint" : "text-ink"
                }`}
              >
                {s}
              </div>
              {p ? (
                <div
                  className={`font-mono tnum text-[11px] ${deltaToneClass(p.returnPct)}`}
                >
                  {fmtPct(p.returnPct, 1, true)}
                </div>
              ) : (
                <div className="font-mono text-[11px] text-faint">look up</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResearchView({
  symbol,
  range,
  onRange,
  holding,
  portfolioIncome,
}: {
  symbol: string;
  range: HistoryRange;
  onRange: (r: HistoryRange) => void;
  holding: Position | null;
  portfolioIncome: number;
}) {
  const target = useResearchTarget(symbol);
  const { data: history, loading: histLoading } = usePriceHistory(symbol, range);
  const f = target.fundamentals;
  // S&P 500 reference: live valuation fields overlaid on the user's assumptions.
  const spx = liveBenchmarkProfiles().spx;

  // §43 — a condensed identity bar that pins under the top bar once the hero
  // scrolls away, so the ticker + price stay in view down the whole fundamentals
  // stack. Watched by an IntersectionObserver on the hero; the sticky bar reserves
  // no layout space (negative margin) so it can't shift the page.
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroOut, setHeroOut] = useState(false);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setHeroOut(!e.isIntersecting),
      { rootMargin: "-56px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [symbol]);

  // Price resolution, most-trusted first: live quote → live-priced holding →
  // latest charted close. Lets research work even when one feed is down.
  const lastClose = history?.points[history.points.length - 1]?.c ?? null;
  const price = target.quote?.price ?? holding?.price ?? lastClose ?? null;
  const prevClose = target.quote?.prevClose ?? null;
  const dayChangePct =
    price !== null && prevClose && prevClose > 0 ? price / prevClose - 1 : null;

  const periodReturn =
    history && history.points.length >= 2
      ? history.points[history.points.length - 1].c / history.points[0].c - 1
      : null;

  // Ex-dividend dates for the chart's annotation layer. Fetched best-effort and
  // degrades to no markers if the provider is unreachable (the graceful-
  // degradation contract) — the chart still renders without them.
  const [divEvents, setDivEvents] = useState<{ date: string; amount: number }[] | null>(
    null
  );
  const [showDivs, setShowDivs] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setDivEvents(null);
    fetch(`/api/dividends?symbols=${encodeURIComponent(symbol)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled) setDivEvents(j?.profiles?.[symbol]?.events ?? []);
      })
      .catch(() => {
        if (!cancelled) setDivEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const priceEvents = useMemo<PriceEvent[]>(() => {
    if (!showDivs || !divEvents) return [];
    return divEvents.map((e) => ({
      date: e.date,
      kind: "dividend",
      label: `Ex-dividend · ${fmtDate(e.date)} · ${fmtUSD(e.amount)}/sh`,
    }));
  }, [showDivs, divEvents]);
  const hasDivs = (divEvents?.length ?? 0) > 0;

  if (target.loading && !f) {
    return (
      <div className="mt-10 text-center font-mono text-[12px] text-mute">
        Loading {symbol}…
      </div>
    );
  }

  if (target.notFound || !f) {
    return (
      <Card className="mt-8 px-8 py-12 text-center">
        <h2 className="font-display text-lg font-semibold text-ink">
          No data for {symbol}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-mute">
          We could not find a security matching that ticker. Check the symbol
          and try again.
        </p>
      </Card>
    );
  }

  const upside = price !== null && f.analyst.priceTarget > 0
    ? f.analyst.priceTarget / price - 1
    : null;
  const scores = factorScores(f);
  const factorRows: [string, number, number, string][] = [
    ["Growth", scores.growth, spx.factorScores.growth, "var(--color-mint)"],
    ["Value", scores.value, spx.factorScores.value, "var(--color-vio)"],
    ["Quality", scores.quality, spx.factorScores.quality, "var(--color-sky)"],
    ["Momentum", scores.momentum, spx.factorScores.momentum, "var(--color-warn)"],
  ];

  return (
    <div className="space-y-5">
      {/* §43 — sticky condensed identity; reserves no space (−mb) so no reflow */}
      <div
        aria-hidden={!heroOut}
        className={`pointer-events-none sticky top-12 z-30 -mb-[52px] flex h-[52px] items-center gap-2.5 rounded-lg glass px-4 shadow-pop ring-1 ring-edge transition-all duration-200 ${
          heroOut ? "opacity-100" : "-translate-y-1 opacity-0"
        }`}
      >
        <TickerLogo symbol={symbol} accent="var(--color-mint)" size={22} />
        <span className="font-mono text-[12px] text-mute">{symbol}</span>
        <span className="hidden truncate text-[12px] text-faint sm:inline">
          {f.name}
        </span>
        <span className="ml-auto font-mono tnum text-[13px] text-ink">
          {price !== null ? fmtUSD(price) : "—"}
        </span>
        {dayChangePct !== null && (
          <span
            className={`font-mono tnum text-[11px] ${deltaToneClass(dayChangePct)}`}
          >
            {fmtPct(dayChangePct, 2, true)}
          </span>
        )}
      </div>

      {/* Hero: identity, price, chart */}
      <div ref={heroRef}>
      <Card className="px-6 py-5" i={0}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <TickerLogo symbol={symbol} accent="var(--color-mint)" size={48} />
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-[22px] font-semibold leading-tight text-ink">
                  {f.name}
                </h2>
                <span className="rounded-md border border-edge bg-void/50 px-2 py-0.5 font-mono text-[11px] text-mute">
                  {symbol}
                </span>
                <WatchStar symbol={symbol} />
              </div>
              <div className="mt-1 text-[12px] text-faint">
                {f.sector}
                {f.industry && f.industry !== "Unknown"
                  ? ` · ${f.industry}`
                  : ""}
                {f.marketCap > 0 ? ` · ${fmtUSDCompact(f.marketCap)} mkt cap` : ""}
              </div>
              <ProvenanceBadge target={target} />
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono tnum text-[26px] leading-none text-ink">
              {price !== null ? fmtUSD(price) : "—"}
            </div>
            {dayChangePct !== null && (
              <div
                className={`mt-1 font-mono tnum text-[12px] ${deltaToneClass(dayChangePct)}`}
              >
                {fmtPct(dayChangePct, 2, true)} today
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Segmented
              value={range}
              onChange={onRange}
              options={RANGES.map((r) => ({ value: r.id, label: r.label }))}
            />
            {hasDivs && (
              <button
                onClick={() => setShowDivs((v) => !v)}
                aria-pressed={showDivs}
                title="Toggle ex-dividend markers"
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10.5px] uppercase tracking-wider transition-colors ${
                  showDivs
                    ? "border-mint/35 bg-mint/[0.08] text-mint"
                    : "border-edge text-faint hover:text-mute"
                }`}
              >
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current text-[8px] font-semibold">
                  D
                </span>
                Ex-div
              </button>
            )}
          </div>
          {periodReturn !== null && (
            <span
              className={`font-mono tnum text-[12px] ${deltaToneClass(periodReturn)}`}
            >
              {fmtPct(periodReturn, 1, true)} · {range.toUpperCase()}
            </span>
          )}
        </div>

        <div className="mt-3">
          {history ? (
            <PriceChart
              points={history.points}
              range={range}
              currency={history.currency}
              events={priceEvents}
            />
          ) : (
            <div className="flex h-[260px] items-center justify-center font-mono text-[12px] text-faint">
              {histLoading
                ? "Loading price history…"
                : "No price history available"}
            </div>
          )}
        </div>
      </Card>
      </div>

      {/* Position context (holdings only) — your lot, plus a deeper read beside it */}
      {holding && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="px-6 py-4" i={1}>
            <div className="eyebrow mb-3">Your position</div>
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <MiniStat
                label="Value"
                value={fmtUSD(holding.equity)}
                sub={`${fmtPct(holding.weight, 1)} of portfolio`}
              />
              <MiniStat
                label="Shares"
                value={fmtShares(holding.shares)}
                sub={`avg ${fmtUSD(holding.averageCost)}`}
              />
              <MiniStat
                label="Unrealized P&L"
                value={`${holding.totalReturn >= 0 ? "+" : ""}${fmtUSD(holding.totalReturn)}`}
                sub={`${fmtPct(holding.returnPct, 2, true)} on cost`}
                tone={holding.returnPct}
              />
            </div>
          </Card>

          <Card className="px-6 py-4" i={1}>
            <div className="eyebrow mb-3">Position detail</div>
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <MiniStat
                label="Cost basis"
                value={fmtUSD(holding.costBasis)}
                sub={`${fmtShares(holding.shares)} sh @ ${fmtUSD(holding.averageCost)}`}
              />
              {(() => {
                const dc = holding.dayChange;
                const denom = holding.equity - (dc ?? 0);
                const dcPct = dc !== null && denom > 0 ? dc / denom : null;
                return (
                  <MiniStat
                    label="Day's change"
                    value={
                      dc === null
                        ? "—"
                        : `${dc >= 0 ? "+" : "−"}${fmtUSD(Math.abs(dc))}`
                    }
                    sub={dcPct !== null ? fmtPct(dcPct, 2, true) : "no live quote"}
                    tone={dc ?? undefined}
                  />
                );
              })()}
              <MiniStat
                label="Est. annual income"
                value={
                  f.dividendYield > 0
                    ? fmtUSD(holding.equity * f.dividendYield)
                    : "—"
                }
                sub={
                  f.dividendYield > 0
                    ? `${fmtPct(f.dividendYield, 2)} yield`
                    : "no dividend"
                }
                accent={f.dividendYield > 0 ? "text-mint" : undefined}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Analyst price target */}
      {price !== null && f.analyst.priceTarget > 0 && (
        <Card className="px-6 py-5" i={2}>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="eyebrow">Analyst price target range</span>
            <span className="font-mono text-[11px] text-mute">
              {f.analyst.count > 0 ? `${f.analyst.count} analysts · ` : ""}
              <span className={ratingClass(f.analyst.rating)}>
                {f.analyst.rating}
              </span>
            </span>
          </div>
          <TargetBullet
            low={f.analyst.targetLow}
            high={f.analyst.targetHigh}
            mean={f.analyst.priceTarget}
            price={price}
          />
          <div className="mt-2 flex justify-between font-mono tnum text-[11px] text-mute">
            <span>low {fmtUSD(f.analyst.targetLow)}</span>
            <span>
              now {fmtUSD(price)} ·{" "}
              {upside !== null && (
                <span className={deltaToneClass(upside)}>
                  {fmtPct(upside, 1, true)} to mean
                </span>
              )}
            </span>
            <span>high {fmtUSD(f.analyst.targetHigh)}</span>
          </div>
        </Card>
      )}

      {/* Fundamentals vs the S&P 500 */}
      <div className="grid gap-5 lg:grid-cols-3">
        <CompareCard
          i={3}
          title="Growth"
          rows={[
            row("Revenue growth", f.revenueGrowth, spx.revenueGrowth, true, pctSigned, isEst(f, "revenueGrowth")),
            row("EPS growth", f.epsGrowth, spx.epsGrowth, true, pctSigned, isEst(f, "epsGrowth")),
            row("FCF growth", f.fcfGrowth, spx.fcfGrowth, true, pctSigned, isEst(f, "fcfGrowth")),
            row("12-month return", f.return12m, spx.return12m, true, pctSigned, isEst(f, "return12m")),
          ]}
        />
        <CompareCard
          i={4}
          title="Valuation"
          rows={[
            row("Forward P/E", f.forwardPE, spx.forwardPE, false, (v) => fmtMultiple(v), isEst(f, "forwardPE")),
            row("FCF yield", f.fcfYield, spx.fcfYield, true, (v) => fmtPct(v, 1), isEst(f, "fcfYield")),
            row("Dividend yield", f.dividendYield, spx.dividendYield, true, (v) => fmtPct(v, 2), isEst(f, "dividendYield")),
            row(
              "PEG ratio",
              peg(f.forwardPE, f.epsGrowth),
              peg(spx.forwardPE, spx.epsGrowth) ?? 0,
              false,
              (v) => v.toFixed(2),
              isEst(f, "forwardPE") || isEst(f, "epsGrowth")
            ),
          ]}
        />
        <CompareCard
          i={5}
          title="Quality & risk"
          rows={[
            row("ROIC", f.roic, spx.roic, true, (v) => fmtPct(v, 1), isEst(f, "roic")),
            row("Operating margin", f.operatingMargin, spx.operatingMargin, true, (v) => fmtPct(v, 1), isEst(f, "operatingMargin")),
            row("Gross margin", f.grossMargin, spx.grossMargin, true, (v) => fmtPct(v, 1), isEst(f, "grossMargin")),
            row("Beta", f.beta, spx.beta, false, (v) => v.toFixed(2), isEst(f, "beta")),
            row("Volatility", f.volatility, spx.volatility, false, (v) => fmtPct(v, 0), isEst(f, "volatility")),
          ]}
        />
      </div>

      {/* Style factors vs the S&P 500 */}
      <Card className="px-6 py-5" i={6}>
        <CardHeader
          eyebrow="Style profile"
          title={`How ${symbol} loads on the four factors`}
          right={
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
              tick = S&P 500
            </span>
          }
          className="mb-5"
        />
        <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {factorRows.map(([label, score, bench, color], idx) => (
            <div key={label} className="flex items-center gap-4">
              <span className="w-20 font-mono text-[11px] uppercase tracking-wider text-mute">
                {label}
              </span>
              <div className="relative flex-1">
                <div className="h-[7px] w-full rounded-full bg-white/[0.05]" />
                <m.div
                  className="absolute top-0 h-[7px] rounded-full"
                  style={{
                    background: `linear-gradient(90deg, color-mix(in srgb, ${color} 30%, transparent), ${color})`,
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{
                    duration: 0.9,
                    delay: 0.2 + idx * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
                <div
                  className="absolute top-1/2 h-[13px] w-[2px] -translate-y-1/2 rounded bg-white/80"
                  style={{ left: `${bench}%` }}
                  title={`S&P 500 · ${bench}`}
                />
              </div>
              <span className="w-10 text-right font-mono tnum text-[13px] text-ink">
                {Math.round(score)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 font-mono text-[10px] text-faint">
          0–100 · tick marks the S&P 500 profile
        </div>
      </Card>

      {/* Catalysts + dividends */}
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <CatalystsCard f={f} i={7} />
        </div>
        <div className="lg:col-span-3">
          <DividendCard
            f={f}
            symbol={symbol}
            holding={holding}
            portfolioIncome={portfolioIncome}
            i={8}
          />
        </div>
      </div>
    </div>
  );
}

interface CompareRowData {
  label: string;
  stock: number | null;
  bench: number;
  higherBetter: boolean;
  fmt: (v: number) => string;
  estimated?: boolean;
}

function row(
  label: string,
  stock: number | null,
  bench: number,
  higherBetter: boolean,
  fmt: (v: number) => string,
  estimated = false
): CompareRowData {
  return { label, stock, bench, higherBetter, fmt, estimated };
}

const pctSigned = (v: number) => fmtPct(v, 1, true);

/** Whether a fundamentals field is estimated rather than sourced live. */
function isEst(f: Fundamentals, field: keyof Fundamentals): boolean {
  return f.provenance?.fields[field] !== "live";
}

function peg(forwardPE: number | null, epsGrowth: number): number | null {
  if (!forwardPE || forwardPE <= 0 || epsGrowth <= 0) return null;
  return forwardPE / (epsGrowth * 100);
}

function CompareCard({
  title,
  rows,
  i,
}: {
  title: string;
  rows: CompareRowData[];
  i: number;
}) {
  return (
    <Card className="px-5 py-4" i={i}>
      <div className="mb-4 flex items-baseline justify-between">
        <div className="eyebrow">{title}</div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
          vs S&P 500
        </span>
      </div>
      <div className="space-y-4">
        {rows.map((r) => (
          <CompareRow key={r.label} {...r} />
        ))}
      </div>
    </Card>
  );
}

function CompareRow({
  label,
  stock,
  bench,
  higherBetter,
  fmt,
  estimated,
}: CompareRowData) {
  const has = stock !== null && Number.isFinite(stock);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-mute">
          {label}
          {estimated && (
            <span className="ml-1 font-mono text-[10px] uppercase tracking-wider text-faint">
              est
            </span>
          )}
        </span>
        <span className="whitespace-nowrap">
          <span className="font-mono tnum text-[13px] text-ink">
            {has ? fmt(stock as number) : "—"}
          </span>
          <span className="ml-2 font-mono tnum text-[11px] text-faint">
            vs {fmt(bench)}
          </span>
        </span>
      </div>
      {has && (
        <CompareBar
          stock={stock as number}
          bench={bench}
          higherBetter={higherBetter}
        />
      )}
    </div>
  );
}

function CompareBar({
  stock,
  bench,
  higherBetter,
}: {
  stock: number;
  bench: number;
  higherBetter: boolean;
}) {
  const lo = Math.min(0, stock, bench);
  const hi = Math.max(0, stock, bench);
  const span = hi - lo || 1;
  const pos = (v: number) => ((v - lo) / span) * 100;
  const beat = higherBetter ? stock >= bench : stock <= bench;
  const color = beat ? "var(--color-pos)" : "var(--color-neg)";
  const zero = pos(0);
  const sx = pos(stock);
  const left = Math.min(zero, sx);
  const width = Math.abs(sx - zero);
  return (
    <div className="relative mt-2 h-[5px] w-full rounded-full bg-white/[0.05]">
      <div
        className="absolute top-0 h-[5px] rounded-full"
        style={{ left: `${left}%`, width: `${width}%`, background: color, opacity: 0.8 }}
      />
      <div
        className="absolute top-1/2 h-[11px] w-[2px] -translate-y-1/2 rounded bg-white/80"
        style={{ left: `${pos(bench)}%` }}
      />
    </div>
  );
}

function CatalystsCard({ f, i }: { f: Fundamentals; i: number }) {
  const earningsDays = daysUntil(f.earningsDate);
  return (
    <Card className="h-full px-5 py-4" i={i}>
      <div className="eyebrow mb-3">Catalysts & flows</div>
      <div className="space-y-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-mute">Next earnings</span>
          <span className="text-right">
            <span className="font-mono tnum text-[13px] text-ink">
              {fmtDate(f.earningsDate)}
            </span>
            {earningsDays !== null && earningsDays >= 0 && (
              <span
                className={`ml-2 font-mono text-[11px] ${
                  earningsDays <= 14 ? "text-warn" : "text-faint"
                }`}
              >
                {earningsDays}d
              </span>
            )}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-mute">Insider signal</span>
          <span
            className={`font-mono text-[13px] ${
              f.insider.signal === "Buying"
                ? "text-pos"
                : f.insider.signal === "Selling"
                  ? "text-neg"
                  : "text-mute"
            }`}
          >
            {f.insider.signal}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-mute">Net insider 6m</span>
          <span
            className={`font-mono tnum text-[13px] ${deltaToneClass(f.insider.netActivity6m)}`}
          >
            {f.insider.netActivity6m >= 0 ? "+" : ""}
            {fmtUSDCompact(f.insider.netActivity6m)}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-mute">Buys / sells 6m</span>
          <span className="font-mono tnum text-[13px] text-ink">
            <span className="text-pos">{f.insider.buys6m}</span>
            {" / "}
            <span className="text-neg">{f.insider.sells6m}</span>
          </span>
        </div>
      </div>
    </Card>
  );
}

function DividendCard({
  f,
  symbol,
  holding,
  portfolioIncome,
  i,
}: {
  f: Fundamentals;
  symbol: string;
  holding: Position | null;
  portfolioIncome: number;
  i: number;
}) {
  const spx = liveBenchmarkProfiles().spx;
  if (f.dividendYield <= 0) {
    return (
      <Card className="h-full px-6 py-5" i={i}>
        <CardHeader
          eyebrow="Dividend analysis"
          title={`${symbol} does not pay a dividend`}
          className="mb-3"
        />
        <p className="text-[12.5px] leading-relaxed text-mute">
          All shareholder return here comes from price appreciation.
        </p>
      </Card>
    );
  }

  const per10k = 10_000 * f.dividendYield;
  const fcfPayout = f.fcfYield > 0 ? f.dividendYield / f.fcfYield : null;
  const stretched = fcfPayout !== null && fcfPayout > 0.8;

  const fields: {
    label: string;
    value: string;
    sub: string;
    accent?: string;
    subClass?: string;
  }[] = [
    {
      label: "Dividend yield",
      value: fmtPct(f.dividendYield, 2),
      sub: `S&P 500 ≈ ${fmtPct(spx.dividendYield, 2)}`,
      subClass:
        f.dividendYield >= spx.dividendYield ? "text-pos" : "text-faint",
    },
    {
      label: "Income / $10k",
      value: fmtUSD(per10k),
      sub: `≈ ${fmtUSD(per10k / 12)}/mo`,
      accent: "text-mint",
    },
    {
      label: "FCF payout",
      value: fcfPayout !== null ? fmtPct(Math.min(fcfPayout, 2), 0) : "n/m",
      sub: "of free cash flow",
      accent: stretched ? "text-warn" : undefined,
    },
  ];

  if (holding) {
    const income = holding.equity * f.dividendYield;
    fields.push({
      label: "Your income",
      value: fmtUSD(income),
      sub:
        portfolioIncome > 0
          ? `${fmtPct(income / portfolioIncome, 1)} of portfolio`
          : "from this holding",
    });
  }

  return (
    <Card className="h-full px-6 py-5" i={i}>
      <CardHeader
        eyebrow="Dividend analysis"
        title={`What ${symbol} pays`}
        className="mb-4"
      />
      <div
        className={`grid grid-cols-2 gap-6 ${
          fields.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
        }`}
      >
        {fields.map((field) => (
          <div key={field.label}>
            <div className="eyebrow">{field.label}</div>
            <div
              className={`mt-1 font-mono tnum text-[21px] ${field.accent ?? "text-ink"}`}
            >
              {field.value}
            </div>
            <div className={`font-mono text-[11px] ${field.subClass ?? "text-faint"}`}>
              {field.sub}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-edge pt-3 text-[11.5px] leading-relaxed text-faint">
        {stretched
          ? "Payout is consuming most of free cash flow — watch sustainability if growth stalls."
          : "Payout looks comfortably covered by free cash flow."}
      </p>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  sub,
  tone,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: number;
  /** Override the value color when there's no signed tone (e.g. income). */
  accent?: string;
}) {
  const valueClass =
    tone !== undefined ? deltaToneClass(tone) : accent ?? "text-ink";
  const subClass = tone !== undefined ? deltaToneClass(tone) : "text-faint";
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 font-mono tnum text-[17px] ${valueClass}`}>
        {value}
      </div>
      <div className={`font-mono text-[11px] ${subClass}`}>{sub}</div>
    </div>
  );
}

function ProvenanceBadge({ target }: { target: ResearchTarget }) {
  const hasQuote = target.quote !== null;
  // Coverage of the *fundamentals* (per-field), independent of the live quote.
  const coverage = target.fundamentals?.provenance?.coverage ?? "fallback";
  const fundLive = coverage === "live";
  // The dot is green only when both the price and the critical fundamentals are
  // live — anything less is amber so a partial/snapshot read never looks live.
  const fullyLive = hasQuote && fundLive;

  const text = hasQuote
    ? fundLive
      ? `Live · ${target.asOf ? relativeTime(target.asOf) : "now"}`
      : coverage === "fallback"
        ? "Live price · estimated fundamentals"
        : "Live price · partial fundamentals"
    : target.live
      ? coverage === "partial"
        ? "Partial fundamentals"
        : "Live fundamentals"
      : "Limited data";

  const stale =
    coverage === "live"
      ? []
      : (["beta", "volatility", "sector"] as const).filter(
          (k) => target.fundamentals?.provenance?.fields[k] !== "live"
        );

  return (
    <Tooltip
      underline={false}
      maxWidth={240}
      content={
        <div className="space-y-1">
          <div>
            {fullyLive
              ? "Price and the risk-critical fundamentals come from a live provider."
              : "Some values are estimated or unavailable from the live provider."}
          </div>
          {stale.length > 0 && (
            <div className="text-faint">Not live: {stale.join(", ")}</div>
          )}
        </div>
      }
    >
      <span className="mt-2 inline-flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${fullyLive ? "bg-pos" : "bg-warn"}`}
        />
        <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
          {text}
        </span>
      </span>
    </Tooltip>
  );
}

function TargetBullet({
  low,
  high,
  mean,
  price,
}: {
  low: number;
  high: number;
  mean: number;
  price: number;
}) {
  const min = Math.min(low > 0 ? low : price, price) * 0.97;
  const max = Math.max(high, price) * 1.03;
  const pos = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  return (
    <div className="relative h-7">
      <div className="absolute top-1/2 h-[6px] w-full -translate-y-1/2 rounded-full bg-white/[0.05]" />
      {low > 0 && high > low && (
        <m.div
          className="absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-gradient-to-r from-vio/30 via-vio/50 to-vio/30"
          style={{ left: pos(low), right: `calc(100% - ${pos(high)})` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        />
      )}
      <m.div
        className="absolute top-1/2 h-[18px] w-[2.5px] -translate-y-1/2 rounded-full bg-vio"
        style={{ left: pos(mean) }}
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: 1, scaleY: 1 }}
        transition={{ delay: 0.45 }}
        title={`mean target ${fmtUSD(mean)}`}
      />
      <m.div
        className="absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 -translate-x-1/2"
        style={{ left: pos(price) }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.55, type: "spring", stiffness: 300, damping: 18 }}
        title={`current ${fmtUSD(price)}`}
      >
        <div className="h-full w-full rounded-full border-2 border-mint bg-void shadow-[0_0_12px_rgba(94,234,212,0.5)]" />
      </m.div>
    </div>
  );
}

function ratingClass(rating: AnalystRating): string {
  if (rating.includes("Strong Buy")) return "text-mint";
  if (rating.includes("Buy")) return "text-pos";
  if (rating.includes("Sell")) return "text-neg";
  return "text-warn";
}
