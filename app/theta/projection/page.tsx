"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { ProjectionFan } from "@/components/charts/ProjectionFan";
import { ThetaEmpty } from "@/components/theta/ui";
import { ledgerHasData, useTheta } from "@/lib/theta/store";
import { useThetaAssumptions } from "@/lib/theta/assumptionsStore";
import { isInvested } from "@/lib/theta/assumptions";
import { runProjection } from "@/lib/theta/project";
import { fmtPct, fmtUSD, fmtUSDCompact } from "@/lib/format";

const HORIZONS = [5, 10, 20, 30];

export default function ProjectionPage() {
  const { ready, ledger, view } = useTheta();
  const { assumptions } = useThetaAssumptions();
  const [years, setYears] = useState(20);
  const [salt, setSalt] = useState(0);
  const [target, setTarget] = useState<number | null>(null);

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
        years,
        assumptions,
        target,
        seedSalt: salt,
      }),
    [inputs, years, assumptions, target, salt]
  );

  if (!ready) return null;
  if (!ledger || !ledgerHasData(ledger)) return <ThetaEmpty page="Projection" />;

  const startNW = inputs.investedValue + inputs.cashValue - inputs.liabilities;

  return (
    <div>
      <PageHeader
        eyebrow="Planning"
        title="Net-Worth Projection"
        description="A Monte Carlo of your whole balance sheet: invested assets grow with market risk, cash compounds at its yield, and your monthly savings ride on top."
        right={
          <button
            onClick={() => setSalt((s) => s + 1)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-edge2 px-3 text-[12.5px] font-medium text-mute transition-colors hover:border-white/30 hover:text-ink"
          >
            Resimulate
          </button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {HORIZONS.map((y) => (
          <button
            key={y}
            onClick={() => setYears(y)}
            className={`h-8 rounded-md border px-3 text-[12.5px] font-medium transition-colors ${
              years === y ? "border-white/30 bg-white/[0.06] text-ink" : "border-edge2 text-mute hover:text-ink"
            }`}
          >
            {y} years
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-[12px] text-mute">
          Target
          <input
            type="text"
            inputMode="numeric"
            defaultValue=""
            placeholder="none"
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^0-9.]/g, ""));
              setTarget(Number.isFinite(n) && n > 0 ? n : null);
            }}
            className="field h-8 w-28 text-right font-mono text-[12px]"
          />
        </label>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="px-5 py-4" i={0} hover={false}>
          <Stat label="Net worth today" value={startNW} format={fmtUSDCompact} size="sm" />
        </Card>
        <Card className="px-5 py-4" i={1} hover={false}>
          <Stat label={`Median in ${years}y`} value={result.median} format={fmtUSDCompact} size="sm" toneClass="text-pos" />
        </Card>
        <Card className="px-5 py-4" i={2} hover={false}>
          <Stat label="Median (today's $)" value={result.realMedian} format={fmtUSDCompact} size="sm" />
        </Card>
        <Card className="px-5 py-4" i={3} hover={false}>
          {target ? (
            <Stat label="Reach target" value={result.probTarget ?? 0} format={(v) => fmtPct(v, 0)} size="sm" toneClass="text-vio" />
          ) : (
            <Stat label="Saving / mo" value={inputs.monthlyContribution} format={(v) => `${fmtUSD(v, true)}`} size="sm" />
          )}
        </Card>
      </div>

      <Card className="px-5 py-5" i={4}>
        <CardHeader
          eyebrow="Distribution of outcomes"
          title={`${years}-year net-worth fan`}
          className="mb-4"
        />
        <ProjectionFan bands={result.bands} samplePaths={result.samplePaths} target={target} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-faint">
          <span>
            5th–95th percentile band: {fmtUSDCompact(result.p5)} → {fmtUSDCompact(result.p95)}
          </span>
          <span>
            {fmtUSD(result.totalContributed, true)} contributed over {years}y ·{" "}
            {fmtPct(assumptions.investReturn, 0)} return / {fmtPct(assumptions.investVol, 0)} vol
          </span>
        </div>
      </Card>

      <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
        A model, not a forecast. Invested balances follow geometric Brownian motion at your assumed
        return and volatility; cash compounds at its yield; liabilities are held flat (real paydown only
        helps). Edit the return, volatility, yield and income-growth assumptions in Settings.
      </p>
    </div>
  );
}
