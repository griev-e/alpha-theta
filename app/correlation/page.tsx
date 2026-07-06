"use client";

import { useMemo, useState } from "react";
import { Heatmap } from "@/components/charts/Heatmap";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { Stat } from "@/components/ui/Stat";
import { correlationMatrix, seriate } from "@/lib/analytics/correlation";
import { riskReport } from "@/lib/analytics/risk";
import { liveBenchmarkProfiles } from "@/lib/live/cma";
import { useAssumptions } from "@/lib/assumptions/store";
import { fmtNum } from "@/lib/format";
import { usePortfolio } from "@/lib/store";
import { ChartGridSkeleton } from "@/components/ui/Skeleton";

export default function CorrelationPage() {
  const { ready, portfolio } = usePortfolio();
  const { version } = useAssumptions();
  // Clustered by default — the whole point of seriation is that structure
  // (a mega-cap tech cluster, a diversifying pocket) should be the first
  // thing the matrix shows, not something the reader has to find in book
  // order. Book order stays one click away for "where's my ticker."
  const [order, setOrder] = useState<"clustered" | "book">("clustered");

  const data = useMemo(() => {
    if (!portfolio) return null;
    return {
      corr: correlationMatrix(portfolio),
      risk: riskReport(portfolio, liveBenchmarkProfiles().spx.sectorWeights),
    };
    // version: recompute on assumption edits (read via the analytics singleton).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio, version]);

  if (!ready) return <ChartGridSkeleton />;
  if (!portfolio || !data)
    return <EmptyState page="The correlation matrix" preview="heatmap" />;

  const { corr, risk } = data;
  const shown = order === "clustered" ? seriate(corr) : corr;

  const wAvgRho = corr.weightedAvgCorrelation;
  const verdict =
    wAvgRho > 0.55
      ? "These holdings largely move as one trade. In a drawdown, expect them to fall together."
      : wAvgRho > 0.38
        ? "Moderate co-movement — typical for a growth-tilted equity book."
        : "Genuinely differentiated holdings. The pieces can offset each other.";

  return (
    <div>
      <PageHeader
        eyebrow="Analysis"
        title="Correlation Matrix"
        description="Estimated co-movement between holdings from a market-factor model with sector and industry affinity. Hover any cell for the pair."
      />

      <Card className="mb-5 px-6 py-5" i={0}>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <Stat
            label="Avg pairwise ρ"
            value={wAvgRho}
            format={(v) => fmtNum(v, 2)}
            sub="risk-weighted"
            toneClass={
              wAvgRho > 0.55
                ? "text-warn"
                : wAvgRho > 0.38
                  ? "text-ink"
                  : "text-mint"
            }
            tip="The average correlation (ρ) between every pair of holdings, weighted by position size. Correlation runs from −1 to +1: near +1 the names move almost in lockstep, near 0 they move independently. A lower average means the book is genuinely diversified rather than many bets on the same thing."
          />
          <Stat
            label="Diversification ratio"
            value={risk.diversificationRatio}
            format={(v) => fmtNum(v, 2)}
            sub="risk canceled by mixing"
            tip="The weighted-average volatility of the individual holdings divided by the portfolio's actual volatility. Above 1 means combining the names cancels out some risk; the higher it is, the more diversification benefit you're capturing versus holding the positions in isolation."
          />
          {corr.highest && (
            <div>
              <div className="eyebrow">Most coupled</div>
              <div className="mt-1 font-mono text-[15px] text-ink">
                {corr.highest.a} × {corr.highest.b}
              </div>
              <div className="font-mono text-[12px] text-warn">
                ρ {corr.highest.rho.toFixed(2)}
              </div>
            </div>
          )}
          {corr.lowest && (
            <div>
              <div className="eyebrow">Best diversifier pair</div>
              <div className="mt-1 font-mono text-[15px] text-ink">
                {corr.lowest.a} × {corr.lowest.b}
              </div>
              <div className="font-mono text-[12px] text-mint">
                ρ {corr.lowest.rho.toFixed(2)}
              </div>
            </div>
          )}
        </div>
        <p className="mt-4 border-t border-edge pt-3 text-[12.5px] text-mute">
          {verdict}
        </p>
      </Card>

      <Card className="px-6 py-6" i={1}>
        <CardHeader
          eyebrow="Pairwise estimates"
          title="Which holdings move together"
          right={
            <Segmented
              value={order}
              onChange={setOrder}
              options={[
                { value: "clustered", label: "Clustered" },
                { value: "book", label: "Book order" },
              ]}
            />
          }
          className="mb-5"
        />
        <p className="mb-4 -mt-2 text-[11.5px] leading-relaxed text-faint">
          {order === "clustered"
            ? "Ordered by similarity — correlated names are grouped into adjacent blocks so the book's structure emerges visually."
            : "Ordered as imported."}
        </p>
        <ErrorBoundary label="The correlation matrix">
          <Heatmap key={order} symbols={shown.symbols} matrix={shown.matrix} />
        </ErrorBoundary>
      </Card>
    </div>
  );
}
