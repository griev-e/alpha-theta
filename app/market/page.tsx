"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  AnimatePresence,
  m,
  useSpring,
  useTransform,
} from "framer-motion";
import { Sparkline } from "@/components/charts/Sparkline";

// The regime dial and per-layer cards only render after the /api/market report
// loads (the page early-returns on `!report`), so their JS is loaded on demand.
const LayerCard = dynamic(
  () => import("@/components/market/LayerCard").then((m) => m.LayerCard),
  { ssr: false }
);
const RegimeDial = dynamic(
  () => import("@/components/market/RegimeDial").then((m) => m.RegimeDial),
  { ssr: false }
);
import { fmtScore, REGIME_COLOR, scoreTone } from "@/components/market/regimeUi";
import { AiThinking } from "@/components/ui/AiThinking";
import { AiMeta } from "@/components/ui/AiMeta";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { Card, CardHeader } from "@/components/ui/Card";
import { Computing } from "@/components/ui/Computing";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tooltip } from "@/components/ui/Tooltip";
import type {
  DriverItem,
  RegimeReport,
} from "@/lib/analytics/regime/types";
import type {
  MarketBriefRequest,
  MarketBriefResponse,
} from "@/lib/market/types";
import { fmtPct, relativeTime } from "@/lib/format";

const REFRESH_MS = 10 * 60_000;

