"use client";

import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Gauge } from "@/components/ui/Gauge";
import { Ring } from "@/components/ui/Ring";
import { Meter } from "@/components/ui/Meter";
import { Delta } from "@/components/ui/Delta";
import { Money } from "@/components/ui/Money";
import { StatusDot, type StatusTone } from "@/components/ui/StatusDot";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { DataSourceDot } from "@/components/ui/DataSourceBadge";
import { Segmented } from "@/components/ui/Segmented";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { DegradedNotice } from "@/components/ui/DegradedNotice";
import { AiDisabledCard } from "@/components/ui/AiDisabledCard";
import {
  TableSkeleton,
  ChartGridSkeleton,
  SplitSkeleton,
  TerminalSkeleton,
} from "@/components/ui/Skeleton";
import { Sparkline } from "@/components/charts/Sparkline";
import { Donut } from "@/components/charts/Donut";
import { Radar } from "@/components/charts/Radar";
import { Histogram } from "@/components/charts/Histogram";
import { Scatter } from "@/components/charts/Scatter";
import { FanChart } from "@/components/charts/FanChart";
import { Heatmap } from "@/components/charts/Heatmap";
import { GHOST_FAN, GHOST_MATRIX } from "@/components/ui/ghostData";
import { fmtPct, fmtUSD } from "@/lib/format";

/** A labelled bay in the gallery. */
function Bay({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline gap-3 border-b border-edge pb-2">
        <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>
        {note && <span className="text-[11.5px] text-faint">{note}</span>}
      </div>
      {children}
    </section>
  );
}

/** One specimen with a caption underneath. */
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-[64px] items-center">{children}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
        {label}
      </div>
    </div>
  );
}

const STATUS_TONES: StatusTone[] = ["live", "info", "stale", "idle"];
const COLORS = [
  ["accent", "brand red"],
  ["pos", "positive"],
  ["neg", "negative"],
  ["warn", "warn / act"],
  ["vio", "theta"],
  ["sky", "info"],
  ["mint", "data"],
  ["mute", "mute"],
  ["faint", "faint"],
];

const SPARK = [4, 6, 5, 8, 7, 10, 9, 13, 11, 14, 12, 16];
const DONUT = [
  { id: "a", label: "Tech", value: 42, color: "var(--color-mint)", delta: 0.012 },
  { id: "b", label: "Health", value: 23, color: "var(--color-vio)", delta: -0.004 },
  { id: "c", label: "Energy", value: 18, color: "var(--color-sky)", delta: 0.008 },
  { id: "d", label: "Other", value: 17, color: "var(--color-warn)", delta: -0.011 },
];
const HISTO = Array.from({ length: 18 }, (_, i) => {
  const x0 = 60 + i * 10;
  const count = Math.round(40 * Math.exp(-((i - 9) ** 2) / 20));
  return { x0, x1: x0 + 10, count };
});
const SCATTER = Array.from({ length: 14 }, (_, i) => ({
  id: `p${i}`,
  label: ["AA", "BB", "CC", "DD", "EE", "FF", "GG"][i % 7],
  x: 0.2 + Math.sin(i) * 0.3 + i * 0.03,
  y: 0.5 + Math.cos(i * 1.3) * 0.3,
  size: 0.2 + (i % 5) * 0.16,
  color: i % 3 === 0 ? "var(--color-mint)" : i % 3 === 1 ? "var(--color-vio)" : "var(--color-sky)",
}));

