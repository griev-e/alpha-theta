"use client";

import { m } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiThinking } from "@/components/ui/AiThinking";
import { Card, CardHeader } from "@/components/ui/Card";
import { Ring } from "@/components/ui/Ring";
import { Meter } from "@/components/ui/Meter";
import { ThetaEmpty } from "@/components/theta/ui";
import { ledgerHasData, useTheta } from "@/lib/theta/store";
import { useThetaAssumptions } from "@/lib/theta/assumptionsStore";
import { healthInputsFromLedger } from "@/lib/theta/healthInputs";
import { scoreHealth, type HealthMetric, type HealthReport } from "@/lib/theta/health";
import { analyzeSpending } from "@/lib/theta/spending";
import { detectRecurring, newSubscriptions } from "@/lib/theta/detect";
import type { ThetaReview } from "@/lib/theta/intelligence";
import type { ThetaView } from "@/lib/theta/compute";
import type { Ledger } from "@/lib/theta/data";
import { fmtPct } from "@/lib/format";
import { PageSkeleton } from "@/components/ui/Skeleton";

const GRADE_COLOR: Record<string, string> = {
  A: "var(--color-pos)",
  B: "var(--color-mint)",
  C: "var(--color-warn)",
  D: "var(--color-warn)",
  F: "var(--color-neg)",
};

export default function HealthPage() {
  const { ready, ledger, view } = useTheta();
  const { assumptions } = useThetaAssumptions();

  const report = useMemo(() => {
    if (!ledger || !view) return null;
    return scoreHealth(healthInputsFromLedger(ledger, view, assumptions));
  }, [ledger, view, assumptions]);

  if (!ready) return <PageSkeleton />;
  if (!ledger || !ledgerHasData(ledger) || !report) return <ThetaEmpty page="Financial health" />;

  const color = GRADE_COLOR[report.grade] ?? "var(--color-mint)";

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Financial Health"
        description="A weighted scorecard of the ratios a planner actually watches — each graded against a published reference band, not a made-up threshold."
      />

      <div className="mb-5 grid gap-5 lg:grid-cols-[280px_1fr]">
        <Card className="flex flex-col items-center justify-center px-5 py-8" i={0} hover={false}>
          <Ring score={report.composite} size={150} stroke={10} color={color}>
            <span className="font-mono text-[34px] font-medium text-ink">{report.composite}</span>
            <span className="text-[11px] text-faint">/ 100</span>
          </Ring>
          <div className="mt-4 text-center">
            <div className="font-display text-[22px] font-semibold" style={{ color }}>
              {report.grade}
            </div>
            <div className="mt-1 text-[11.5px] text-faint">
              {Math.round(report.coverage * 100)}% metric coverage
            </div>
          </div>
        </Card>

        <Card className="px-5 py-5" i={1} hover={false}>
          <CardHeader eyebrow="What's dragging" title="Attention" className="mb-4" />
          {report.flags.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {report.flags.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] text-mute">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-pos">Every scored metric is in healthy territory. Keep it up.</p>
          )}
        </Card>
      </div>

      <Card className="px-5 py-5" i={2}>
        <CardHeader eyebrow="Breakdown" title="Metrics" className="mb-4" />
        <div className="flex flex-col divide-y divide-edge/60">
          {report.metrics.map((m) => (
            <MetricRow key={m.key} m={m} />
          ))}
        </div>
      </Card>

      <ReviewSection ledger={ledger} view={view!} report={report} assumptions={assumptions} />

      <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
        A model, not advice. Each metric scores 0–100 by interpolating between a &ldquo;poor&rdquo; and
        &ldquo;good&rdquo; reference; the composite is the coverage-weighted mean of the metrics that have
        data. Credit utilization needs a credit limit set on the account to score.
      </p>
    </div>
  );
}

type ReviewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; review: ThetaReview; cached: boolean }
  | { kind: "offline" }
  | { kind: "error"; message: string };

const IMPACT_COLOR: Record<string, string> = {
  high: "var(--color-neg)",
  medium: "var(--color-warn)",
  low: "var(--color-mint)",
};

/** Claude reasoning pass over the health score + spending anomalies + detected
 *  subscriptions — the Sonnet review endpoint, distinct from the monthly brief. */
