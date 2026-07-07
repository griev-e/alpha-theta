"use client";

import { useId, useMemo, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import { useElementWidth } from "@/lib/useElementWidth";
import { fmtUSD, fmtUSDCompact } from "@/lib/format";
import { ChartFlag } from "@/components/charts/ChartFlag";
import type { CompositionPoint, NetWorthMilestone } from "@/lib/theta/history";

/**
 * Net-worth trajectory (§90) — a hand-built SVG stacked-area chart (no chart
 * library). Liquid cash and invested assets stack above the zero line, what's
 * owed drops below it, and the net-worth line rides on top of the whole thing,
 * so a glance reads both the total and what it's made of over time. Milestone
 * crossings (turned positive, new high) are flagged with the shared ChartFlag.
 * A pointer crosshair breaks any month down into its three bands.
 */

const BANDS = {
  liquid: "var(--color-mint)",
  invested: "var(--color-vio)",
  liabilities: "var(--color-neg)",
} as const;

export function NetWorthArea({
  points,
  milestones,
  height = 260,
}: {
  points: CompositionPoint[];
  milestones: NetWorthMilestone[];
  height?: number;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId();
  const reduce = useReducedMotion();

  const geom = useMemo(() => {
    if (points.length < 2 || width <= 0) return null;
    const posTop = points.map((p) => Math.max(0, p.liquid + p.invested));
    const negBot = points.map((p) => Math.min(0, p.liabilities));
    let hi = Math.max(...posTop, ...points.map((p) => p.net), 0);
    let lo = Math.min(...negBot, ...points.map((p) => p.net), 0);
    const span = hi - lo || 1;
    hi += span * 0.08;
    lo -= span * 0.08;

    const x = (i: number) => (i / (points.length - 1)) * width;
    const y = (v: number) => height - ((v - lo) / (hi - lo)) * height;

    // A filled band between an upper and lower value series.
    const band = (upper: number[], lower: number[]): string => {
      const up = upper.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
      const down = lower
        .map((v, i) => `L${x(lower.length - 1 - i).toFixed(1)} ${y(lower[lower.length - 1 - i]).toFixed(1)}`)
        .join(" ");
      return `${up} ${down} Z`;
    };

    const zero = points.map(() => 0);
    const liquidUpper = points.map((p) => Math.max(0, p.liquid));
    const investedUpper = points.map((p) => Math.max(0, p.liquid) + Math.max(0, p.invested));
    const liabLower = points.map((p) => Math.min(0, p.liabilities));

    const liquidBand = band(liquidUpper, zero);
    const investedBand = band(investedUpper, liquidUpper);
    const liabBand = band(zero, liabLower);

    const netLine = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.net).toFixed(1)}`)
      .join(" ");

    return { x, y, zeroY: y(0), liquidBand, investedBand, liabBand, netLine };
  }, [points, width, height]);

  if (points.length < 2) {
    return (
      <div style={{ height }} className="flex w-full items-center justify-center text-[12px] text-faint">
        Not enough history to chart the trajectory yet.
      </div>
    );
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!geom || width <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (points.length - 1)));
  };

  const hp = hover !== null ? points[hover] : null;
  const tipLeft = geom && hover !== null ? Math.min(Math.max(geom.x(hover), 78), width - 78) : 0;

  return (
    <div className="w-full">
      <div
        ref={ref}
        className="relative w-full touch-none select-none"
        style={{ height }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {geom && width > 0 && (
          <>
            <svg
              width={width}
              height={height}
              className="block"
              style={{ overflow: "visible" }}
              role="img"
              aria-label={`Net worth over ${points.length} months, currently ${fmtUSD(
                points[points.length - 1].net,
                true
              )}, composed of liquid cash, invested assets, and liabilities.`}
            >
              <defs>
                {(["liquid", "invested", "liabilities"] as const).map((k) => (
                  <linearGradient key={k} id={`${gid}-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BANDS[k]} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={BANDS[k]} stopOpacity={0.04} />
                  </linearGradient>
                ))}
              </defs>

              {/* stacked bands (draw grows from the zero line) */}
              <m.g
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <path d={geom.liabBand} fill={`url(#${gid}-liabilities)`} />
                <path d={geom.liquidBand} fill={`url(#${gid}-liquid)`} />
                <path d={geom.investedBand} fill={`url(#${gid}-invested)`} />
              </m.g>

              {/* zero baseline */}
              <line
                x1={0}
                x2={width}
                y1={geom.zeroY}
                y2={geom.zeroY}
                stroke="rgba(255,255,255,0.16)"
                strokeDasharray="3 4"
              />

              {/* the net-worth line, drawing in */}
              <m.path
                d={geom.netLine}
                fill="none"
                stroke="var(--color-ink)"
                strokeWidth={1.8}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />

              {/* milestone flags */}
              {milestones.map((ms) => (
                <g key={`${ms.kind}-${ms.index}`}>
                  <ChartFlag
                    orientation="x"
                    at={geom.x(ms.index)}
                    start={0}
                    end={height}
                    glyph={ms.kind === "high" ? "★" : "◆"}
                    color={ms.kind === "high" ? "var(--color-mint)" : "var(--color-live)"}
                    label={ms.label}
                  />
                  <circle
                    cx={geom.x(ms.index)}
                    cy={geom.y(points[ms.index].net)}
                    r={3.2}
                    fill={ms.kind === "high" ? "var(--color-mint)" : "var(--color-live)"}
                    stroke="var(--color-void)"
                    strokeWidth={2}
                  />
                </g>
              ))}

              {/* crosshair */}
              {hover !== null && (
                <>
                  <line
                    x1={geom.x(hover)}
                    x2={geom.x(hover)}
                    y1={0}
                    y2={height}
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth={1}
                  />
                  <circle
                    cx={geom.x(hover)}
                    cy={geom.y(points[hover].net)}
                    r={4}
                    fill="var(--color-ink)"
                    stroke="var(--color-void)"
                    strokeWidth={2}
                  />
                </>
              )}
            </svg>

            {hp && (
              <div
                className="overlay pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap px-3 py-2"
                style={{ left: tipLeft }}
              >
                <div className="mb-1 text-center font-mono tnum text-[13px] text-ink">
                  {fmtUSD(hp.net, true)}
                </div>
                <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 font-mono text-[10.5px]">
                  <span className="flex items-center gap-1 text-faint">
                    <Dot c={BANDS.liquid} /> Liquid
                  </span>
                  <span className="text-right tnum text-mute">{fmtUSDCompact(hp.liquid)}</span>
                  <span className="flex items-center gap-1 text-faint">
                    <Dot c={BANDS.invested} /> Invested
                  </span>
                  <span className="text-right tnum text-mute">{fmtUSDCompact(hp.invested)}</span>
                  {hp.liabilities < 0 && (
                    <>
                      <span className="flex items-center gap-1 text-faint">
                        <Dot c={BANDS.liabilities} /> Owed
                      </span>
                      <span className="text-right tnum text-mute">{fmtUSDCompact(hp.liabilities)}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* month axis */}
      <div className="mt-2 flex">
        {points.map((p, i) => (
          <div key={`${p.key}-${i}`} className="flex-1 text-center font-mono text-[10px] text-faint">
            {p.month}
          </div>
        ))}
      </div>
    </div>
  );
}

function Dot({ c }: { c: string }) {
  return <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c }} />;
}
