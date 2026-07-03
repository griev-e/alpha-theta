"use client";

import { CategoryTag } from "@/components/theta/bits";
import { AddRecurringButton } from "@/components/theta/modals";
import { ThetaEmpty, IconButton, TrashIcon } from "@/components/theta/ui";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { useMemo } from "react";
import { recurringPerMonth } from "@/lib/theta/compute";
import { detectRecurring, newSubscriptions, type DetectedRecurring } from "@/lib/theta/detect";
import { CATEGORY_COLOR } from "@/lib/theta/data";
import { ledgerHasData, useTheta } from "@/lib/theta/store";
import { fmtPct, fmtUSD } from "@/lib/format";

const CADENCE_LABEL = { monthly: "Monthly", yearly: "Yearly", weekly: "Weekly" } as const;

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function RecurringPage() {
  const { ready, ledger, view, markRecurringPaid, removeRecurring, addRecurring } = useTheta();

  const detected = useMemo(() => {
    if (!ledger) return [];
    return newSubscriptions(detectRecurring(ledger.transactions), ledger.recurring);
  }, [ledger]);

  if (!ready) return null;
  if (!ledger || !view || !ledgerHasData(ledger)) return <ThetaEmpty page="Recurring charges" />;

  const recurring = ledger.recurring;
  const sorted = [...recurring].sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime());
  const subs = recurring.filter((r) => r.category === "Subscriptions").length;

  return (
    <div>
      <PageHeader
        eyebrow="Planning"
        title="Recurring"
        description="Subscriptions and bills that hit on a schedule — your fixed monthly burn."
        right={<AddRecurringButton />}
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Card className="px-5 py-4" i={0} hover={false}>
          <Stat label="Per month" value={view.monthlyRecurring} format={(v) => fmtUSD(v, true)} size="sm" toneClass="text-vio" />
        </Card>
        <Card className="px-5 py-4" i={1} hover={false}>
          <Stat label="Per year" value={view.monthlyRecurring * 12} format={(v) => fmtUSD(v, true)} size="sm" />
        </Card>
        <Card className="px-5 py-4" i={2} hover={false}>
          <Stat label="Subscriptions" value={subs} format={(v) => String(Math.round(v))} size="sm" sub={`${recurring.length} recurring total`} />
        </Card>
      </div>

      <Card className="overflow-hidden" i={3}>
        <CardHeader eyebrow="Schedule" title="Upcoming charges" className="px-6 pt-5 mb-1" />
        {sorted.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-[13px]">
              <thead>
                <tr className="border-b border-edge text-left text-[11.5px] uppercase tracking-[0.04em] text-faint">
                  <th className="px-6 py-3 font-medium">Charge</th>
                  <th className="hidden px-6 py-3 font-medium sm:table-cell">Category</th>
                  <th className="px-6 py-3 text-right font-medium">Cadence</th>
                  <th className="px-6 py-3 text-right font-medium">Next</th>
                  <th className="px-6 py-3 text-right font-medium">Amount</th>
                  <th className="px-6 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} className="group border-b border-edge/60 last:border-0 hover:bg-white/[0.03]">
                    <td className="px-6 py-3 text-ink">
                      {r.name}
                      <span className="ml-2 font-mono text-[11px] text-faint">{fmtUSD(recurringPerMonth(r.amount, r.cadence))}/mo</span>
                    </td>
                    <td className="hidden px-6 py-3 sm:table-cell"><CategoryTag category={r.category} /></td>
                    <td className="px-6 py-3 text-right text-mute">{CADENCE_LABEL[r.cadence]}</td>
                    <td className="px-6 py-3 text-right font-mono tnum text-faint">{shortDate(r.nextDate)}</td>
                    <td className="px-6 py-3 text-right font-mono tnum text-ink">{fmtUSD(r.amount)}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => markRecurringPaid(r.id)}
                          className="rounded-md border border-edge2 px-2.5 py-1 text-[11.5px] text-mute transition-colors hover:border-white/30 hover:text-ink"
                        >
                          Mark paid
                        </button>
                        <span className="opacity-0 transition-opacity group-hover:opacity-100">
                          <IconButton label="Remove recurring" danger onClick={() => removeRecurring(r.id)}>
                            <TrashIcon />
                          </IconButton>
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-6 py-12 text-center text-[13px] text-faint">No recurring charges.</p>
        )}
      </Card>

      {detected.length > 0 && (
        <Card className="mt-5 px-5 py-5" i={4}>
          <CardHeader
            eyebrow="Auto-detected"
            title="Subscriptions you're not tracking"
            className="mb-1"
          />
          <p className="mb-4 text-[12.5px] leading-relaxed text-mute">
            Steady, repeating charges found in your transactions but not on the list above.
            Track one to fold it into your recurring burn.
          </p>
          <div className="flex flex-col divide-y divide-edge/60">
            {detected.map((d) => (
              <DetectedRow
                key={`${d.merchant}-${d.cadence}`}
                d={d}
                onTrack={() =>
                  addRecurring({
                    name: d.merchant,
                    category: d.category,
                    amount: d.amount,
                    cadence: d.cadence,
                    nextDate: d.nextDate,
                  })
                }
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function DetectedRow({ d, onTrack }: { d: DetectedRecurring; onTrack: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 text-[13px]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-ink">{d.merchant}</span>
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px]"
            style={{ color: CATEGORY_COLOR[d.category], background: `color-mix(in srgb, ${CATEGORY_COLOR[d.category]} 14%, transparent)` }}
          >
            {d.category}
          </span>
          {d.priceCreep && (
            <span className="shrink-0 rounded-full bg-warn/15 px-1.5 py-0.5 text-[10px] text-warn">
              ↑ {fmtPct(d.priceCreep.pctChange, 0)} ({fmtUSD(d.priceCreep.from)}→{fmtUSD(d.priceCreep.to)})
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11.5px] text-faint">
          {fmtUSD(d.amount)} · {d.cadence} · {d.count} charges · {fmtUSD(d.annualCost, true)}/yr
        </div>
      </div>
      <button
        onClick={onTrack}
        className="shrink-0 rounded-md border border-edge2 px-2.5 py-1 text-[11.5px] text-mute transition-colors hover:border-white/30 hover:text-ink"
      >
        Track
      </button>
    </div>
  );
}
