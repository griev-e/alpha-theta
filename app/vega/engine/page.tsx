"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { EngineDial } from "@/components/vega/EngineDial";
import { DriverStack, EngineLayers, ScoreRibbon } from "@/components/vega/EnginePanels";
import { SymbolForm } from "@/components/vega/SymbolForm";
import { ChangePct } from "@/components/vega/bits";
import { Money } from "@/components/ui/Money";
import { useAsyncCompute } from "@/lib/useAsyncCompute";
import { edgeEngine } from "@/lib/vega/engine";
import { useVega } from "@/lib/vega/store";
import { ENGINE_BENCHMARK as BENCH } from "@/lib/vega/types";
import { useIntraday } from "@/lib/vega/useIntraday";
import { useVegaQuotes } from "@/lib/vega/useVegaQuotes";

const EMPTY_BARS: never[] = [];

/** Small ⓘ affordance for a card header — hover reveals the methodology. */
function Hint({ text }: { text: string }) {
  return (
    <Tooltip content={text} underline={false} maxWidth={300}>
      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-edge text-[10px] text-faint transition-colors hover:text-ink">
        i
      </span>
    </Tooltip>
  );
}

/**
 * The Edge Engine console — the regime engine's intraday sibling. Eight
 * signal layers over the focused symbol's live 5m tape + quote, blended into
 * one directional read with earned weights, drivers, cautions, and the
 * session's score ribbon. The math is lib/vega/engine.ts; this page is the
 * machine room around it.
 */
export default function EnginePage() {
  const { state, ready, setFocus } = useVega();
  const symbol = state.focus;

  const { series, loading, empty, degraded } = useIntraday(ready ? symbol : "", "5m");
  const { quotes, asOf } = useVegaQuotes(ready ? [symbol, BENCH] : []);
  const quote = quotes[symbol] ?? null;
  const benchmark = symbol === BENCH ? null : (quotes[BENCH] ?? null);

  const bars = series?.bars ?? EMPTY_BARS;
  const { value: report, pending } = useAsyncCompute(
    () =>
      bars.length > 0
        ? edgeEngine({
            symbol,
            bars,
            quote,
            benchmark,
            orMinutes: state.settings.orMinutes,
            nowIso: asOf ?? new Date().toISOString(),
          })
        : null,
    [bars, quote, benchmark, symbol, state.settings.orMinutes, asOf]
  );

  const noData = !loading && (empty || bars.length === 0);

  return (
    <>
      <PageHeader
        eyebrow="Trade"
        title={`${symbol} · Edge Engine`}
        description="Eight live signal layers — trend, VWAP posture, momentum, volume pressure, levels, relative strength, gap behavior, and a contrarian extension guard — fused into one directional read. Weights are earned from coverage and agreement, never hand-tuned."
        right={<SymbolForm onSubmit={setFocus} buttonLabel="Run" />}
      />

      {/* Quote strip */}
      <Card i={0} className="mb-4 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {quote ? (
            <>
              <span className="font-display text-[20px] font-semibold tracking-[-0.01em] text-ink">
                <Money value={quote.price} />
              </span>
              <ChangePct value={quote.changePct} />
              {benchmark && (
                <span className="font-mono text-[11px] text-faint">
                  {BENCH} <ChangePct value={benchmark.changePct} />
                </span>
              )}
            </>
          ) : (
            <SkeletonBlock className="h-6 w-56" />
          )}
          {report && (
            <span className="ml-auto flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              <Tooltip content="Share of the engine's signals that had live data this run — missing inputs are excluded, never imputed.">
                <span>coverage {(report.coverage * 100).toFixed(0)}%</span>
              </Tooltip>
              <Tooltip content="How much the weighted layers point the same way: 100% = unanimous, near 0% = they cancel out.">
                <span>agreement {(report.agreement * 100).toFixed(0)}%</span>
              </Tooltip>
            </span>
          )}
        </div>
      </Card>

      {(loading || (pending && !report)) && !noData ? (
        <Card i={1} className="p-6">
          <SkeletonBlock className="h-[420px] w-full" />
        </Card>
      ) : noData || !report ? (
        <Card i={1} className="flex h-[380px] flex-col items-center justify-center gap-2 text-center">
          <p className="text-[13px] text-mute">
            {degraded
              ? "The price feed is unreachable — the engine restarts when it returns."
              : `Not enough intraday bars to run the engine on ${symbol}.`}
          </p>
          <p className="max-w-md text-[12px] text-faint">
            The engine needs a live 5-minute tape. Index tickers (^VIX) and very thin listings
            don&apos;t chart intraday; the read resumes as soon as bars arrive.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-5">
            {/* The dial + driver stacks */}
            <Card i={1} className="p-5 lg:col-span-2">
              <CardHeader
                eyebrow="Composite read"
                title="Conviction dial"
                right={<Hint text="The weighted blend of all eight layers, −100 (max short) to +100 (max long). The outer gold arc is confidence — data coverage × cross-layer agreement. The deadband under ±8 reads as no edge." />}
              />
              <EngineDial report={report} />
              <div className="mt-4 grid grid-cols-2 gap-5">
                <DriverStack
                  title="Drivers"
                  items={report.drivers}
                  empty="Nothing is pulling the read in this direction."
                  tone={report.score >= 0 ? "pos" : "neg"}
                />
                <DriverStack
                  title="Against the read"
                  items={report.cautions}
                  empty="No layer is fighting the read right now."
                  tone={report.score >= 0 ? "neg" : "pos"}
                />
              </div>
            </Card>

            {/* The eight layers */}
            <Card i={2} className="p-5 lg:col-span-3">
              <CardHeader
                eyebrow="The machine"
                title="Eight signal layers"
                right={<Hint text="Each layer blends 2–3 concrete signals. Bar-derived signals are ranked against their own trailing distribution (percentiles, no fixed thresholds); the bar shows the layer's score, its opacity the earned weight. Click a layer for its raw signals." />}
              />
              <EngineLayers layers={report.layers} />
            </Card>
          </div>

          {/* Score ribbon */}
          <Card i={3} className="mt-4 p-5">
            <CardHeader
              eyebrow="Session replay"
              title="How the read evolved today"
              right={<Hint text="The bar-derived composite recomputed at every 5-minute bar of the current session, using only data available at that bar — no lookahead. Quote-only layers (relative strength, gap) can't replay, so they don't vote here." />}
            />
            <ScoreRibbon points={report.ribbon} />
          </Card>

          <p className="mt-4 max-w-3xl text-[11.5px] leading-relaxed text-faint">
            Methodology — every bar-derived signal is scored by ranking its current value against its
            own trailing distribution over the fetched span (percentile → −100..+100), the same
            no-hand-tuned-thresholds principle as alpha&apos;s regime engine. Layer weights are earned from
            data coverage and internal agreement; missing data drops out rather than defaulting. The
            extension guard deliberately scores against stretched moves. This is a model of the tape,
            not advice — it reads participation, not the future.
          </p>
        </>
      )}
    </>
  );
}
