"use client";

import { m, useReducedMotion } from "framer-motion";
import { useId, useMemo, useState } from "react";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useElementWidth } from "@/lib/useElementWidth";
import { fmtUSD, fmtDate } from "@/lib/format";
import type { EquityPoint } from "@/lib/vega/journal";

/**
 * The journal's cumulative P&L — an area chart with the running drawdown
 * shaded beneath the high-water mark, so the cost of every losing streak is
 * visible, not just the summit. Line draws in per the chart grammar.
 */
export function EquityCurve({
  points,
  height = 220,
}: {
  points: EquityPoint[];
  height?: number;
}) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const gid = useId();

  const PAD = { top: 12, right: 56, bottom: 8, left: 8 };
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const n = points.length;

  const scale = useMemo(() => {
    if (n === 0 || plotW <= 0) return null;
    let lo = 0;
    let hi = 0;
    for (const p of points) {
      if (p.equity < lo) lo = p.equity;
      if (p.equity > hi) hi = p.equity;
    }
    if (hi === lo) hi = lo + 1;
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
    return {
      lo,
      hi,
      x: (i: number) => PAD.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW),
      y: (v: number) => PAD.top + ((hi - v) / (hi - lo)) * plotH,
    };
  }, [n, points, plotW, plotH, PAD.left, PAD.top]);

  if (!scale || n === 0) {
    return <div ref={wrapRef} style={{ height }} className="w-full" />;
  }
  const { x, y, lo } = scale;

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.equity).toFixed(2)}`)
    .join("");
  const area = `${line}L${x(n - 1).toFixed(2)},${y(Math.min(0, lo + 1e-9)).toFixed(2)}L${x(0).toFixed(2)},${y(Math.min(0, lo + 1e-9)).toFixed(2)}Z`;
  // High-water mark trace (equity − drawdown = running peak).
  const peakLine = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.equity - p.drawdown).toFixed(2)}`)
    .join("");

  const final = points[n - 1].equity;
  const up = final >= 0;
  const tone = up ? "var(--color-pos)" : "var(--color-neg)";

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        className="block"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - rect.left - PAD.left;
          const idx = Math.round((px / Math.max(1, plotW)) * (n - 1));
          setHover(idx >= 0 && idx < n ? idx : null);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.22" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* zero line */}
        <line
          x1={PAD.left}
          x2={PAD.left + plotW}
          y1={y(0)}
          y2={y(0)}
          stroke="rgba(148,163,184,0.25)"
          strokeDasharray="2 4"
        />
        <text
          x={PAD.left + plotW + 8}
          y={y(0) + 3}
          fill="var(--color-faint)"
          className="font-mono"
          style={{ fontSize: 9.5 }}
        >
          $0
        </text>

        <m.path
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.2 }}
          d={area}
          fill={`url(#${gid}-fill)`}
        />
        {/* the high-water mark — what the curve had to defend */}
        <m.path
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          d={peakLine}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
          strokeDasharray="1 3"
        />
        <m.path
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          d={line}
          fill="none"
          stroke={tone}
          strokeWidth="1.6"
        />

        {hover !== null && (
          <g pointerEvents="none">
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="rgba(255,255,255,0.22)"
              strokeDasharray="3 3"
            />
            <circle cx={x(hover)} cy={y(points[hover].equity)} r={3} fill={tone} />
          </g>
        )}
      </svg>

      {hover !== null && (
        <ChartTooltip
          left={Math.min(Math.max(x(hover), 100), width - 100)}
          top={y(points[hover].equity)}
        >
          <div className="font-mono tnum text-[10.5px] leading-relaxed">
            <div className="text-faint">{fmtDate(points[hover].t)}</div>
            <div className={points[hover].equity >= 0 ? "text-pos" : "text-neg"}>
              {fmtUSD(points[hover].equity)}
            </div>
            {points[hover].drawdown < 0 && (
              <div className="text-faint">
                dd <span className="text-neg">{fmtUSD(points[hover].drawdown)}</span>
              </div>
            )}
          </div>
        </ChartTooltip>
      )}
    </div>
  );
}