export function DesignGallery() {
  const [seg, setSeg] = useState("holdings");
  const [slider, setSlider] = useState(60);
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="pb-24">
      <PageHeader
        eyebrow="Internal · dev only"
        title="Design gallery"
        description="Every primitive, chart, and state in one place — the system made inspectable. Not shipped to production."
      />

      <Bay title="Status hues" note="§20 — one vocabulary, rendered by StatusDot">
        <div className="flex flex-wrap gap-x-10 gap-y-5">
          {STATUS_TONES.map((t) => (
            <Cell key={t} label={t}>
              <StatusDot tone={t} />
            </Cell>
          ))}
          <Cell label="synthetic">
            <StatusDot tone="synthetic" accent="var(--color-warn)" />
          </Cell>
          <Cell label="SampleDataTag">
            <SampleDataTag accent="var(--color-warn)" label="DEMO DATA" />
          </Cell>
          <Cell label="provenance">
            <div className="flex items-center gap-2">
              <DataSourceDot source="live" />
              <DataSourceDot source="partial" />
              <DataSourceDot source="fallback" />
            </div>
          </Cell>
        </div>
      </Bay>

      <Bay title="Palette" note="brand red is signature-only; mint/sky/vio are data hues">
        <div className="flex flex-wrap gap-4">
          {COLORS.map(([tok, name]) => (
            <div key={tok} className="flex flex-col items-center gap-1.5">
              <span
                className="h-10 w-14 rounded-lg ring-1 ring-edge"
                style={{ background: `var(--color-${tok})` }}
              />
              <span className="font-mono text-[10px] text-faint">{name}</span>
            </div>
          ))}
        </div>
      </Bay>

      <Bay title="Typography & numerals" note="§4 — Money dims the furniture">
        <div className="space-y-3">
          <p className="font-display text-[32px] font-semibold tracking-tight text-ink">
            Display 32 · tracking tight
          </p>
          <p className="eyebrow">Eyebrow · sentence-case metadata</p>
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-mute">
            MONO LABEL · STATUS VOICE
          </p>
          <div className="flex flex-wrap items-baseline gap-8 pt-1">
            <Money value={1230456.56} className="text-[26px] text-ink" />
            <Money value={1230456.56} compact className="text-[26px] text-ink" />
            <span className="font-mono tnum text-[20px] text-ink">1,234.50</span>
          </div>
        </div>
      </Bay>

      <Bay title="Metrics">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          <Card className="px-5 py-4">
            <Stat label="Net value" value={31136.56} format={(v) => fmtUSD(v)} dim />
          </Card>
          <Card className="px-5 py-4">
            <Stat
              label="Est. volatility"
              value={0.195}
              format={(v) => fmtPct(v, 1)}
              sub="annualized"
            />
          </Card>
          <Card className="flex items-center justify-center px-5 py-4">
            <Ring score={72} size={92}>
              <span className="font-mono text-[18px] text-ink">72</span>
            </Ring>
          </Card>
          <Card className="flex items-center justify-center px-5 py-4">
            <Gauge
              value={1.26}
              min={0}
              max={2}
              label="Beta"
              format={(v) => v.toFixed(2)}
              marker={{ value: 1, label: "SPX" }}
              band={{ from: 0.9, to: 1.1, label: "market" }}
            />
          </Card>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Card className="px-5 py-4">
            <div className="mb-2 text-[12px] text-mute">Meter · vs benchmark</div>
            <Meter value={62} max={100} benchmark={50} benchmarkLabel="S&P" />
          </Card>
          <Card className="flex items-center gap-6 px-5 py-4">
            <Delta value={0.0483} format={(v) => fmtPct(v, 2, true)} />
            <Delta value={-0.021} format={(v) => fmtPct(v, 2, true)} />
          </Card>
        </div>
      </Bay>

      <Bay title="Controls">
        <div className="flex flex-wrap items-center gap-8">
          <Cell label="Segmented">
            <Segmented
              value={seg}
              onChange={setSeg}
              options={[
                { value: "holdings", label: "Holdings" },
                { value: "sector", label: "Sector" },
              ]}
            />
          </Cell>
          <div className="min-w-[220px]">
            <RangeSlider
              min={0}
              max={100}
              value={slider}
              onChange={setSlider}
              format={(v) => `${v}%`}
            />
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
              RangeSlider
            </div>
          </div>
          <Cell label="Buttons">
            <div className="flex gap-2">
              <button className="btn-primary">Primary</button>
              <button className="btn-secondary">Secondary</button>
            </div>
          </Cell>
          <Cell label="Field">
            <input className="field w-40" placeholder="Ticker…" />
          </Cell>
        </div>
      </Bay>

      <Bay title="Charts" note="all hand-built SVG — no chart library">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="px-5 py-4">
            <div className="mb-3 text-[12px] text-mute">Sparkline</div>
            <Sparkline values={SPARK} height={56} labels={SPARK.map((_, i) => `M${i}`)} formatValue={(v) => fmtUSD(v)} />
          </Card>
          <Card className="flex justify-center px-5 py-4">
            <Donut
              slices={DONUT}
              size={180}
              thickness={22}
              centerLabel="Total"
              centerValue="$31.1K"
              activeId={active}
              onActiveChange={setActive}
            />
          </Card>
          <Card className="flex justify-center px-5 py-4">
            <Radar
              axes={["Growth", "Value", "Quality", "Momentum", "Size"]}
              series={[
                { id: "you", label: "Portfolio", color: "var(--color-mint)", values: [72, 40, 66, 58, 50] },
                { id: "spx", label: "S&P 500", color: "var(--color-faint)", values: [55, 55, 60, 52, 48] },
              ]}
              size={220}
            />
          </Card>
          <Card className="px-5 py-4">
            <div className="mb-3 text-[12px] text-mute">Histogram · target line</div>
            <Histogram bins={HISTO} target={140} height={150} />
          </Card>
          <Card className="px-5 py-4">
            <div className="mb-3 text-[12px] text-mute">Scatter · quadrants</div>
            <Scatter
              points={SCATTER}
              xLabel="Beta"
              yLabel="Return"
              xFormat={(v) => v.toFixed(2)}
              yFormat={(v) => fmtPct(v, 0)}
              quadrantLabels={{ tl: "Defensive", tr: "Aggressive", bl: "Lagging", br: "Cyclical" }}
              height={220}
            />
          </Card>
          <Card className="px-5 py-4">
            <div className="mb-3 text-[12px] text-mute">Fan chart · percentile bands</div>
            <FanChart result={GHOST_FAN.result} target={GHOST_FAN.target} height={220} />
          </Card>
          <Card className="px-5 py-4 lg:col-span-2">
            <div className="mb-3 text-[12px] text-mute">Correlation heatmap</div>
            <div className="max-w-[420px]">
              <Heatmap symbols={GHOST_MATRIX.symbols} matrix={GHOST_MATRIX.matrix} />
            </div>
          </Card>
        </div>
      </Bay>

      <Bay title="States" note="§103 skeletons · §105 degraded · §106 AI-off">
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <DegradedNotice
              title="Live feed offline"
              onRetry={() => {}}
            >
              Analytics are running on your imported prices.
            </DegradedNotice>
            <AiDisabledCard variant="card" title="AI brief unavailable">
              Set <code className="font-mono text-mute">ANTHROPIC_API_KEY</code> to enable the daily brief.
            </AiDisabledCard>
          </div>
          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
              TableSkeleton
            </div>
            <TableSkeleton />
          </div>
          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
              ChartGridSkeleton
            </div>
            <ChartGridSkeleton cards={2} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                SplitSkeleton
              </div>
              <SplitSkeleton />
            </div>
            <div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                TerminalSkeleton
              </div>
              <TerminalSkeleton />
            </div>
          </div>
        </div>
      </Bay>
    </div>
  );
}
