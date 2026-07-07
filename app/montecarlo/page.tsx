"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

// The fan + histogram only render once the worker sim resolves (ResultsView is
// gated on `result`), so their SVG/animation code is loaded on demand rather
// than in the route's initial JS.
const FanChart = dynamic(
  () => import("@/components/charts/FanChart").then((m) => m.FanChart),
  { ssr: false }
);
const Histogram = dynamic(
  () => import("@/components/charts/Histogram").then((m) => m.Histogram),
  { ssr: false }
);
import { Card, CardHeader } from "@/components/ui/Card";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { PageHeader } from "@/components/ui/PageHeader";
import { ModelBadge } from "@/components/ui/ModelBadge";
import { Stat } from "@/components/ui/Stat";
import { Computing } from "@/components/ui/Computing";
import type { MonteCarloInputs, MonteCarloResult } from "@/lib/analytics/montecarlo";
import { useMonteCarlo } from "@/lib/analytics/useMonteCarlo";
import { riskReport } from "@/lib/analytics/risk";
import { liveBenchmarkProfiles } from "@/lib/live/cma";
import { useAssumptions } from "@/lib/assumptions/store";
import { fmtPct, fmtUSD, fmtUSDCompact } from "@/lib/format";
import { usePortfolio } from "@/lib/store";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { SplitSkeleton } from "@/components/ui/Skeleton";

export default function MonteCarloPage() {
  const { ready, portfolio } = usePortfolio();
  const { version } = useAssumptions();
  const [years, setYears] = useState(10);
  const [contribution, setContribution] = useState(500);
  const [targetMultiple, setTargetMultiple] = useState(4);
  // Bumped by the "refresh simulation" control to redraw a fresh set of paths.
  const [seedSalt, setSeedSalt] = useState(0);

  // Debounce the slider-driven values so a drag fires one 3,000-path sim on the
  // settled value rather than dozens of full re-runs across the worker.
  const dYears = useDebouncedValue(years, 140);
  const dContribution = useDebouncedValue(contribution, 140);
  const dTargetMultiple = useDebouncedValue(targetMultiple, 140);

  const risk = useMemo(
    () =>
      portfolio
        ? riskReport(portfolio, liveBenchmarkProfiles().spx.sectorWeights)
        : null,
    // version: recompute on assumption edits (read via the analytics singleton).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [portfolio, version]
  );

  // Round to a clean figure, but never to $0 for small portfolios. Driven by
  // the debounced multiple so the simulated/displayed target matches the sim.
  const rawTarget = (portfolio?.totalValue ?? 0) * dTargetMultiple;
  const target =
    rawTarget >= 5000
      ? Math.round(rawTarget / 1000) * 1000
      : Math.max(100, Math.round(rawTarget / 100) * 100);

  const mcInputs = useMemo<MonteCarloInputs | null>(() => {
    if (!portfolio || !risk) return null;
    return {
      initialValue: portfolio.totalValue,
      mu: risk.expectedReturn,
      sigma: risk.volatility,
      years: dYears,
      monthlyContribution: dContribution,
      targetValue: target,
      paths: 3000,
      seedSalt,
      // The mean return is estimated, not known: treat the CAPM drift as if
      // inferred from ~10 years of data (SE ≈ σ/√10) so the fan reflects that
      // uncertainty instead of pretending μ is exact.
      muStdErr: risk.volatility / Math.sqrt(10),
      // Student-t shocks (ν≈5) so drawdowns carry the fat left tail real equity
      // returns have, rather than GBM's too-thin Gaussian tail.
      shockDof: 5,
    };
  }, [portfolio, risk, dYears, dContribution, target, seedSalt]);

  const { result, pending } = useMonteCarlo(mcInputs);

  if (!ready) return <SplitSkeleton />;
  if (!portfolio || !risk)
    return <EmptyState page="Monte Carlo simulation" preview="fan" />;

  const prob = result?.probTargetAtHorizon ?? 0;

  // Sentence-first verdict for the hero — the plain-language outcome the fan
  // then proves. Only meaningful once a result exists.
  const horizonYear = new Date().getFullYear() + dYears;

  return (
    <div>
      <PageHeader
        eyebrow="Simulation"
        title="Monte Carlo"
        description={`3,000 simulated futures · drift ${fmtPct(risk.expectedReturn, 1)} (CAPM, treated as uncertain) · volatility ${fmtPct(risk.volatility, 1)} with fat tails, from your actual book. Deterministic per portfolio — not a random slot machine.`}
      />

      {/* Hero band: the cone of outcomes is the page's subject; the controls
          that reshape it sit in a rail beside it, not in the top-anchor. */}
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Card className="min-w-0 px-6 py-5" i={0}>
          {/* Verdict + the glanceable probability, above the fan */}
          <div className="mb-4 flex items-start justify-between gap-5">
            <p className="max-w-xl text-balance text-[17px] font-medium leading-snug tracking-[-0.01em] text-ink">
              {result ? (
                <>
                  In {horizonYear}, the median path reaches{" "}
                  <span className="font-mono tnum">{fmtUSDCompact(result.median)}</span>{" "}
                  — a {Math.round(prob * 100)}% chance of clearing your{" "}
                  {targetMultiple}× target of{" "}
                  <span className="font-mono tnum text-warn">
                    {fmtUSDCompact(target)}
                  </span>
                  .
                </>
              ) : (
                <span className="text-mute">Simulating your book across {dYears} years…</span>
              )}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <div className="text-right">
                <div className="font-mono tnum text-[34px] font-medium leading-none text-ink">
                  {result ? `${Math.round(prob * 100)}%` : "—"}
                </div>
                <div className="eyebrow mt-1">chance of target</div>
              </div>
              <ModelBadge detail="Simulated from a CAPM drift (drawn per path, not treated as known) and fat-tailed shocks. Read to the nearest few points." />
            </div>
          </div>
          <div className="relative">
            <Computing active={pending || !result} label="simulating 3,000 paths…" />
            {!result ? (
              <div className="h-[380px]" />
            ) : (
              <ErrorBoundary label="The projection">
                <FanChart result={result} target={target} height={380} />
              </ErrorBoundary>
            )}
          </div>
        </Card>

        {/* Controls rail — adjusting an assumption reshapes the cone beside it. */}
        <Card className="h-fit px-5 py-5 xl:sticky xl:top-16" i={1} hover={false}>
          <div className="mb-5 flex items-center justify-between">
            <div className="eyebrow">Assumptions</div>
            <button
              onClick={() => setSeedSalt((s) => s + 1)}
              className="flex items-center gap-1.5 rounded-md border border-edge px-2.5 py-1 font-mono text-[11px] text-mute transition-colors hover:border-edge2 hover:text-ink"
              title="Redraw a fresh set of 3,000 paths"
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
                max={30}
                step={1}
                value={years}
                onChange={setYears}
                format={(v) => `${v} years`}
              />
            </div>
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="eyebrow">Monthly contribution</span>
                <span className="font-mono tnum text-[15px] text-ink">
                  {fmtUSD(contribution, true)}
                </span>
              </div>
              <RangeSlider
                min={0}
                max={5000}
                step={50}
                value={contribution}
                onChange={setContribution}
                format={(v) => fmtUSD(v, true)}
              />
            </div>
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="eyebrow">Target</span>
                <span className="font-mono tnum text-[15px] text-warn">
                  {fmtUSDCompact(target)}
                  <span className="ml-1.5 text-[11px] text-faint">
                    {targetMultiple}× today
                  </span>
                </span>
              </div>
              <RangeSlider
                min={1.5}
                max={100}
                step={0.5}
                value={targetMultiple}
                onChange={setTargetMultiple}
                format={(v) => `${v}× today`}
              />
            </div>
          </div>
        </Card>
      </div>

      {result && (
        <ErrorBoundary label="The projection detail">
          <ResultsDetail result={result} target={target} years={dYears} />
        </ErrorBoundary>
      )}
    </div>
  );
}

