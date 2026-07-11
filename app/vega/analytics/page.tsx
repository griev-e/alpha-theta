"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyPanel } from "@/components/ui/EmptyState";
import { Meter } from "@/components/ui/Meter";
import { EquityCurve } from "@/components/vega/EquityCurve";
import { fmtNum, fmtUSD } from "@/lib/format";
import {
  closedTrades,
  entryHourKey,
  equityCurve,
  groupStats,
  journalStats,
  tradeR,
  type GroupStat,
} from "@/lib/vega/journal";
import { kellyFraction } from "@/lib/vega/risk";
import { useVega } from "@/lib/vega/store";

/**
 * Performance analytics over the journal — the honest mirror. Equity curve
 * with its drawdowns, the R distribution, and where the edge actually lives
 * (setup, symbol, time of day). Pure functions of the logged trades.
 */
export default function AnalyticsPage() {
  const { state, ready, loadSampleJournal } = useVega();
  const stats = useMemo(() => journalStats(state.trades), [state.trades]);
  const curve = useMemo(() => equityCurve(state.trades), [state.trades]);
  const rs = useMemo(
    () =>
      closedTrades(state.trades)
        .map(tradeR)
        .filter((r): r is number => r !== null),
    [state.trades]
  );
  const bySetup = useMemo(
    () => groupStats(state.trades, (t) => t.setup ?? "untagged"),
    [state.trades]
  );
  const bySymbol = useMemo(
    () => groupStats(state.trades, (t) => t.symbol),
    [state.trades]
  );
  const byHour = useMemo(
    () =>
      groupStats(state.trades, (t) => `${entryHourKey(t)}:00`).sort((a, b) =>
        a.key.localeCompare(b.key)
      ),
    [state.trades]
  );

  const rHist = useMemo(() => {
    if (rs.length === 0) return [];
    const edges = [-3, -2, -1, 0, 1, 2, 3];
    const buckets = new Array(edges.length + 1).fill(0) as number[];
    for (const r of rs) {
      let i = 0;
      while (i < edges.length && r >= edges[i]) i++;
      buckets[i] += 1;
    }
    const labels = ["<−3R", "−3..−2", "−2..−1", "−1..0", "0..1", "1..2", "2..3", ">3R"];
    return buckets.map((count, i) => ({ label: labels[i], count, neg: i < 4 }));
  }, [rs]);

  const kelly =
    stats !== null ? kellyFraction(stats.winRate, stats.avgWin, stats.avgLoss) : null;

  if (ready && (!stats || stats.count === 0)) {
    return (
      <>
        <PageHeader eyebrow="Performance" title="Analytics" description="Win rate, expectancy, drawdown, and where the edge lives." />
        <EmptyPanel
          watermark="ν"
          icon={
            <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke="var(--color-gold)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 16.5 V3.5 M3 16.5 H16.8 M4.5 13.5 L8 10.5 L10.5 12 L15.5 5.5" />
            </svg>
          }
          heading="No closed trades to analyze"
          body="Once trades close in the journal, the equity curve, R distribution, and per-setup breakdowns compute themselves — or load the sample journal to preview the read."
          primary={
            <Link href="/vega/journal" className="btn-primary">
              Open the journal
            </Link>
          }
          secondary={
            <button onClick={loadSampleJournal} className="btn-secondary">
              Load sample journal
            </button>
          }
        />
      </>
    );
  }
  if (!stats) return null;

  const tiles: { label: string; value: string; tone?: string; sub?: string }[] = [
    {
      label: "Net P&L",
      value: fmtUSD(stats.totalPnl),
      tone: stats.totalPnl >= 0 ? "text-pos" : "text-neg",
      sub: `${stats.count} closed trades`,
    },
    {
      label: "Win rate",
      value: `${Math.round(stats.winRate * 100)}%`,
      sub: `${stats.wins}W · ${stats.losses}L`,
    },
    {
      label: "Profit factor",
      value:
        stats.profitFactor === null
          ? "—"
          : stats.profitFactor === Infinity
            ? "∞"
            : fmtNum(stats.profitFactor, 2),
      sub: "gross win ÷ gross loss",
    },
    {
      label: "Expectancy",
      value: fmtUSD(stats.expectancy),
      tone: stats.expectancy >= 0 ? "text-pos" : "text-neg",
      sub: "per trade",
    },
    {
      label: "Avg R",
      value: stats.avgR !== null ? `${fmtNum(stats.avgR, 2)}R` : "—",
      sub: `${Math.round(stats.stopDiscipline * 100)}% of trades carried a stop`,
    },
    {
      label: "Max drawdown",
      value: fmtUSD(stats.maxDrawdown),
      tone: "text-neg",
      sub: "on the realized curve",
    },
    {
      label: "Best / worst",
      value: `${fmtUSD(stats.best ?? 0, true)} / ${fmtUSD(stats.worst ?? 0, true)}`,
      sub: "single trade",
    },
    {
      label: "Avg hold",
      value:
        stats.avgHoldMinutes === null
          ? "—"
          : stats.avgHoldMinutes >= 60
            ? `${fmtNum(stats.avgHoldMinutes / 60, 1)}h`
            : `${Math.round(stats.avgHoldMinutes)}m`,
      sub: `streaks: ${stats.longestWinStreak}W / ${stats.longestLossStreak}L`,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Performance"
        title="Analytics"
        description="The mirror — realized results only, R-multiples where a stop was logged, nothing imputed."
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {tiles.map((t, i) => (
          <Card key={t.label} i={i} className="p-4">
            <div className="eyebrow">{t.label}</div>
            <div className={`mt-1 font-mono tnum text-[19px] ${t.tone ?? "text-ink"}`}>{t.value}</div>
            {t.sub && <div className="mt-1 text-[11px] text-faint">{t.sub}</div>}
          </Card>
        ))}
      </div>

      <Card i={4} className="mt-4 p-5">
        <CardHeader
          eyebrow="Cumulative realized P&L"
          title="Equity curve"
          right={
            kelly !== null ? (
              <span className="font-mono text-[11px] text-faint" title="Half-Kelly off realized win rate and payoff — full Kelly overbets noisy estimates.">
                half-Kelly {fmtNum((kelly / 2) * 100, 1)}%
              </span>
            ) : undefined
          }
        />
        <div className="mt-2">
          <EquityCurve points={curve} />
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* R distribution */}
        <Card i={5} className="p-5">
          <CardHeader eyebrow={`${rs.length} trades with a stop`} title="R-multiple distribution" />
          {rHist.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-faint">
              Log stops with your trades to unlock the R view.
            </p>
          ) : (
            <div className="mt-4 flex h-36 items-end gap-1.5">
              {rHist.map((b) => {
                const max = Math.max(...rHist.map((x) => x.count), 1);
                return (
                  <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="font-mono tnum text-[10px] text-faint">
                      {b.count > 0 ? b.count : ""}
                    </span>
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${(b.count / max) * 100}%`,
                        minHeight: b.count > 0 ? 3 : 1,
                        background: b.neg
                          ? "color-mix(in srgb, var(--color-neg) 55%, transparent)"
                          : "color-mix(in srgb, var(--color-pos) 55%, transparent)",
                      }}
                    />
                    <span className="font-mono text-[8.5px] text-faint">{b.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* By hour */}
        <Card i={6} className="p-5">
          <CardHeader eyebrow="Entry hour, local time" title="When the edge shows up" />
          <GroupList rows={byHour} />
        </Card>

        {/* By setup */}
        <Card i={7} className="p-5">
          <CardHeader eyebrow="Playbook" title="P&L by setup" />
          <GroupList rows={bySetup} />
        </Card>

        {/* By symbol */}
        <Card i={8} className="p-5">
          <CardHeader eyebrow="Tickers" title="P&L by symbol" />
          <GroupList rows={bySymbol.slice(0, 8)} />
        </Card>
      </div>
    </>
  );
}

function GroupList({ rows }: { rows: GroupStat[] }) {
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.pnl)), 1);
  if (rows.length === 0) {
    return <p className="mt-3 text-[12.5px] text-faint">Nothing here yet.</p>;
  }
  return (
    <ul className="mt-3 space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-3">
          <span className="w-20 shrink-0 truncate font-mono text-[11.5px] text-mute">{r.key}</span>
          <div className="flex-1">
            <Meter
              value={Math.abs(r.pnl)}
              max={maxAbs}
              color={r.pnl >= 0 ? "var(--color-pos)" : "var(--color-neg)"}
              height={6}
            />
          </div>
          <span className={`w-20 shrink-0 text-right font-mono tnum text-[11.5px] ${r.pnl >= 0 ? "text-pos" : "text-neg"}`}>
            {fmtUSD(r.pnl, true)}
          </span>
          <span className="w-14 shrink-0 text-right font-mono tnum text-[10.5px] text-faint">
            {Math.round(r.winRate * 100)}% · {r.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
