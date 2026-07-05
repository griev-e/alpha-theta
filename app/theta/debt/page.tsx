"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { ThetaEmpty } from "@/components/theta/ui";
import { ledgerHasData, useTheta } from "@/lib/theta/store";
import { useThetaAssumptions } from "@/lib/theta/assumptionsStore";
import { debtLines, planDebtPayoff, type DebtStrategy } from "@/lib/theta/debt";
import { fmtPct, fmtUSD, fmtUSDCompact } from "@/lib/format";
import { PageSkeleton } from "@/components/ui/Skeleton";

export default function DebtPage() {
  const { ready, ledger } = useTheta();
  const { assumptions } = useThetaAssumptions();
  const [strategy, setStrategy] = useState<DebtStrategy>("avalanche");
  const [extra, setExtra] = useState(300);

  const lines = useMemo(() => debtLines(ledger?.accounts ?? [], assumptions), [ledger, assumptions]);
  const totalMinimum = useMemo(
    () => planDebtPayoff(lines, 1e9, strategy).totalMinimum,
    [lines, strategy]
  );
  const budget = totalMinimum + extra;

  const plan = useMemo(() => planDebtPayoff(lines, budget, strategy), [lines, budget, strategy]);
  // Minimums-only baseline, to quantify what the extra payment buys.
  const baseline = useMemo(() => planDebtPayoff(lines, totalMinimum, strategy), [lines, totalMinimum, strategy]);

  if (!ready) return <PageSkeleton />;
  if (!ledger || !ledgerHasData(ledger)) return <ThetaEmpty page="Debt payoff" />;

  const totalDebt = lines.reduce((s, l) => s + l.balance, 0);

  if (lines.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Money" title="Debt Payoff" description="Amortize your liabilities and see when you're debt-free." />
        <Card className="px-5 py-12 text-center" i={0}>
          <p className="text-[13px] text-faint">No liabilities — nothing to pay off. Nice.</p>
        </Card>
      </div>
    );
  }

  const interestSaved = baseline.totalInterest - plan.totalInterest;
  const monthsSaved = baseline.months - plan.months;

  return (
    <div>
      <PageHeader
        eyebrow="Money"
        title="Debt Payoff"
        description="Route a monthly budget at your balances and watch the payoff date and interest move. Avalanche is cheapest; snowball clears small balances first."
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {(["avalanche", "snowball"] as DebtStrategy[]).map((s) => (
            <button
              key={s}
              onClick={() => setStrategy(s)}
              className={`h-8 rounded-md border px-3 text-[12.5px] font-medium capitalize transition-colors ${
                strategy === s ? "border-white/30 bg-white/[0.06] text-ink" : "border-edge2 text-mute hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-[12px] text-mute">
          Extra / mo above minimums
          <input
            type="range"
            min={0}
            max={2000}
            step={50}
            value={extra}
            onChange={(e) => setExtra(Number(e.target.value))}
            className="w-40 accent-[var(--color-vio)]"
          />
          <span className="w-16 text-right font-mono tnum text-ink">{fmtUSD(extra, true)}</span>
        </label>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="px-5 py-4" i={0} hover={false}>
          <Stat label="Total debt" value={totalDebt} format={fmtUSDCompact} size="sm" toneClass="text-neg" />
        </Card>
        <Card className="px-5 py-4" i={1} hover={false}>
          <Stat label="Debt-free in" value={plan.months} format={(v) => (plan.payoffDate ? `${v} mo` : "—")} size="sm" toneClass="text-pos" sub={plan.payoffDate ? fmtDate(plan.payoffDate) : undefined} />
        </Card>
        <Card className="px-5 py-4" i={2} hover={false}>
          <Stat label="Total interest" value={plan.totalInterest} format={fmtUSDCompact} size="sm" />
        </Card>
        <Card className="px-5 py-4" i={3} hover={false}>
          <Stat label="Monthly budget" value={budget} format={(v) => fmtUSD(v, true)} size="sm" sub={`${fmtUSD(totalMinimum, true)} minimums`} />
        </Card>
      </div>

      {interestSaved > 1 && (
        <div className="mb-5 rounded-lg border border-pos/25 bg-pos/[0.06] px-4 py-3 text-[13px] text-pos">
          The extra {fmtUSD(extra, true)}/mo saves {fmtUSD(interestSaved, true)} in interest and clears the debt{" "}
          {monthsSaved > 0 ? `${monthsSaved} month${monthsSaved === 1 ? "" : "s"} sooner` : "sooner"}.
        </div>
      )}

      <Card className="px-5 py-5" i={4}>
        <CardHeader eyebrow="Payoff curve" title="Balance over time" className="mb-4" />
        <PayoffCurve schedule={plan.schedule} />
      </Card>

      <Card className="mt-5 px-5 py-5" i={5}>
        <CardHeader eyebrow="Per account" title="Order of attack" className="mb-4" />
        <div className="flex flex-col divide-y divide-edge/60">
          {plan.perAccount
            .slice()
            .sort((a, b) => a.months - b.months)
            .map((p) => {
              const line = lines.find((l) => l.id === p.id);
              return (
                <div key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 text-[13px]">
                  <div>
                    <div className="text-ink">{p.name}</div>
                    <div className="text-[11.5px] text-faint">
                      {line ? `${fmtUSD(line.balance, true)} @ ${fmtPct(line.apr, 1)} APR` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono tnum text-ink">{p.months ? `${p.months} mo` : "—"}</div>
                    <div className="text-[11.5px] text-faint">{fmtUSD(p.interestPaid, true)} interest</div>
                  </div>
                </div>
              );
            })}
        </div>
      </Card>

      <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
        APRs come from each account when set, otherwise the credit / loan defaults in Settings. Minimum
        payments model interest plus 1% of principal (floored at $25). A model, not advice.
      </p>
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Compact hand-built SVG of the aggregate remaining-balance curve. */
function PayoffCurve({ schedule }: { schedule: { month: number; remaining: number }[] }) {
  const W = 720;
  const H = 200;
  const PAD = { l: 8, r: 56, t: 10, b: 22 };
  const months = schedule[schedule.length - 1]?.month || 1;
  const maxY = Math.max(...schedule.map((s) => s.remaining), 1);
  const x = (m: number) => PAD.l + (m / months) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / maxY) * (H - PAD.t - PAD.b);
  const path = schedule.map((s, i) => `${i === 0 ? "M" : "L"} ${x(s.month)} ${y(s.remaining)}`).join(" ");
  const areaPath = `${path} L ${x(months)} ${y(0)} L ${x(0)} ${y(0)} Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" preserveAspectRatio="none">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(maxY * f)} y2={y(maxY * f)} stroke="currentColor" className="text-edge" strokeWidth="1" />
            <text x={W - PAD.r + 6} y={y(maxY * f) + 3} className="fill-faint text-[10px] font-mono">
              {fmtUSDCompact(maxY * f)}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="var(--color-vio)" opacity="0.12" />
        <path d={path} fill="none" stroke="var(--color-vio)" strokeWidth="2" />
        <text x={PAD.l} y={H - 6} className="fill-faint text-[10px] font-mono">now</text>
        <text x={x(months)} y={H - 6} className="fill-faint text-[10px] font-mono" textAnchor="end">
          {Math.round(months / 12) >= 1 ? `${Math.round(months / 12)}y` : `${months}mo`}
        </text>
      </svg>
    </div>
  );
}
