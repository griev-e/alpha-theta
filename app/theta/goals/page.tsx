"use client";

import { useMemo, useState } from "react";
import { AddGoalModal, ContributeModal } from "@/components/theta/modals";
import { ActionButton, ThetaEmpty, IconButton, PlusIcon, TrashIcon } from "@/components/theta/ui";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Ring } from "@/components/ui/Ring";
import { Stat } from "@/components/ui/Stat";
import { type Goal } from "@/lib/theta/data";
import { ledgerHasData, useTheta } from "@/lib/theta/store";
import { useThetaAssumptions } from "@/lib/theta/assumptionsStore";
import { assessGoal, type GoalFeasibility, type GoalStatus } from "@/lib/theta/goals";
import { fmtPct, fmtUSD, fmtUSDCompact } from "@/lib/format";
import { PageSkeleton } from "@/components/ui/Skeleton";

const STATUS_META: Record<GoalStatus, { label: string; color: string }> = {
  funded: { label: "Funded", color: "var(--color-pos)" },
  "on-track": { label: "On track", color: "var(--color-mint)" },
  behind: { label: "Behind", color: "var(--color-warn)" },
  "at-risk": { label: "At risk", color: "var(--color-neg)" },
  "no-contribution": { label: "Not funding", color: "var(--color-faint)" },
};

export default function GoalsPage() {
  const { ready, ledger, removeGoal } = useTheta();
  const { assumptions } = useThetaAssumptions();
  const [adding, setAdding] = useState(false);
  const [contributing, setContributing] = useState<Goal | null>(null);

  const feas = useMemo(
    () => (ledger?.goals ?? []).map((g) => assessGoal(g, assumptions)),
    [ledger, assumptions]
  );

  if (!ready) return <PageSkeleton />;
  if (!ledger || !ledgerHasData(ledger)) return <ThetaEmpty page="Goals" />;

  const goals = ledger.goals;
  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const totalMonthly = goals.reduce((s, g) => s + g.monthly, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Planning"
        title="Goals"
        description="Money set aside with a purpose — with a feasibility read on each: the pace you need, the date it projects to, and the odds of getting there."
        right={
          <ActionButton onClick={() => setAdding(true)}>
            <PlusIcon /> New goal
          </ActionButton>
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Card className="px-5 py-4" i={0} hover={false}>
          <Stat label="Saved" value={totalSaved} format={fmtUSDCompact} size="sm" />
        </Card>
        <Card className="px-5 py-4" i={1} hover={false}>
          <Stat label="Target" value={totalTarget} format={fmtUSDCompact} size="sm" />
        </Card>
        <Card className="px-5 py-4" i={2} hover={false}>
          <Stat label="Contributing" value={totalMonthly} format={(v) => `${fmtUSD(v, true)}/mo`} size="sm" toneClass="text-pos" />
        </Card>
      </div>

      {goals.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {goals.map((g, i) => (
            <GoalCard
              key={g.id}
              g={g}
              f={feas[i]}
              i={i}
              onContribute={() => setContributing(g)}
              onRemove={() => removeGoal(g.id)}
            />
          ))}
        </div>
      ) : (
        <Card className="px-5 py-12 text-center" i={0}>
          <p className="text-[13px] text-faint">No goals yet — create one to start saving toward it.</p>
        </Card>
      )}

      <AddGoalModal open={adding} onClose={() => setAdding(false)} />
      <ContributeModal goal={contributing} onClose={() => setContributing(null)} />
    </div>
  );
}

function GoalCard({
  g,
  f,
  i,
  onContribute,
  onRemove,
}: {
  g: Goal;
  f: GoalFeasibility;
  i: number;
  onContribute: () => void;
  onRemove: () => void;
}) {
  const pct = g.target > 0 ? g.saved / g.target : 0;
  const targetLabel = new Date(`${g.targetDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const status = STATUS_META[f.status];

  return (
    <Card className="group px-5 py-5" i={i + 1}>
      <CardHeader
        eyebrow={`Target ${targetLabel}`}
        title={g.name}
        right={
          <span className="opacity-0 transition-opacity group-hover:opacity-100">
            <IconButton label="Remove goal" danger onClick={onRemove}>
              <TrashIcon />
            </IconButton>
          </span>
        }
        className="mb-4"
      />
      <div className="flex items-center gap-5">
        <Ring score={pct * 100} size={120} stroke={8} color={g.accent}>
          <span className="font-mono text-[19px] font-medium text-ink">{fmtPct(pct, 0)}</span>
          <span className="text-[10px] text-faint">funded</span>
        </Ring>
        <div className="flex-1">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: status.color, background: `color-mix(in srgb, ${status.color} 12%, transparent)` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
            {status.label}
            {f.successProb !== null && f.status !== "funded" && (
              <span className="text-faint">· {fmtPct(f.successProb, 0)} odds</span>
            )}
          </div>
          <div className="font-mono tnum text-[20px] font-medium text-ink">{fmtUSD(g.saved, true)}</div>
          <div className="font-mono text-[12px] text-faint">of {fmtUSD(g.target, true)}</div>
          <div className="mt-3 flex flex-col gap-1.5 text-[12px]">
            <Row label="Remaining" value={fmtUSD(f.remaining, true)} />
            <Row
              label="Projected"
              value={f.projectedDate ? fmtMonth(f.projectedDate) : "—"}
              tone={f.monthsUntilTarget !== null && f.projectedMonths !== null && f.projectedMonths > f.monthsUntilTarget ? "neg" : undefined}
            />
            {f.requiredMonthly !== null && (
              <Row
                label="Need / mo"
                value={`${fmtUSD(f.requiredMonthly, true)}`}
                tone={f.requiredMonthly > g.monthly * 1.02 ? "neg" : "pos"}
              />
            )}
          </div>
          <button
            onClick={onContribute}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-edge2 px-3 text-[12.5px] font-medium text-mute transition-colors hover:border-white/30 hover:text-ink"
          >
            <PlusIcon /> Add funds
          </button>
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  const cls = tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-ink";
  return (
    <div className="flex justify-between">
      <span className="text-mute">{label}</span>
      <span className={`font-mono tnum ${cls}`}>{value}</span>
    </div>
  );
}

function fmtMonth(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
