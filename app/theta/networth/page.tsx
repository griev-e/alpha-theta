"use client";

import { useMemo } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { ProgressBar } from "@/components/theta/bits";
import { ThetaEmpty } from "@/components/theta/ui";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { riskReport } from "@/lib/analytics/risk";
import { SPX } from "@/lib/data/benchmarks";
import { usePortfolio } from "@/lib/store";
import { householdRisk } from "@/lib/theta/household";
import { ledgerHasData, useTheta } from "@/lib/theta/store";
import { fmtNum, fmtPct, fmtUSD, fmtUSDCompact } from "@/lib/format";
import { PageSkeleton } from "@/components/ui/Skeleton";

/** Account kinds whose balances are liquid (not exposed to the equity market). */
const LIQUID_KINDS = new Set(["checking", "savings"]);

export default function NetWorthPage() {
  const { ready, ledger, view } = useTheta();
  // Same provider tree — read the active alpha portfolio for the risk bridge.
  const { portfolio, activeId, portfolios } = usePortfolio();

  const household = useMemo(() => {
    if (!ledger || !view || !portfolio || !activeId) return null;
    // The deepening needs a live link: a theta account mirroring THIS (active,
    // live-priced) alpha portfolio. Without one there's no portfolio risk to read.
    const exposed = ledger.accounts
      .filter((a) => a.linkedPortfolioId === activeId)
      .reduce((s, a) => s + Math.max(0, a.balance), 0);
    if (exposed <= 0) return null;
    const risk = riskReport(portfolio, SPX.sectorWeights);
    const liquidAssets = ledger.accounts
      .filter((a) => a.balance > 0 && LIQUID_KINDS.has(a.kind))
      .reduce((s, a) => s + a.balance, 0);
    const result = householdRisk({
      investedExposed: exposed,
      portfolioBeta: risk.beta,
      portfolioVol: risk.volatility,
      netWorth: view.netWorth,
      liquidAssets,
      monthlySpend: view.monthExpenses,
    });
    if (!result) return null;
    const name = portfolios.find((p) => p.id === activeId)?.name ?? "your portfolio";
    return { ...result, name, beta: risk.beta };
  }, [ledger, view, portfolio, activeId, portfolios]);

  if (!ready) return <PageSkeleton />;
  if (!ledger || !view || !ledgerHasData(ledger)) return <ThetaEmpty page="Net worth" />;

  const series = view.netWorthSeries;
  const first = series[0]?.value ?? view.netWorth;
  const last = view.netWorth;
  const yearChange = last - first;
  const yearChangePct = first !== 0 ? yearChange / first : 0;
  const up = yearChange >= 0;

  const assets = ledger.accounts.filter((a) => a.balance > 0).sort((a, b) => b.balance - a.balance);
  const liabilities = ledger.accounts.filter((a) => a.balance < 0).sort((a, b) => a.balance - b.balance);

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Net Worth"
        description="Everything you own minus everything you owe, tracked over time."
      />

      <Card className="relative mb-5 overflow-hidden px-6 py-6 sm:px-8" i={0}>
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full blur-[90px]" style={{ background: "rgba(94,234,212,0.10)" }} />
        <div className="relative mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Net worth</div>
            <div className="mt-1.5 font-mono tnum text-[34px] font-medium leading-none text-ink sm:text-[40px]">{fmtUSD(last, true)}</div>
          </div>
          <div className="flex gap-8">
            <Stat
              label={`${series.length}-month change`}
              value={yearChange}
              format={(v) => `${up ? "+" : "−"}${fmtUSDCompact(Math.abs(v))}`}
              toneClass={up ? "text-pos" : "text-neg"}
              sub={fmtPct(yearChangePct, 1, true)}
            />
            <Stat label="Assets" value={view.totalAssets} format={fmtUSDCompact} sub="total owned" />
            <Stat label="Liabilities" value={view.totalLiabilities} format={fmtUSDCompact} sub="total owed" />
          </div>
        </div>
        <div className="relative">
          {series.length >= 2 ? (
            <>
              <Sparkline values={series.map((p) => p.value)} height={220} color="var(--color-mint)" />
              <div className="mt-2 flex">
                {series.map((p, idx) => (
                  <div key={`${p.month}-${idx}`} className="flex-1 text-center font-mono text-[10px] text-faint">{p.month}</div>
                ))}
              </div>
            </>
          ) : (
            <p className="py-12 text-center text-[13px] text-faint">Not enough history to chart yet.</p>
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="px-5 py-5" i={1}>
          <CardHeader eyebrow="Composition" title="Assets" className="mb-4" />
          {assets.length > 0 ? (
            <div className="flex flex-col gap-4">
              {assets.map((a) => (
                <div key={a.id}>
                  <div className="mb-1.5 flex items-center justify-between text-[12px]">
                    <span className="text-mute">{a.name}</span>
                    <span className="font-mono tnum text-ink">
                      {fmtUSD(a.balance, true)} <span className="text-faint">({fmtPct(view.totalAssets > 0 ? a.balance / view.totalAssets : 0, 0)})</span>
                    </span>
                  </div>
                  <ProgressBar value={a.balance} max={view.totalAssets} color="var(--color-mint)" />
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-[13px] text-faint">No assets.</p>
          )}
        </Card>

        <Card className="px-5 py-5" i={2}>
          <CardHeader eyebrow="Composition" title="Liabilities" className="mb-4" />
          {liabilities.length > 0 ? (
            <div className="flex flex-col gap-4">
              {liabilities.map((a) => (
                <div key={a.id}>
                  <div className="mb-1.5 flex items-center justify-between text-[12px]">
                    <span className="text-mute">{a.name}</span>
                    <span className="font-mono tnum text-ink">
                      {fmtUSD(Math.abs(a.balance), true)} <span className="text-faint">({fmtPct(view.totalLiabilities > 0 ? Math.abs(a.balance) / view.totalLiabilities : 0, 0)})</span>
                    </span>
                  </div>
                  <ProgressBar value={Math.abs(a.balance)} max={view.totalLiabilities} color="var(--color-neg)" />
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-[13px] text-faint">No liabilities — debt-free.</p>
          )}
        </Card>
      </div>

      {household && (
        <Card className="mt-5 px-6 py-6" i={3}>
          <CardHeader
            eyebrow="alpha ↔ theta"
            title="Market risk to your net worth"
            className="mb-1"
          />
          <p className="mb-5 max-w-2xl text-[12.5px] leading-relaxed text-mute">
            {fmtUSDCompact(household.investedExposed)} —{" "}
            {fmtPct(household.exposurePct, 0)} of your net worth — tracks{" "}
            <span className="text-ink">{household.name}</span> (β{" "}
            {fmtNum(household.beta, 2)}). A typical down year (−1σ) is about{" "}
            <span className="text-neg">−{fmtUSDCompact(household.typicalBadYear)}</span>.
          </p>

          <div className="space-y-3.5">
            {household.scenarios.map((s, i) => (
              <div key={s.label}>
                <div className="mb-1 flex items-baseline justify-between text-[12px]">
                  <span className="text-mute">
                    {s.label}
                    <span className="ml-1.5 text-faint">
                      market {fmtPct(s.marketShock, 0)}
                    </span>
                  </span>
                  <span className="font-mono tnum text-[12px]">
                    <span className="text-neg">{fmtUSDCompact(s.loss)}</span>
                    <span className="text-faint">
                      {" "}
                      → {fmtUSDCompact(s.newNetWorth)} net worth
                    </span>
                  </span>
                </div>
                <ProgressBar
                  value={Math.min(1, -s.netWorthDropPct)}
                  max={1}
                  color="var(--color-neg)"
                  delay={0.05 + i * 0.05}
                />
                <div className="mt-0.5 text-right font-mono text-[10.5px] text-faint">
                  {fmtPct(-s.netWorthDropPct, 1)} of net worth
                </div>
              </div>
            ))}
          </div>

          {household.runwayMonths !== null && (
            <p className="mt-5 rounded-lg border border-edge bg-white/[0.02] px-4 py-3 text-[12px] leading-relaxed text-mute">
              <span className="text-pos">Your safety net holds.</span> Liquid
              savings still cover{" "}
              <span className="text-ink">
                {fmtNum(household.runwayMonths, 1)} months
              </span>{" "}
              of spending through any of these — a market drop hits invested
              assets, not your runway.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
