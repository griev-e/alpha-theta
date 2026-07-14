"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Meter } from "@/components/ui/Meter";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { StatusDot } from "@/components/ui/StatusDot";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Money } from "@/components/ui/Money";
import { ChangePct, InternalsChip, RangeBar, RvolText, ScanTag, ScoreChip } from "@/components/vega/bits";
import { PositionsCard } from "@/components/vega/PositionsCard";
import { fmtPct, fmtUSD } from "@/lib/format";
import { armedAlerts, firedAlerts } from "@/lib/vega/alerts";
import { localDayKey } from "@/lib/vega/journal";
import { markOpenBook, openTrades } from "@/lib/vega/positions";
import { dayRisk } from "@/lib/vega/risk";
import { rankScans, scanQuote, type ScanRow } from "@/lib/vega/scan";
import { useVega } from "@/lib/vega/store";
import { INTERNALS_SYMBOLS } from "@/lib/vega/types";
import { useVegaQuotes } from "@/lib/vega/useVegaQuotes";

/**
 * The cockpit — vega's pre-flight panel. One batched quote poll powers the
 * internals tape, the ranked watchlist, breadth, and the focus ticker; the
 * daily-loss circuit breaker reads the journal. Zero per-symbol fan-out.
 */
export default function CockpitPage() {
  const { state, ready, setFocus, deleteAlert } = useVega();
  const router = useRouter();
  const armed = useMemo(() => armedAlerts(state.alerts), [state.alerts]);
  const fired = useMemo(() => firedAlerts(state.alerts), [state.alerts]);
  // Open journal positions ride the same batched poll — their symbols join
  // the set so the working book marks live at zero extra provider cost.
  const openSymbols = useMemo(
    () => openTrades(state.trades).map((t) => t.symbol),
    [state.trades]
  );
  const symbols = useMemo(
    () => [...new Set([...state.watchlist, ...INTERNALS_SYMBOLS, state.focus, ...openSymbols])],
    [state.watchlist, state.focus, openSymbols]
  );
  const { quotes, asOf, degraded } = useVegaQuotes(ready ? symbols : []);
  const book = useMemo(() => markOpenBook(state.trades, quotes), [state.trades, quotes]);

  const scans = useMemo(() => {
    const now = asOf ?? new Date().toISOString();
    const rows = state.watchlist
      .map((s) => quotes[s])
      .filter((q): q is NonNullable<typeof q> => Boolean(q))
      .map((q) => scanQuote(q, now));
    return rankScans(rows);
  }, [quotes, state.watchlist, asOf]);

  const focusQuote = quotes[state.focus];
  const breadth = useMemo(() => {
    const priced = scans.filter((s) => s.changePct !== null);
    const up = priced.filter((s) => (s.changePct as number) > 0).length;
    return { up, down: priced.length - up, total: priced.length };
  }, [scans]);

  const today = new Date();
  const todayKey = localDayKey(today.toISOString());
  const risk = dayRisk(state.trades, state.settings, todayKey);

  const columns = useMemo<TableColumn<ScanRow>[]>(
    () => [
      {
        key: "symbol",
        header: "Symbol",
        align: "left",
        sortable: true,
        sortValue: (r) => r.symbol,
        cell: (r) => (
          <span className="flex items-center gap-2">
            {r.symbol === state.focus && (
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--color-gold)" }}
              />
            )}
            <span className="font-mono text-[12.5px] text-ink">{r.symbol}</span>
          </span>
        ),
      },
      {
        key: "price",
        header: "Last",
        align: "right",
        sortable: true,
        sortValue: (r) => r.price,
        cell: (r) => <Money value={r.price} className="text-[12.5px]" />,
      },
      {
        key: "chg",
        header: "Chg",
        align: "right",
        sortable: true,
        sortValue: (r) => r.changePct ?? -Infinity,
        cell: (r) => <ChangePct value={r.changePct} />,
      },
      {
        key: "gap",
        header: "Gap",
        align: "right",
        sortable: true,
        sortValue: (r) => r.gapPct ?? -Infinity,
        cell: (r) => <ChangePct value={r.gapPct} digits={1} />,
      },
      {
        key: "rvol",
        header: "RVOL",
        align: "right",
        sortable: true,
        sortValue: (r) => r.rvol ?? -Infinity,
        cell: (r) => <RvolText rvol={r.rvol} />,
      },
      {
        key: "range",
        header: "Day range",
        align: "right",
        cell: (r) => (
          <span className="flex justify-end">
            <RangeBar pos={r.rangePos} />
          </span>
        ),
      },
      {
        key: "score",
        header: "Heat",
        align: "right",
        sortable: true,
        sortValue: (r) => r.score ?? -1,
        cell: (r) => <ScoreChip score={r.score} />,
      },
    ],
    [state.focus]
  );

  return (
    <>
      <PageHeader
        eyebrow="Trade"
        title="Cockpit"
        description="The session at a glance — internals, your watchlist ranked by heat, and the day's risk budget."
        right={
          asOf ? (
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
              <StatusDot tone={degraded ? "stale" : "live"} />
              {degraded ? "feed stalled" : "live"}
            </span>
          ) : undefined
        }
      />

      {/* Internals tape */}
      <Card i={0} className="mb-4 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="eyebrow">Internals</span>
          {INTERNALS_SYMBOLS.map((s) =>
            quotes[s] ? (
              <InternalsChip key={s} quote={quotes[s]} />
            ) : (
              <SkeletonBlock key={s} className="h-4 w-16" />
            )
          )}
          {breadth.total > 0 && (
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-faint">
              breadth
              <span className="text-pos">{breadth.up}↑</span>
              <span className="text-neg">{breadth.down}↓</span>
            </span>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Watchlist */}
        <Card i={1} className="lg:col-span-2 overflow-hidden">
          <CardHeader
            eyebrow="Watchlist"
            title="In play"
            className="px-5 pt-5"
            right={
              <Link href="/vega/scanner" className="btn-secondary h-7 px-2.5 text-[12px]">
                Scanner →
              </Link>
            }
          />
          <div className="mt-3">
            {scans.length === 0 ? (
              <div className="px-5 pb-5 text-[13px] text-faint">
                {degraded
                  ? "Quotes unreachable — the cockpit lights back up when the feed returns."
                  : "Loading the tape…"}
              </div>
            ) : (
              <Table
                columns={columns}
                rows={scans}
                rowKey={(r) => r.symbol}
                defaultSort={{ key: "score", asc: false }}
                onRowClick={(r) => {
                  setFocus(r.symbol);
                  router.push("/vega/chart");
                }}
                density="compact"
                minWidth="min-w-[560px]"
              />
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          {/* Focus ticker */}
          <Card i={2} className="p-5">
            <CardHeader eyebrow="Focused" title={state.focus} />
            {focusQuote ? (
              <div className="mt-3">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-[30px] font-semibold tracking-[-0.02em] text-ink">
                    <Money value={focusQuote.price} />
                  </span>
                  <ChangePct value={focusQuote.changePct} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11.5px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-faint">Open</dt>
                    <dd className="tnum text-mute">{focusQuote.open?.toFixed(2) ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-faint">Prev</dt>
                    <dd className="tnum text-mute">{focusQuote.prevClose?.toFixed(2) ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-faint">High</dt>
                    <dd className="tnum text-pos">{focusQuote.dayHigh?.toFixed(2) ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-faint">Low</dt>
                    <dd className="tnum text-neg">{focusQuote.dayLow?.toFixed(2) ?? "—"}</dd>
                  </div>
                </dl>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link href="/vega/chart" className="btn-primary">
                    Open chart
                  </Link>
                  <Link href="/vega/engine" className="btn-secondary">
                    Edge Engine
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <SkeletonBlock className="h-8 w-32" />
                <SkeletonBlock className="h-4 w-44" />
              </div>
            )}
          </Card>

          {/* Daily circuit breaker */}
          <Card i={3} className="p-5">
            <CardHeader
              eyebrow="Risk"
              title="Daily loss budget"
              right={
                <Link href="/vega/risk" className="text-[12px] text-faint hover:text-ink">
                  Manage →
                </Link>
              }
            />
            <div className="mt-3 flex items-baseline justify-between">
              <span
                className={`font-mono tnum text-[18px] ${
                  risk.realized > 0 ? "text-pos" : risk.realized < 0 ? "text-neg" : "text-mute"
                }`}
              >
                {fmtUSD(risk.realized)}
              </span>
              <span className="font-mono text-[11px] text-faint">
                limit {fmtUSD(risk.limit, true)}
              </span>
            </div>
            <div className="mt-2">
              <Meter
                value={risk.used}
                color="var(--color-gold)"
                overColor="var(--color-neg)"
              />
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
              {risk.halted
                ? "Circuit breaker hit — the plan says you're done for today."
                : risk.realized < 0
                  ? `${fmtUSD(risk.remaining, true)} of drawdown left before the ${fmtPct(state.settings.dailyLossPct / 100, 0)} daily stop.`
                  : "Realized P&L is logged from today's closed journal trades."}
            </p>
          </Card>

          {/* Working positions — live-marked open journal trades. */}
          <PositionsCard
            book={book}
            i={4}
            onFocus={(sym) => {
              setFocus(sym);
              router.push("/vega/chart");
            }}
          />

          {/* Alerts */}
          <Card i={5} className="p-5">
            <CardHeader
              eyebrow="Alerts"
              title="Armed levels"
              right={
                <Link href="/vega/chart" className="text-[12px] text-faint hover:text-ink">
                  Arm on chart →
                </Link>
              }
            />
            {armed.length === 0 && fired.length === 0 ? (
              <p className="mt-3 text-[12px] leading-relaxed text-faint">
                No alerts armed. Set a level from the chart&apos;s Alert button — it rings here,
                as a toast, and (if allowed) a browser notification when price crosses.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {fired.slice(0, 2).map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded-md border border-gold/30 bg-gold/[0.05] px-2 py-1 font-mono text-[11px]">
                    <span className="text-gold">⚑</span>
                    <button
                      onClick={() => {
                        setFocus(a.symbol);
                        router.push("/vega/chart");
                      }}
                      className="text-ink hover:text-gold"
                    >
                      {a.symbol}
                    </button>
                    <span className="tnum text-mute">crossed {a.dir} {a.price.toFixed(2)}</span>
                    <button
                      onClick={() => deleteAlert(a.id)}
                      aria-label="Dismiss fired alert"
                      className="btn-ghost ml-auto h-5 w-5 shrink-0"
                    >
                      <svg width="9" height="9" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M5 5 L15 15 M15 5 L5 15" />
                      </svg>
                    </button>
                  </li>
                ))}
                {armed.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex items-center gap-2 px-2 py-0.5 font-mono text-[11px]">
                    <span className="text-faint">{a.dir === "above" ? "↑" : "↓"}</span>
                    <button
                      onClick={() => {
                        setFocus(a.symbol);
                        router.push("/vega/chart");
                      }}
                      className="text-mute hover:text-ink"
                    >
                      {a.symbol}
                    </button>
                    <span className="tnum text-faint">{a.price.toFixed(2)}</span>
                    {a.note && <span className="truncate text-[10px] text-faint">{a.note}</span>}
                    <button
                      onClick={() => deleteAlert(a.id)}
                      aria-label={`Remove ${a.symbol} alert`}
                      className="btn-ghost danger ml-auto h-5 w-5 shrink-0"
                    >
                      <svg width="9" height="9" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M5 5 L15 15 M15 5 L5 15" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Movers */}
          <Card i={6} className="p-5">
            <CardHeader eyebrow="Watchlist" title="Movers" />
            <ul className="mt-3 space-y-2">
              {[...scans]
                .filter((s) => s.changePct !== null)
                .sort((a, b) => Math.abs(b.changePct as number) - Math.abs(a.changePct as number))
                .slice(0, 4)
                .map((s) => (
                  <li key={s.symbol}>
                    <button
                      onClick={() => {
                        setFocus(s.symbol);
                        router.push("/vega/chart");
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <span className="font-mono text-[12px] text-ink">{s.symbol}</span>
                      <span className="flex flex-wrap gap-1">
                        {s.tags.slice(0, 2).map((t) => (
                          <ScanTag key={t} label={t} />
                        ))}
                      </span>
                      <span className="ml-auto">
                        <ChangePct value={s.changePct} />
                      </span>
                    </button>
                  </li>
                ))}
              {scans.length === 0 && (
                <li className="text-[12.5px] text-faint">Waiting on the tape…</li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