function useMarketReport() {
  const [report, setReport] = useState<RegimeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/market");
      if (res.status === 401) {
        window.location.replace("/lock");
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      setReport((await res.json()) as RegimeReport);
    } catch {
      setError("Market data provider unreachable. The tape will wait.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return { report, error, loading, refresh: load };
}

/* ── Presentation helpers ─────────────────────────────────────────────── */

/** Spring count-up from 0 → value, formatted live. */
function Count({
  value,
  format,
  className,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
}) {
  const sv = useSpring(0, { stiffness: 90, damping: 24, restDelta: 1e-3 });
  useEffect(() => {
    sv.set(value);
  }, [value, sv]);
  const text = useTransform(sv, format);
  return <m.span className={className}>{text}</m.span>;
}

/** A labelled mini-bar (0…100) used inside the hero stat tiles. */
function MiniMeter({ value, color }: { value: number; color: string }) {
  return (
    <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
      <m.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

function StatTile({
  label,
  children,
  sub,
  tip,
}: {
  label: string;
  children: React.ReactNode;
  sub?: React.ReactNode;
  tip?: React.ReactNode;
}) {
  return (
    <div className="tile px-3.5 py-3">
      {tip ? (
        <Tooltip content={tip}>
          <span className="eyebrow">{label}</span>
        </Tooltip>
      ) : (
        <div className="eyebrow">{label}</div>
      )}
      <div className="mt-1.5 font-mono tnum text-[22px] font-medium leading-none">
        {children}
      </div>
      {sub && <div className="mt-1.5 text-[10px] text-faint">{sub}</div>}
    </div>
  );
}

/** Plain-language phase label for how long the regime has held. */
function regimePhase(days: number): string {
  if (days < 10) return "young";
  if (days < 30) return "maturing";
  return "entrenched";
}

const healthColor = (h: number) =>
  h >= 60 ? "var(--color-pos)" : h >= 40 ? "var(--color-warn)" : "var(--color-neg)";
const healthTone = (h: number) =>
  h >= 60 ? "text-pos" : h >= 40 ? "text-warn" : "text-neg";

/** One honest, plain-language sentence summarizing the current state. */
function synthesize(r: RegimeReport): string {
  const dir =
    r.direction === "Improving"
      ? "and improving"
      : r.direction === "Deteriorating"
        ? "but deteriorating at the margin"
        : "and broadly stable";
  const conf =
    r.confidence >= 65
      ? "high-confidence"
      : r.confidence >= 45
        ? "moderate-confidence"
        : "low-confidence";
  const healthWord =
    r.health >= 65 ? "healthy" : r.health >= 45 ? "mixed" : "fragile";
  const drag = r.drivers.bearish[0]?.label;
  const lift = r.drivers.bullish[0]?.label;
  const tail =
    r.score >= 0 && drag
      ? ` Main drag: ${drag.toLowerCase()}.`
      : r.score < 0 && lift
        ? ` Main support: ${lift.toLowerCase()}.`
        : "";
  return `A ${r.regime.toLowerCase()} tape ${dir}, on ${conf} signals. Internals read ${healthWord} (${r.health}/100).${tail}`;
}

function DriverColumn({
  title,
  items,
  tone,
  empty,
}: {
  title: string;
  items: DriverItem[];
  tone: "pos" | "neg" | "shift";
  empty: string;
}) {
  return (
    <div>
      <div className="eyebrow mb-3">{title}</div>
      {items.length === 0 && (
        <div className="text-[11.5px] text-faint">{empty}</div>
      )}
      <div className="space-y-3">
        {items.map((d, idx) => (
          <m.div
            key={`${d.layer}:${d.label}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + idx * 0.05 }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] font-medium text-ink">{d.label}</span>
              <span
                className={`font-mono tnum text-[11px] ${
                  tone === "shift"
                    ? d.value > 0
                      ? "text-pos"
                      : "text-neg"
                    : tone === "pos"
                      ? "text-pos"
                      : "text-neg"
                }`}
              >
                {fmtScore(d.value)}
                {tone === "shift" ? " /1m" : ""}
              </span>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-faint">
              {d.layer}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-mute">{d.detail}</p>
          </m.div>
        ))}
      </div>
    </div>
  );
}

const VERDICT_STYLE: Record<string, string> = {
  "risk-on": "border-pos/30 bg-pos/10 text-pos",
  "risk-off": "border-neg/30 bg-neg/10 text-neg",
  neutral: "border-edge bg-white/[0.03] text-faint",
};

/* ── AI market read ───────────────────────────────────────────────────── */

function buildBriefRequest(r: RegimeReport): MarketBriefRequest {
  const factor = (d: DriverItem) => ({ label: d.label, detail: d.detail });
  return {
    snapshot: {
      asOf: r.asOf,
      regime: r.regime,
      score: +r.score.toFixed(3),
      confidence: Math.round(r.confidence),
      consensus: r.consensus,
      health: Math.round(r.health),
      direction: r.direction,
      directionSlope: +r.directionSlope.toFixed(3),
      maturityDays: r.maturityDays,
      persistence: +r.persistence.toFixed(2),
      layers: r.layers.map((l) => ({
        name: l.name,
        score: l.score === null ? null : +l.score.toFixed(3),
        weight: +l.weight.toFixed(3),
        summary: l.summary,
      })),
      bullish: r.drivers.bullish.map(factor),
      bearish: r.drivers.bearish.map(factor),
      shifts: r.drivers.shifts.map(factor),
      risks: r.drivers.risks,
      opportunities: r.drivers.opportunities,
    },
  };
}

type BriefState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "disabled" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: MarketBriefResponse };

function MarketBriefCard({ report }: { report: RegimeReport }) {
  const [state, setState] = useState<BriefState>({ kind: "idle" });

  const generate = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/market-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBriefRequest(report)),
      });
      if (res.status === 401) {
        window.location.replace("/lock");
        return;
      }
      if (res.status === 501) {
        setState({ kind: "disabled" });
        return;
      }
      if (res.status === 429) {
        setState({
          kind: "error",
          message: "The strategist is rate limited — try again shortly.",
        });
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      setState({ kind: "ready", data: (await res.json()) as MarketBriefResponse });
    } catch {
      setState({ kind: "error", message: "The strategist is unreachable." });
    }
  }, [report]);

  if (state.kind === "disabled") {
    return (
      <Card className="mb-5 px-6 py-4" i={0.5} hover={false}>
        <div className="flex items-center gap-3 text-[12.5px] text-faint">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
          AI market read is off — set{" "}
          <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px]">
            ANTHROPIC_API_KEY
          </code>{" "}
          to enable a Claude-written synthesis of the regime.
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-5 overflow-hidden px-6 py-5 sm:px-8" i={0.5} hover={false}>
      <CardHeader
        eyebrow="AI strategist"
        title="The read on this tape"
        right={
          state.kind === "ready" ? (
            <div className="flex items-center gap-3">
              <button
                onClick={generate}
                className="rounded-md border border-edge px-2.5 py-1 text-[11px] text-mute transition-colors hover:text-ink"
              >
                Regenerate
              </button>
            </div>
          ) : undefined
        }
        className="mb-4"
      />

      {state.kind === "idle" && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <p className="max-w-2xl text-[12.5px] leading-relaxed text-mute">
            Have Claude reason across the eight layers, the composite score, and
            the ranked drivers, and synthesize them into one honest read — what
            the tape is, what&apos;s moving it, what to watch, and the strongest
            counter-signal. A model read, not advice.
          </p>
          <button onClick={generate} className="btn-primary">
            Generate market read
          </button>
        </div>
      )}

      {state.kind === "loading" && (
        <AiThinking
          label="Reading the tape"
          messages={[
            "Weighing the eight layers",
            "Reconciling the conflicts",
            "Sizing the drivers",
            "Writing the read",
          ]}
        />
      )}

      {state.kind === "error" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="text-[13px] text-mute">{state.message}</div>
          <button onClick={generate} className="btn-secondary">
            Retry
          </button>
        </div>
      )}

      {state.kind === "ready" && (
        <RevealGroup>
          <RevealItem>
            <h3 className="font-display text-[17px] font-semibold leading-snug text-ink">
              {state.data.brief.headline}
            </h3>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-mute">
              {state.data.brief.read}
            </p>
          </RevealItem>

          <RevealItem className="mt-5 grid gap-x-10 gap-y-5 lg:grid-cols-2">
            {state.data.brief.positioning.length > 0 && (
              <div>
                <div className="eyebrow mb-2">what it implies</div>
                <ul className="space-y-2">
                  {state.data.brief.positioning.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-2.5 text-[12.5px] leading-snug text-mute"
                    >
                      <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-mint/70" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-5">
              {state.data.brief.watchItems.length > 0 && (
                <div>
                  <div className="eyebrow mb-2">on watch</div>
                  <ul className="space-y-2">
                    {state.data.brief.watchItems.map((w) => (
                      <li
                        key={w}
                        className="flex items-start gap-2.5 text-[12.5px] leading-snug text-mute"
                      >
                        <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-sky/70" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <div className="eyebrow mb-2 !text-warn/80">counter-signal</div>
                <p className="text-[12.5px] leading-snug text-mute">
                  {state.data.brief.contrarian}
                </p>
              </div>
            </div>
          </RevealItem>

          <RevealItem className="mt-5 flex justify-end border-t border-edge pt-3">
            <AiMeta
              model="Claude Sonnet 4.6"
              cached={state.data.cached}
              costUSD={state.data.costUSD}
              generatedAt={state.data.generatedAt}
            />
          </RevealItem>
        </RevealGroup>
      )}
    </Card>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

const HEADER_DESC =
  "Regime, risk appetite, and internal health — synthesized from price, breadth, leadership, volatility, and cross-asset flows.";

export default function MarketPage() {
  const { report, error, loading, refresh } = useMarketReport();
  const [methodOpen, setMethodOpen] = useState(false);

  if (!report) {
    return (
      <div>
        <PageHeader eyebrow="Analysis" title="Market Analysis" description={HEADER_DESC} />
        <div className="relative">
          <Computing active={loading} label="reading the tape…" />
          {!loading && error ? (
            <div className="panel flex h-[360px] flex-col items-center justify-center gap-4 px-8 text-center">
              <div className="text-[13.5px] text-mute">{error}</div>
              <button onClick={refresh} className="btn-secondary">
                Retry
              </button>
            </div>
          ) : (
            <div className="panel h-[360px]" />
          )}
        </div>
      </div>
    );
  }

  const r = report;
  const regimeColor = REGIME_COLOR[r.regime];
  const dirTone =
    r.direction === "Improving"
      ? "text-pos"
      : r.direction === "Deteriorating"
        ? "text-neg"
        : "text-mute";
  const dirArrow =
    r.direction === "Improving" ? "↗" : r.direction === "Deteriorating" ? "↘" : "→";

  return (
    <div>
      <PageHeader
        eyebrow="Analysis"
        title="Market Analysis"
        description={HEADER_DESC}
        right={
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10.5px] text-faint">
              updated {relativeTime(r.generatedAt)}
            </span>
            <button onClick={refresh} className="btn-secondary !h-7 !px-3 !text-[11px]">
              Refresh
            </button>
          </div>
        }
      />

      {/* Regime hero */}
      <Card className="mb-5 px-6 py-6 sm:px-8" i={0} hover={false}>
        <div className="grid items-center gap-6 lg:grid-cols-[280px_1fr] lg:gap-10">
          <div className="flex justify-center">
            <RegimeDial score={r.score} regime={r.regime} />
          </div>

          <div>
            <div className="eyebrow mb-1.5">Current regime</div>
            <div
              className="font-display text-[34px] font-semibold leading-none tracking-tight"
              style={{ color: regimeColor }}
            >
              {r.regime}
            </div>
            <div className="mt-2 text-[12px] text-mute">
              {r.consensus} · as of {r.asOf}
              {r.coverage.missing.length > 0 && (
                <span className="text-warn"> · {r.coverage.missing.length} series unavailable</span>
              )}
            </div>

            <p className="mt-3 max-w-xl text-[12.5px] leading-relaxed text-mute">
              {synthesize(r)}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                label="Confidence"
                sub={`agreement ${r.agreement.toFixed(2)}`}
                tip="How much weight to put on this regime call (0–100%). It rises when the eight layers agree with each other, the reading is well-covered by available data, and it's been stable — and falls when the signals are mixed or data is thin."
              >
                <span className="text-ink">
                  <Count value={r.confidence} format={(v) => `${Math.round(v)}%`} />
                </span>
                <MiniMeter value={r.confidence} color="var(--color-sky)" />
              </StatTile>

              <StatTile
                label="Health"
                sub="internals, 0–100"
                tip="A 0–100 read on the market's internal condition — breadth, leadership, volatility, and credit, not just the index price. Above 50 is healthy participation; below 50 means the tape is being carried by fewer names or showing stress under the surface."
              >
                <span className={healthTone(r.health)}>
                  <Count value={r.health} format={(v) => `${Math.round(v)}`} />
                </span>
                <MiniMeter value={r.health} color={healthColor(r.health)} />
              </StatTile>

              <StatTile
                label="Direction"
                sub={`${r.direction.toLowerCase()} · ${fmtScore(r.directionSlope)}/mo`}
                tip="Which way the regime is drifting — whether the composite score has been improving, deteriorating, or holding steady over the last month. The figure is the projected monthly change in the −1…+1 score."
              >
                <span className={`flex items-baseline gap-1.5 whitespace-nowrap ${dirTone}`}>
                  {dirArrow}
                  <span className="text-[12px] font-medium">{r.direction}</span>
                </span>
              </StatTile>

              <StatTile
                label="Regime age"
                sub={`${regimePhase(r.maturityDays)} · sessions`}
                tip="How long the current regime has been in place, in trading sessions. A young regime is still establishing itself and can flip more easily; an entrenched one has persisted and tends to carry more inertia. Capped, shown with a + when at the cap."
              >
                <span className="text-ink">
                  <Count
                    value={r.maturityDays}
                    format={(v) => `${Math.round(v)}${r.maturityCapped ? "+" : ""}`}
                  />
                </span>
              </StatTile>
            </div>
          </div>
        </div>
      </Card>

      {/* AI market read */}
      <MarketBriefCard report={r} />

      {/* Six-month replay */}
      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <Card className="px-5 py-5" i={1}>
          <CardHeader
            eyebrow="Trailing 6 months"
            title="Risk-on / risk-off score"
            right={
              <span className={`font-mono tnum text-[13px] ${scoreTone(r.score)}`}>
                {fmtScore(r.score)}
              </span>
            }
            className="mb-3"
          />
          <Sparkline
            values={r.history.score.map((v) => v * 100)}
            baseline={0}
            height={72}
            color="var(--color-mint)"
            belowColor="var(--color-neg)"
          />
          <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
            <span>{r.history.dates[0]}</span>
            <span>persistence {r.persistence.toFixed(2)}</span>
            <span>{r.history.dates[r.history.dates.length - 1]}</span>
          </div>
        </Card>
        <Card className="px-5 py-5" i={1.5}>
          <CardHeader
            eyebrow="Trailing 6 months"
            title="Internal market health"
            right={<span className="font-mono tnum text-[13px] text-ink">{r.health}</span>}
            className="mb-3"
          />
          <Sparkline
            values={r.history.health}
            baseline={50}
            height={72}
            color="var(--color-sky)"
            belowColor="var(--color-warn)"
          />
          <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
            <span>{r.history.dates[0]}</span>
            <span>50 = neutral internals</span>
            <span>{r.history.dates[r.history.dates.length - 1]}</span>
          </div>
        </Card>
      </div>

      {/* Analytical layers */}
      <div className="mb-3 flex items-baseline justify-between">
        <div className="eyebrow">Eight analytical layers</div>
        <span className="font-mono text-[10px] text-faint">tap a card for its signals</span>
      </div>
      <div className="mb-5 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        {r.layers.map((layer, i) => (
          <LayerCard key={layer.id} layer={layer} i={i} />
        ))}
      </div>

      {/* Key drivers */}
      <Card className="mb-5 px-6 py-5" i={4} hover={false}>
        <CardHeader
          eyebrow="Key drivers"
          title="What is moving the needle"
          right={
            <span className="hidden font-mono text-[10px] text-faint sm:inline">
              contribution-ranked across all layers
            </span>
          }
          className="mb-5"
        />
        <div className="grid gap-8 md:grid-cols-3">
          <DriverColumn
            title="Most bullish factors"
            items={r.drivers.bullish}
            tone="pos"
            empty="Nothing is pulling the composite up right now."
          />
          <DriverColumn
            title="Most bearish factors"
            items={r.drivers.bearish}
            tone="neg"
            empty="Nothing is dragging the composite down right now."
          />
          <DriverColumn
            title="Largest recent changes"
            items={r.drivers.shifts}
            tone="shift"
            empty="No signal moved materially this month."
          />
        </div>

        <div className="mt-6 grid gap-5 border-t border-edge pt-5 md:grid-cols-2">
          <div>
            <div className="eyebrow mb-2 !text-warn/80">Emerging risks</div>
            {r.drivers.risks.length === 0 ? (
              <div className="text-[11.5px] text-faint">
                No acute deterioration flags in the current data.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {r.drivers.risks.map((risk) => (
                  <li key={risk} className="flex gap-2 text-[11.5px] leading-snug text-mute">
                    <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-warn/70" />
                    {risk}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="eyebrow mb-2 !text-mint/80">Emerging opportunities</div>
            {r.drivers.opportunities.length === 0 ? (
              <div className="text-[11.5px] text-faint">
                Nothing newly improving stands out this month.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {r.drivers.opportunities.map((opp) => (
                  <li key={opp} className="flex gap-2 text-[11.5px] leading-snug text-mute">
                    <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-mint/70" />
                    {opp}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      {/* Trend table & capital flows */}
      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden" i={5}>
          <CardHeader eyebrow="Trend analysis" title="Index trend states" className="mb-2 px-5 pt-5" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[12px]">
              <thead>
                <tr className="border-b border-edge text-left">
                  {["Index", "1m", "3m", "50d", "200d", "Slope/yr", "Consistency", "Stretch"].map(
                    (h, hi) => (
                      <th
                        key={h}
                        className={`px-4 py-2.5 text-[11px] font-medium text-faint ${hi > 0 ? "text-right" : ""}`}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {r.trendTable.map((row) => (
                  <tr key={row.symbol} className="border-b border-edge/60 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-medium text-ink">{row.symbol}</span>
                      <span className="ml-2 hidden text-[10.5px] text-faint lg:inline">
                        {row.label}
                      </span>
                    </td>
                    <Pct v={row.ret21} />
                    <Pct v={row.ret63} />
                    <Check v={row.above50} />
                    <Check v={row.above200} />
                    <Pct v={row.slope} digits={0} />
                    <td className="px-4 py-2.5 text-right font-mono tnum text-mute">
                      {row.consistency === null ? "—" : fmtPct(row.consistency, 0)}
                    </td>
                    <Pct v={row.stretch} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-[10.5px] leading-snug text-faint">
            Consistency = share of the last quarter above the 50-day. Stretch = distance from the
            50-day; large stretch cuts trend quality.
          </p>
        </Card>

        <Card className="overflow-hidden" i={5.5}>
          <CardHeader
            eyebrow="Relative strength"
            title="Where capital is flowing"
            className="mb-2 px-5 pt-5"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[12px]">
              <thead>
                <tr className="border-b border-edge text-left">
                  {["Pair", "1m", "3m", "Trend", "Read"].map((h, hi) => (
                    <th
                      key={h}
                      className={`px-4 py-2.5 text-[11px] font-medium text-faint ${hi > 0 ? "text-right" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.ratios.map((row) => (
                  <tr key={row.id} className="border-b border-edge/60 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5">
                      <div className="text-[12px] text-ink">{row.label}</div>
                      <div className="font-mono text-[10px] text-faint">
                        {row.a}/{row.b}
                      </div>
                    </td>
                    <Pct v={row.ret21} />
                    <Pct v={row.ret63} />
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`font-mono tnum ${row.score === null ? "text-faint" : scoreTone(row.score)}`}
                      >
                        {row.score === null ? "—" : fmtScore(row.score)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] ${VERDICT_STYLE[row.verdict]}`}
                      >
                        {row.verdict}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-[10.5px] leading-snug text-faint">
            Each pair is risk-seeking over safety-seeking; a rising ratio means the risk leg is
            being accumulated.
          </p>
        </Card>
      </div>

      {/* Methodology (collapsible) */}
      <Card className="px-6 py-4" i={6} hover={false}>
        <button
          onClick={() => setMethodOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={methodOpen}
        >
          <div>
            <div className="eyebrow mb-0.5">Explainability</div>
            <h2 className="font-display text-[14px] font-medium text-ink">How this is computed</h2>
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wide text-faint">
            {methodOpen ? "Hide" : "Show"}
            <m.span animate={{ rotate: methodOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
              ⌄
            </m.span>
          </span>
        </button>
        <AnimatePresence initial={false}>
          {methodOpen && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <ol className="mt-4 grid gap-x-8 gap-y-2 md:grid-cols-2">
                {r.methodology.map((m, i) => (
                  <li key={m} className="flex gap-2.5 text-[11.5px] leading-relaxed text-mute">
                    <span className="font-mono text-[10px] text-faint">
                      {`0${i + 1}`.slice(-2)}
                    </span>
                    {m}
                  </li>
                ))}
              </ol>
            </m.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}

function Pct({ v, digits = 1 }: { v: number | null; digits?: number }) {
  return (
    <td
      className={`px-4 py-2.5 text-right font-mono tnum ${
        v === null ? "text-faint" : v > 0 ? "text-pos" : v < 0 ? "text-neg" : "text-mute"
      }`}
    >
      {v === null ? "—" : fmtPct(v, digits, true)}
    </td>
  );
}

function Check({ v }: { v: boolean | null }) {
  return (
    <td className="px-4 py-2.5 text-right font-mono">
      {v === null ? (
        <span className="text-faint">—</span>
      ) : v ? (
        <span className="text-pos">✓</span>
      ) : (
        <span className="text-neg">✗</span>
      )}
    </td>
  );
}