/** The secondary band below the hero: the numeric outcomes and the terminal
 *  distribution — the detail you study after the cone tells the story. */
function ResultsDetail({
  result,
  target,
  years,
}: {
  result: MonteCarloResult;
  target: number;
  years: number;
}) {
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <Card className="px-6 py-5" i={2}>
        <div className="eyebrow mb-4">Outcomes at {years}y</div>
        <div className="space-y-4">
          <Stat
            label="Median"
            value={result.median}
            format={fmtUSDCompact}
            sub={`${fmtPct(result.medianCagr, 1)} CAGR on money in`}
          />
          <div className="grid grid-cols-2 gap-4">
            <Stat
              label="Pessimistic p5"
              value={result.p5}
              format={fmtUSDCompact}
              size="sm"
              toneClass="text-neg"
            />
            <Stat
              label="Optimistic p95"
              value={result.p95}
              format={fmtUSDCompact}
              size="sm"
              toneClass="text-mint"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Stat
              label="Tail average (CVaR 95)"
              value={result.cvar95}
              format={fmtUSDCompact}
              size="sm"
              toneClass="text-neg"
              tip="The average ending value across the worst 5% of simulated paths. Where the p5 line says '5% of outcomes end below here', this says how bad those outcomes are on average — the standard expected-shortfall view of tail risk."
            />
            <Stat
              label="Max drawdown (median)"
              value={result.maxDrawdown.median}
              format={(v) => `−${fmtPct(v, 0)}`}
              size="sm"
              toneClass="text-warn"
              tip={`The typical worst peak-to-trough fall a path experiences somewhere along the way — the median path drops ${fmtPct(result.maxDrawdown.median, 0)} from a running high at some point, and 1 in 10 paths drops ${fmtPct(result.maxDrawdown.p90, 0)} or more. Reaching the target usually means sitting through a fall like this without selling.`}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Stat
              label="Touched target ever"
              value={result.probTargetEver}
              format={(v) => fmtPct(v, 0)}
              size="sm"
            />
            <Stat
              label="Total contributed"
              value={result.totalContributed}
              format={fmtUSDCompact}
              size="sm"
            />
          </div>
        </div>
      </Card>

      <Card className="px-6 py-5" i={3}>
        <CardHeader
          eyebrow="Terminal distribution"
          title={`Spread of outcomes at year ${years}`}
          right={
            <span className="font-mono text-[10px] text-faint">
              mint = above target
            </span>
          }
          className="mb-4"
        />
        <Histogram bins={result.histogram} target={target} height={150} />
        <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
          Geometric Brownian motion, monthly steps, contributions added end of
          month. Drift uses CAPM on your portfolio beta but is drawn per path
          (SE ≈ σ/√10) rather than treated as known, and shocks are Student-t
          (ν=5) so the tails aren&rsquo;t artificially thin. Volatility comes
          from the estimated covariance of your actual holdings. The target
          probability is a modeled estimate, not a forecast — read it to the
          nearest few points, not the decimal.
        </p>
      </Card>
    </div>
  );
}
