"use client";

import { useMemo } from "react";
import { Sankey } from "@/components/charts/Sankey";
import { ForecastChart } from "@/components/charts/ForecastChart";
import { MoneyFlowBars } from "@/components/theta/bits";
import { ThetaEmpty } from "@/components/theta/ui";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { buildCashFlowSankey } from "@/lib/theta/sankey";
import { forecastCashFlow } from "@/lib/theta/forecast";
import type { Recurring } from "@/lib/theta/data";
import { ledgerHasData, useTheta } from "@/lib/theta/store";
import { fmtPct, fmtUSD } from "@/lib/format";
import { PageSkeleton } from "@/components/ui/Skeleton";

export default function CashFlowPage() {
  const { ready, ledger, view } = useTheta();

  const sankey = useMemo(
    () => (ledger ? buildCashFlowSankey(ledger) : null),
    [ledger]
  );

  const flows = view?.cashFlow ?? [];
  const months = flows.length || 1;
  const avgIncome = flows.reduce((s, m) => s + m.income, 0) / months;
  const avgExpense = flows.reduce((s, m) => s + m.expenses, 0) / months;
  const avgNet = avgIncome - avgExpense;
  const avgRate = avgIncome > 0 ? avgNet / avgIncome : 0;

  // 60-day liquid-balance forecast (§97/§50). Recurring bills are charged
  // discretely by the engine, so the smooth discretionary drift subtracts their
  // monthly-equivalent from average spend to avoid double-counting.
  const forecast = useMemo(() => {
    if (!ledger) return null;
    const liquid = ledger.accounts
      .filter((a) => a.kind === "checking" || a.kind === "savings")
      .reduce((s, a) => s + Math.max(0, a.balance), 0);
    const recurringMonthly = ledger.recurring.reduce(
      (s, r) => s + monthlyEquivalent(r),
      0
    );
    return forecastCashFlow({
      liquid,
      recurring: ledger.recurring,
      discretionaryMonthly: Math.max(0, avgExpense - recurringMonthly),
      monthlyIncome: avgIncome,
      days: 60,
    });
  }, [ledger, avgExpense, avgIncome]);

  if (!ready) return <PageSkeleton />;
  if (!ledger || !view || !ledgerHasData(ledger)) return <ThetaEmpty page="Cash flow" />;

  return (
    <div>
      <PageHeader
        eyebrow="Money"
        title="Cash Flow"
        description="What comes in versus what goes out, month by month."
      />

      {forecast && (
        <Card className="mb-5 px-5 py-6 sm:px-7" i={0}>
          <CardHeader
            eyebrow="Next 60 days · projected"
            title="Where the balance is headed"
            className="mb-1"
          />
          <p className="mb-5 max-w-prose text-pretty text-[13px] leading-relaxed text-mute">
            {forecast.lowBalanceDate ? (
              <>
                At the current pace your liquid balance dips to{" "}
                <span className="font-mono tnum text-warn">
                  {fmtUSD(forecast.minBalance, true)}
                </span>{" "}
                on{" "}
                <span className="text-ink">{fmtLongDate(forecast.minDate)}</span>
                {forecast.runwayDays !== null && (
                  <> — roughly {forecast.runwayDays} days of runway from today</>
                )}
                . Watch that date.
              </>
            ) : (
              <>
                Lowest projected point is{" "}
                <span className="font-mono tnum text-ink">
                  {fmtUSD(forecast.minBalance, true)}
                </span>{" "}
                on{" "}
                <span className="text-ink">{fmtLongDate(forecast.minDate)}</span>
                {forecast.netChange >= 0 ? (
                  <>
                    , then it recovers — the next two months add{" "}
                    <span className="font-mono tnum text-pos">
                      {fmtUSD(forecast.netChange, true)}
                    </span>{" "}
                    on balance.
                  </>
                ) : (
                  <>, and it stays above water the whole window.</>
                )}
              </>
            )}
          </p>
          <ForecastChart forecast={forecast} height={220} />
          <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
            A day-by-day projection of checking + savings: a smooth income-minus-
            spending drift with your recurring bills dropped on their due dates.
            A model, not a guarantee.
          </p>
        </Card>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="px-5 py-4" i={1} hover={false}>
          <Stat label="Avg income" value={avgIncome} format={(v) => fmtUSD(v, true)} size="sm" toneClass="text-pos" />
        </Card>
        <Card className="px-5 py-4" i={1} hover={false}>
          <Stat label="Avg spending" value={avgExpense} format={(v) => fmtUSD(v, true)} size="sm" toneClass="text-vio" />
        </Card>
        <Card className="px-5 py-4" i={2} hover={false}>
          <Stat label="Avg net" value={avgNet} format={(v) => `${v >= 0 ? "+" : "−"}${fmtUSD(Math.abs(v), true)}`} size="sm" />
        </Card>
        <Card className="px-5 py-4" i={3} hover={false}>
          <Stat label="Avg savings rate" value={avgRate} format={(v) => fmtPct(v, 0)} size="sm" />
        </Card>
      </div>

      {sankey && (
        <Card className="mb-5 px-5 py-6 sm:px-7" i={5}>
          <CardHeader
            eyebrow={`${sankey.monthLabel} · where the money goes`}
            title="Income → spending"
            className="mb-2"
          />
          <Sankey
            columns={sankey.columns}
            links={sankey.links}
            total={sankey.total}
            height={Math.max(300, sankey.columns[2].length * 46 + 60)}
          />
          <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
            {sankey.monthLabel}&rsquo;s income on the left, flowing into each
            spending category and what&rsquo;s left over on the right.
            {sankey.net < 0 && " Spending outran income — the shortfall is drawn from savings."}
          </p>
        </Card>
      )}

      <Card className="mb-5 px-5 py-6" i={6}>
        <CardHeader eyebrow={`Trailing ${months} months`} title="Income vs. spending" className="mb-6" />
        <MoneyFlowBars data={flows} height={220} />
      </Card>

      <Card className="overflow-hidden" i={7}>
        <CardHeader eyebrow="Detail" title="Monthly breakdown" className="px-6 pt-5 mb-1" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="border-b border-edge text-left text-[11.5px] uppercase tracking-[0.04em] text-faint">
                <th className="px-6 py-3 font-medium">Month</th>
                <th className="px-6 py-3 text-right font-medium">Income</th>
                <th className="px-6 py-3 text-right font-medium">Spending</th>
                <th className="px-6 py-3 text-right font-medium">Net</th>
                <th className="px-6 py-3 text-right font-medium">Saved</th>
              </tr>
            </thead>
            <tbody>
              {[...flows].reverse().map((m, idx) => {
                const net = m.income - m.expenses;
                const rate = m.income > 0 ? net / m.income : 0;
                return (
                  <tr key={`${m.month}-${idx}`} className="border-b border-edge/60 last:border-0 hover:bg-white/[0.03]">
                    <td className="px-6 py-3 text-ink">{m.month}</td>
                    <td className="px-6 py-3 text-right font-mono tnum text-pos">{fmtUSD(m.income, true)}</td>
                    <td className="px-6 py-3 text-right font-mono tnum text-mute">{fmtUSD(m.expenses, true)}</td>
                    <td className="px-6 py-3 text-right font-mono tnum text-ink">{net >= 0 ? "+" : "−"}{fmtUSD(Math.abs(net), true)}</td>
                    <td className="px-6 py-3 text-right font-mono tnum text-faint">{fmtPct(rate, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/** A recurring charge's monthly-equivalent outflow, for de-duping it out of the
 *  smooth discretionary drift (the forecast engine charges it discretely). */
function monthlyEquivalent(r: Recurring): number {
  const amt = Math.abs(r.amount);
  if (r.cadence === "weekly") return amt * (52 / 12);
  if (r.cadence === "yearly") return amt / 12;
  return amt;
}

function fmtLongDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}
