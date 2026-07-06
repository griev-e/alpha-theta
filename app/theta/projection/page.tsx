"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { ProjectionFan } from "@/components/charts/ProjectionFan";
import { ThetaEmpty } from "@/components/theta/ui";
import { ledgerHasData, useTheta } from "@/lib/theta/store";
import { useThetaAssumptions } from "@/lib/theta/assumptionsStore";
import { ASSUMPTION_PRESETS, isInvested } from "@/lib/theta/assumptions";
import { runProjection } from "@/lib/theta/project";
import { fmtPct, fmtUSD, fmtUSDCompact } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { SplitSkeleton } from "@/components/ui/Skeleton";

export default function ProjectionPage() {
  const { ready, ledger, view } = useTheta();
  const { assumptions, preset } = useThetaAssumptions();
  const [years, setYears] = useState(20);
  const [salt, setSalt] = useState(0);
  const [target, setTarget] = useState<number | null>(null);

  // Debounce the horizon slider so a drag settles into one sim, not dozens.
  const dYears = useDebouncedValue(years, 140);

  const inputs = useMemo(() => {
    const accounts = ledger?.accounts ?? [];
    const investedValue = accounts.filter((a) => a.balance > 0 && isInvested(a.kind)).reduce((s, a) => s + a.balance, 0);
    const cashValue = accounts.filter((a) => a.balance > 0 && !isInvested(a.kind)).reduce((s, a) => s + a.balance, 0);
    const liabilities = accounts.filter((a) => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
    const monthlyContribution = Math.max(0, view?.monthNet ?? 0);
    return { investedValue, cashValue, liabilities, monthlyContribution };
  }, [ledger, view]);

  const result = useMemo(
    () =>
      runProjection({
        ...inputs,
        years: dYears,
        assumptions,
        target,
        seedSalt: salt,
      }),
    [inputs, dYears, assumptions, target, salt]
  );

  if (!ready) return <SplitSkeleton />;
  if (!ledger || !ledgerHasData(ledger)) return <ThetaEmpty page="Projection" />;

  const startNW = inputs.investedValue + inputs.cashValue - inputs.liabilities;
  const horizonYear = new Date().getFullYear() + dYears;
  const prob = result.probTarget ?? 0;
  const presetLabel =
    ASSUMPTION_PRESETS.find((p) => p.id === preset)?.label ?? "Custom";

  return (
    <div>
      <PageHeader
        eyebrow="Planning"
        title="Net-Worth Projection"
        description="A Monte Carlo of your whole balance sheet: invested assets grow with market risk, cash compounds at its yield, and your monthly savings ride on top. Deterministic per balance sheet — not a random slot machine."
      />

      {/* Hero band: the cone of outcomes is the subject; the assumptions that
          reshape it sit in a rail beside it — parity with alpha's Monte Carlo. */}
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Card className="min-w-0 px-6 py-5" i={0}>
          <div className="mb-4 flex items-start justify-between gap-5">
            <p className="max-w-xl text-balance text-[17px] font-medium leading-snug tracking-[-0.01em] text-ink">
              In {horizonYear}, the median path reaches{" "}
              <span className="font-mono tnum">{fmtUSDCompact(result.median)}</span>
              {target ? (
                <>
                  {" "}— a {Math.round(prob * 100)}% chance of clearing your target of{" "}
                  <span className="font-mono tnum text-vio">
                    {fmtUSDCompact(target)}
                  </span>
                  .
                </>
              ) : (
                <>
                  {" "}— about{" "}
                  <span className="font-mono tnum text-mute">
                    {fmtUSDCompact(result.realMedian)}
                  </span>{" "}
                  in today&rsquo;s dollars, from{" "}
                  <span className="font-mono tnum">{fmtUSDCompact(startNW)}</span>{" "}
                  today.
                </>
              )}
            </p>
            <div className="shrink-0 text-right">
              <div className="font-mono tnum text-[34px] font-medium leading-none text-ink">
                {target ? `${Math.round(prob * 100)}%` : fmtUSDCompact(result.median)}
              </div>
              <div className="eyebrow mt-1">
                {target ? "chance of target" : `median in ${dYears}y`}
              </div>
            </div>
          </div>

          <ProjectionFan bands={result.bands} samplePaths={result.samplePaths} target={target} />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-faint">
            <span>
              5th–95th percentile band: {fmtUSDCompact(result.p5)} → {fmtUSDCompact(result.p95)}
            </span>
            <span>
              {fmtUSD(result.totalContributed, true)} contributed over {dYears}y
            </span>
          </div>
        </Card>

        {/* Controls + assumption provenance rail. */}
        <Card className="h-fit px-5 py-5 xl:sticky xl:top-16" i={1} hover={false}>
          <div className="mb-5 flex items-center justify-between">
            <div className="eyebrow">Scenario</div>
            <button
              onClick={() => setSalt((s) => s + 1)}
              className="flex items-center gap-1.5 rounded-md border border-edge px-2.5 py-1 font-mono text-[11px] text-mute transition-colors hover:border-edge2 hover:text-ink"
              title="Redraw a fresh set of paths"
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13.6 6.5A6 6 0 1 0 14 9" />
                <path d="M13.5 2.5v4h-4" />
              </svg>
              Redraw
            </button>
          </div>

          <div className="grid gap-y-6">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="eyebrow">Horizon</span>
                <span className="font-mono tnum text-[15px] text-ink">{years} years</span>
              </div>
              <RangeSlider
                min={1}
                max={40}
                step={1}
                value={years}
                onChange={setYears}
                format={(v) => `${v} years`}
              />
            </div>
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="eyebrow">Target</span>
                <span className="font-mono tnum text-[15px] text-vio">
                  {target ? fmtUSDCompact(target) : "none"}
                </span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                defaultValue=""
                placeholder="e.g. 1,000,000"
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/[^0-9.]/g, ""));
                  setTarget(Number.isFinite(n) && n > 0 ? n : null);
                }}
                className="field h-8 w-full text-right font-mono text-[12px]"
              />
            </div>
          </div>

          {/* Assumption provenance — the forward inputs come from Settings. */}
          <div className="mt-6 border-t border-edge pt-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="eyebrow">Assumptions</span>
              <span
                className={`font-mono text-[10.5px] ${
                  preset ? "text-mute" : "text-warn"
                }`}
              >
                {presetLabel}
              </span>
            </div>
            <dl className="grid gap-y-1.5 font-mono text-[12px]">
              {[
                ["Return", fmtPct(assumptions.investReturn, 0)],
                ["Volatility", fmtPct(assumptions.investVol, 0)],
                ["Cash yield", fmtPct(assumptions.cashYield, 1)],
                ["Income growth", fmtPct(assumptions.incomeGrowth, 0)],
              ].map(([label, val]) => (
                <div key={label} className="flex items-baseline justify-between">
                  <dt className="text-faint">{label}</dt>
                  <dd className="tnum text-mute">{val}</dd>
                </div>
              ))}
            </dl>
            <Link
              href="/theta/settings"
              className="mt-3 inline-block text-[11.5px] text-faint underline-offset-2 transition-colors hover:text-ink hover:underline"
            >
              Edit in Settings →
            </Link>
          </div>
        </Card>
      </div>

      <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
        A model, not a forecast. Invested balances follow geometric Brownian motion at your assumed
        return and volatility; cash compounds at its yield; liabilities are held flat (real paydown only
        helps). Edit the return, volatility, yield and income-growth assumptions in Settings.
      </p>
    </div>
  );
}
