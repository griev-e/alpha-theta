"use client";

import { useMemo } from "react";
import { useElementWidth } from "@/lib/useElementWidth";
import { fmtUSDCompact } from "@/lib/format";
import { AxisX, AxisY } from "@/components/charts/Axis";
import type { ProjectionBand } from "@/lib/theta/project";

/**
 * A percentile fan for theta's net-worth projection — the sister of alpha's
 * FanChart, but over `ProjectionBand[]` (a whole balance sheet) rather than one
 * holding's MonteCarloResult. Hand-built SVG, no chart library, per convention.
 * Draws the p5–p95 and p25–p75 shaded bands, the median line, and an optional
 * target line, with a few sample paths as a faint backdrop.
 */
export function ProjectionFan({
  bands,
  samplePaths = [],
  target,
  accent = "var(--color-vio)",
  height = 340,
}: {
  bands: ProjectionBand[];
  samplePaths?: number[][];
  target?: number | null;
  accent?: string;
  height?: number;
}) {
  const [wrapRef, W] = useElementWidth<HTMLDivElement>();
  const H = height;
  const PAD = { l: 10, r: 66, t: 14, b: 26 };
  const months = bands.length ? bands[bands.length - 1].month : 1;

  const maxY = useMemo(() => {
    const top = Math.max(bands.length ? bands[bands.length - 1].p95 : 0, target || 0);
    return top * 1.06 || 1;
  }, [bands, target]);
  const minY = Math.min(0, ...bands.map((b) => b.p5));

  const x = (m: number) => PAD.l + (m / months) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - ((v - minY) / (maxY - minY)) * (H - PAD.t - PAD.b);

  const line = (get: (b: ProjectionBand) => number) =>
    bands.map((b, i) => `${i === 0 ? "M" : "L"} ${x(b.month)} ${y(get(b))}`).join(" ");

  const area = (hi: (b: ProjectionBand) => number, lo: (b: ProjectionBand) => number) => {
    const up = bands.map((b) => `${x(b.month)} ${y(hi(b))}`).join(" L ");
    const dn = [...bands].reverse().map((b) => `${x(b.month)} ${y(lo(b))}`).join(" L ");
    return `M ${up} L ${dn} Z`;
  };

  const yearTicks = useMemo(() => {
    const years = Math.round(months / 12);
    const step = years <= 10 ? 12 : years <= 20 ? 24 : 60;
    const ticks: number[] = [];
    for (let m = 0; m <= months; m += step) ticks.push(m);
    return ticks;
  }, [months]);

  if (!bands.length) return null;

  return (
    <div ref={wrapRef} className="w-full">
      <svg width={W} height={H} className="overflow-visible">
        {/* horizontal gridlines + value scale (shared Axis primitive, §62) */}
        <AxisY
          ticks={[0.25, 0.5, 0.75, 1].map((f) => {
            const v = minY + (maxY - minY) * f;
            return { pos: y(v), label: fmtUSDCompact(v) };
          })}
          gridFrom={PAD.l}
          gridTo={W - PAD.r}
          labelSide="right"
        />

        {/* sample paths backdrop */}
        {samplePaths.slice(0, 16).map((path, i) => (
          <path
            key={i}
            d={path.map((v, m) => `${m === 0 ? "M" : "L"} ${x(m)} ${y(v)}`).join(" ")}
            fill="none"
            stroke={accent}
            strokeWidth="0.6"
            opacity="0.08"
          />
        ))}

        <path d={area((b) => b.p95, (b) => b.p5)} fill={accent} opacity="0.1" />
        <path d={area((b) => b.p75, (b) => b.p25)} fill={accent} opacity="0.16" />
        <path d={line((b) => b.p50)} fill="none" stroke={accent} strokeWidth="2" />

        {target ? (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} stroke="var(--color-mint)" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.8" />
            <text x={W - PAD.r + 6} y={y(target) + 3} className="fill-mint text-[10px] font-mono">
              target
            </text>
          </g>
        ) : null}

        {/* x-axis year labels (shared Axis primitive, §62) */}
        <AxisX
          ticks={yearTicks.map((m) => ({
            pos: x(m),
            label: m === 0 ? "now" : `${Math.round(m / 12)}y`,
          }))}
          y={H - 8}
        />
      </svg>
    </div>
  );
}