function ReviewSection({
  ledger,
  view,
  report,
  assumptions,
}: {
  ledger: Ledger;
  view: ThetaView;
  report: HealthReport;
  assumptions: ReturnType<typeof useThetaAssumptions>["assumptions"];
}) {
  const [state, setState] = useState<ReviewState>({ kind: "idle" });

  const body = useMemo(() => {
    const anomalies = analyzeSpending(ledger.transactions).anomalies.map((a) => ({ category: a.category, note: a.note }));
    const detected = newSubscriptions(detectRecurring(ledger.transactions), ledger.recurring).map((d) => ({
      merchant: d.merchant,
      amount: d.amount,
      annualCost: d.annualCost,
    }));
    return {
      snapshot: {
        month: view.currentMonthLabel,
        netWorth: Math.round(view.netWorth),
        netWorthDeltaPct: +(view.netWorthDeltaPct * 100).toFixed(2),
        income: Math.round(view.monthIncome),
        expenses: Math.round(view.monthExpenses),
        savingsRate: +(view.savingsRate * 100).toFixed(1),
        monthlyRecurring: Math.round(view.monthlyRecurring),
        topCategories: view.spending.slice(0, 8).map((s) => ({ category: s.category, amount: Math.round(s.amount) })),
        budgets: view.budgets.map((b) => ({ category: b.category, limit: b.limit, spent: Math.round(b.spent) })),
        goals: ledger.goals.map((g) => ({ name: g.name, saved: Math.round(g.saved), target: g.target, monthly: g.monthly })),
        upcomingRecurring: [],
      },
      health: { composite: report.composite, grade: report.grade, flags: report.flags },
      anomalies,
      newSubscriptions: detected,
    };
    // assumptions isn't sent (server has no need for it) but changing it can shift
    // health inputs upstream, so it's a dependency of the memo.
  }, [ledger, view, report, assumptions]);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/theta/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 501) return setState({ kind: "offline" });
      if (!res.ok) {
        return setState({
          kind: "error",
          message: res.status === 429 ? "Rate limited — try again shortly." : "The review is unavailable right now.",
        });
      }
      const data = await res.json();
      setState({ kind: "ready", review: data.review, cached: !!data.cached });
    } catch {
      setState({ kind: "error", message: "Couldn't reach the review service." });
    }
  }, [body]);

  return (
    <Card className="mt-5 px-5 py-5" i={3}>
      <CardHeader
        eyebrow="AI"
        title="Claude's review"
        className="mb-3"
        right={
          <button onClick={load} disabled={state.kind === "loading"} className="btn-secondary">
            {state.kind === "loading" ? "Thinking…" : state.kind === "ready" ? "Regenerate" : "Get review"}
          </button>
        }
      />
      {state.kind === "idle" && (
        <p className="text-[13px] leading-relaxed text-mute">
          Have Claude weigh your health score, spending anomalies and detected subscriptions against each
          other and rank what to do first. Reasoned with Sonnet 4.6; your score above is computed locally.
        </p>
      )}
      {state.kind === "loading" && (
        <AiThinking
          label="Reasoning across your finances"
          messages={[
            "Reading your score",
            "Weighing the anomalies",
            "Ranking priorities",
            "Writing the review",
          ]}
        />
      )}
      {state.kind === "offline" && (
        <p className="text-[13px] leading-relaxed text-mute">
          Set <span className="font-mono text-[12px] text-faint">ANTHROPIC_API_KEY</span> to enable the AI
          review. The scorecard above works without it.
        </p>
      )}
      {state.kind === "error" && (
        <div className="text-[13px] text-mute">
          {state.message}{" "}
          <button onClick={load} className="ml-1 text-vio/80 hover:text-vio">
            Try again
          </button>
        </div>
      )}
      {state.kind === "ready" && (
        <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <p className="mb-4 text-[14px] leading-relaxed text-mute">{state.review.assessment}</p>
          <div className="flex flex-col gap-2.5">
            {state.review.priorities.map((p, i) => (
              <div key={i} className="rounded-lg border border-edge bg-white/[0.02] p-3.5">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize"
                    style={{ color: IMPACT_COLOR[p.impact], background: `color-mix(in srgb, ${IMPACT_COLOR[p.impact]} 14%, transparent)` }}
                  >
                    {p.impact}
                  </span>
                  <span className="text-[13px] font-medium text-ink">{p.title}</span>
                </div>
                <p className="text-[12.5px] leading-relaxed text-mute">{p.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] italic text-faint">{state.review.subscriptionNote}</p>
          <p className="mt-2 font-mono text-[11px] text-faint">
            Reasoned by Claude Sonnet 4.6{state.cached ? " · cached" : ""} · general information, not advice.
          </p>
        </m.div>
      )}
    </Card>
  );
}

function fmtMetric(m: HealthMetric): string {
  if (m.value === null) return "—";
  if (m.format === "months") return `${m.value.toFixed(1)} mo`;
  if (m.format === "pct") return fmtPct(m.value, 0);
  return m.value.toFixed(2);
}

function MetricRow({ m }: { m: HealthMetric }) {
  const score = m.score;
  const color =
    score === null ? "var(--color-faint)" : score >= 70 ? "var(--color-pos)" : score >= 45 ? "var(--color-warn)" : "var(--color-neg)";
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="mb-1.5 flex items-center justify-between">
        <div>
          <span className="text-[13px] text-ink">{m.label}</span>
          <span className="ml-2 font-mono tnum text-[12px] text-faint">{fmtMetric(m)}</span>
        </div>
        <span className="font-mono tnum text-[13px]" style={{ color }}>
          {score === null ? "no data" : score}
        </span>
      </div>
      {score !== null && <Meter value={score} max={100} color={color} height={6} />}
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">{m.description}</p>
    </div>
  );
}
