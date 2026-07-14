"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyPanel } from "@/components/ui/EmptyState";
import { Meter } from "@/components/ui/Meter";
import { Segmented } from "@/components/ui/Segmented";
import { Sparkline } from "@/components/charts/Sparkline";
import { EquityCurve } from "@/components/vega/EquityCurve";
import { SimFan } from "@/components/vega/SimFan";
import { fmtNum, fmtPct, fmtUSD } from "@/lib/format";
import { useAsyncCompute } from "@/lib/useAsyncCompute";
import {
  closedTrades,
  entryHourKey,
  entryWeekdayKey,
  equityCurve,
  feeStats,
  groupStats,
  journalStats,
  rollingExpectancy,
  tradeR,
  type GroupStat,
} from "@/lib/vega/journal";
import { kellyFraction } from "@/lib/vega/risk";
import { SIM_MIN_SAMPLES, simulateTrading } from "@/lib/vega/simulate";
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
  const byWeekday = useMemo(() => {
    const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return groupStats(state.trades, entryWeekdayKey).sort(
      (a, b) => order.indexOf(a.key) - order.indexOf(b.key)
    );
  }, [state.trades]);
  const bySide = useMemo(
    () => groupStats(state.trades, (t) => (t.side === "long" ? "Long" : "Short")),
    [state.trades]
  );
  const rolling = useMemo(() => rollingExpectancy(state.trades, 20), [state.trades]);
  const fees = useMemo(() => feeStats(state.trades), [state.trades]);

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

  // The expectancy simulator — bootstrap the trader's own R distribution
  // into alternate futures. Ruin = a drawdown worth 20% of the account at
  // the configured per-trade risk.
  const [horizon, setHorizon] = useState<"25" | "50" | "100">("50");
  const ddLimitR = Math.max(2, Math.round(20 / state.settings.riskPct));
  const { value: sim } = useAsyncCompute(
    () => simulateTrading(rs, { horizon: Number(horizon), ddLimitR }),
    [rs, horizon, ddLimitR]
  );

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

      {/* Edge drift + cost drag */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card i={5} className="p-5 lg:col-span-2">
          <CardHeader
            eyebrow="Trailing 20 trades"
            title="Rolling expectancy"
            right={
              rolling.length > 0 ? (
                <span className="font-mono tnum text-[11px] text-faint">
                  now{" "}
                  <span
                    className={
                      rolling[rolling.length - 1].expectancy >= 0 ? "text-pos" : "text-neg"
                    }
                  >
                    {fmtUSD(rolling[rolling.length - 1].expectancy)}
                  </span>{" "}
                  · win {Math.round(rolling[rolling.length - 1].winRate * 100)}%
                </span>
              ) : undefined
            }
          />
          {rolling.length >= 2 ? (
            <>
              <div className="mt-3">
                <Sparkline
                  values={rolling.map((p) => p.expectancy)}
                  labels={rolling.map((p) => p.t.slice(0, 10))}
                  baseline={0}
                  height={92}
                  color="var(--color-gold)"
                  belowColor="var(--color-neg)"
                  formatValue={(v) => fmtUSD(v)}
                />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-faint">
                Mean P&L per trade over the trailing 20 closes, recomputed after every trade —
                the drift the all-time average hides. Above zero, the recent edge pays.
              </p>
            </>
          ) : (
            <p className="mt-3 text-[12.5px] text-faint">
              Needs at least two closed trades to draw the drift.
            </p>
          )}
        </Card>

        <Card i={6} className="p-5">
          <CardHeader eyebrow="Round-trip costs" title="Fee drag" />
          {fees === null || fees.fees === 0 ? (
            <p className="mt-3 text-[12.5px] leading-relaxed text-faint">
              No fees logged yet. Add commissions per trade and this shows what execution
              actually costs the edge.
            </p>
          ) : (
            <dl className="mt-3 space-y-2 text-[12.5px]">
              {[
                ["Total fees", fmtUSD(-fees.fees), "text-neg"],
                ["Per trade", fmtUSD(-fees.perTrade), "text-mute"],
                [
                  "Of gross wins",
                  fees.shareOfGrossWins !== null ? fmtPct(fees.shareOfGrossWins, 1) : "—",
                  "text-warn",
                ],
              ].map(([label, value, cls]) => (
                <div key={label as string} className="flex items-baseline justify-between gap-3">
                  <dt className="text-faint">{label}</dt>
                  <dd className={`font-mono tnum ${cls}`}>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {fees !== null && fees.fees > 0 && (
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              Journal P&L is already net of fees — this is the drag the netting hides.
            </p>
          )}
        </Card>
      </div>

      {/* The expectancy simulator */}
      <Card i={7} className="mt-4 p-5">
        <CardHeader
          eyebrow="Bootstrap Monte Carlo"
          title={`If you keep trading this edge — the next ${horizon} trades`}
          right={
            <Segmented
              value={horizon}
              onChange={setHorizon}
              options={[
                { value: "25", label: "25" },
                { value: "50", label: "50" },
                { value: "100", label: "100" },
              ]}
            />
          }
        />
        {sim ? (
          <>
            <div className="mt-2">
              <SimFan result={sim} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                {
                  label: "P(finish ahead)",
                  value: `${Math.round(sim.pPositive * 100)}%`,
                  tone: sim.pPositive >= 0.5 ? "text-pos" : "text-neg",
                  sub: `after ${sim.horizon} trades`,
                },
                {
                  label: "Risk of ruin",
                  value: `${Math.round(sim.riskOfRuin * 100)}%`,
                  tone: sim.riskOfRuin <= 0.05 ? "text-pos" : sim.riskOfRuin <= 0.2 ? "text-warn" : "text-neg",
                  sub: `odds of a −${sim.ddLimitR}R drawdown (≈20% of account at ${fmtNum(state.settings.riskPct, 1)}% risk)`,
                },
                {
                  label: "Typical worst stretch",
                  value: `${fmtNum(sim.medianMaxDrawdown, 1)}R`,
                  tone: "text-neg",
                  sub: "median max drawdown across paths",
                },
                {
                  label: "Expectancy",
                  value: `${sim.expectancy >= 0 ? "+" : ""}${fmtNum(sim.expectancy, 2)}R`,
                  tone: sim.expectancy >= 0 ? "text-pos" : "text-neg",
                  sub: `bootstrapped from ${sim.samples} closed R-trades`,
                },
              ].map((t) => (
                <div key={t.label} className="rounded-lg border border-edge/70 bg-white/[0.015] px-3.5 py-3">
                  <div className="eyebrow">{t.label}</div>
                  <div className={`mt-1 font-mono tnum text-[17px] ${t.tone}`}>{t.value}</div>
                  <div className="mt-0.5 text-[10.5px] leading-snug text-faint">{t.sub}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 max-w-3xl text-[11px] leading-relaxed text-faint">
              {sim.paths.toLocaleString()} sequences resampled (with replacement) from your own
              closed R-multiples — no return model assumed, the journal IS the distribution.
              Deterministic per journal. A small sample bootstraps a small truth: treat the bands
              as sequence risk on the edge you&apos;ve shown, not a forecast.
            </p>
          </>
        ) : (
          <p className="mt-3 text-[12.5px] text-faint">
            Needs at least {SIM_MIN_SAMPLES} closed trades with stops logged ({rs.length} so far) —
            the R distribution is the simulator&apos;s only input, so it won&apos;t invent one.
          </p>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* R distribution */}
        <Card i={8} className="p-5">
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
        <Card i={9} className="p-5">
          <CardHeader eyebrow="Entry hour, local time" title="When the edge shows up" />
          <GroupList rows={byHour} />
        </Card>

        {/* By setup */}
        <Card i={10} className="p-5">
          <CardHeader eyebrow="Playbook" title="P&L by setup" />
          <GroupList rows={bySetup} />
        </Card>

        {/* By symbol */}
        <Card i={11} className="p-5">
          <CardHeader eyebrow="Tickers" title="P&L by symbol" />
          <GroupList rows={bySymbol.slice(0, 8)} />
        </Card>

        {/* By weekday */}
        <Card i={12} className="p-5">
          <CardHeader eyebrow="Entry weekday" title="Which days pay" />
          <GroupList rows={byWeekday} />
        </Card>

        {/* Long vs short */}
        <Card i={13} className="p-5">
          <CardHeader eyebrow="Direction" title="Long vs short" />
          <GroupList rows={bySide} />
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
