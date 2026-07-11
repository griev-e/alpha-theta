"use client";

import { m, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useElementWidth } from "@/lib/useElementWidth";
import { fmtNum } from "@/lib/format";
import type { TradeSimResult } from "@/lib/vega/simulate";

/**
 * The expectancy simulator's fan — bootstrap quantile bands of cumulative R
 * over the next N trades, drawn from the trader's own closed-trade
 * distribution. Layered 10–90 and 25–75 bands, gold median, zero line, and a
 * crosshair readout. Hand-built SVG, house rule.
 */

const GOLD = "var(--color-gold)";

export function SimFan({ result, height = 300 }: { result: TradeSimResult; height?: number }) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const PAD = { top: 14, right: 52, bottom: 26, left: 10 };
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const { bands, horizon } = result;

  const geom = useMemo(() => {
    if (plotW <= 0) return null;
    let lo = Math.min(0, ...bands.p10);
    let hi = Math.max(0, ...bands.p90);
    const pad = (hi - lo) * 0.08 || 1;
    lo -= pad;
    hi += pad;
    const x = (s: number) => PAD.left + (s / (horizon - 1)) * plotW;
    const y = (v: number) => PAD.top + ((hi - v) / (hi - lo)) * plotH;
    const line = (vals: number[]) =>
      vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join("");
    const area = (top: number[], bot: number[]) =>
      line(top) +
      [...bot]
        .map((v, i) => ({ v, i }))
        .reverse()
        .map(({ v, i }) => `L${x(i).toFixed(2)},${y(v).toFixed(2)}`)
        .join("") +
      "Z";
    return { x, y, lo, hi, line, area };
  }, [bands, horizon, plotW, plotH, PAD.left, PAD.top]);

  if (!geom) return <div ref={wrapRef} style={{ height }} className="w-full" />;
  const { x, y, lo, hi, line, area } = geom;

  const yTicks: number[] = [];
  {
    const span = hi - lo;
    const step = span > 60 ? 20 : span > 30 ? 10 : span > 12 ? 5 : span > 6 ? 2 : 1;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) yTicks.push(v);
  }
  const xTicks = [0, Math.round(horizon / 4), Math.round(horizon / 2), Math.round((3 * horizon) / 4), horizon - 1];

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        className="block"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const idx = Math.round(((e.clientX - rect.left - PAD.left) / plotW) * (horizon - 1));
          setHover(idx >= 0 && idx < horizon ? idx : null);
        }}
        onMouseLeave={() => setHover(null)}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} stroke={v === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.05)"} strokeDasharray={v === 0 ? undefined : "3 5"} />
            <text x={PAD.left + plotW + 8} y={y(v) + 3} className="font-mono" style={{ fontSize: 9 }} fill="var(--color-faint)">
              {v > 0 ? `+${v}R` : `${v}R`}
            </text>
          </g>
        ))}
        {xTicks.map((s) => (
          <text key={s} x={x(s)} y={height - 8} textAnchor="middle" className="font-mono" style={{ fontSize: 9 }} fill="var(--color-faint)">
            {s + 1}
          </text>
        ))}

        <m.path
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7 }}
          d={area(bands.p90, bands.p10)}
          fill={GOLD}
          fillOpacity="0.06"
        />
        <m.path
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.12 }}
          d={area(bands.p75, bands.p25)}
          fill={GOLD}
          fillOpacity="0.11"
        />
        <m.path
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          d={line(bands.p50)}
          fill="none"
          stroke={GOLD}
          strokeWidth="1.7"
        />
        <path d={line(bands.p90)} fill="none" stroke={GOLD} strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 3" />
        <path d={line(bands.p10)} fill="none" stroke={GOLD} strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 3" />

        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(bands.p50[hover])} r={2.8} fill={GOLD} />
          </g>
        )}
      </svg>

      {hover !== null && (
        <ChartTooltip left={Math.min(Math.max(x(hover), 120), width - 120)} top={PAD.top + 4} place="bottom">
          <div className="font-mono text-[10.5px] leading-relaxed">
            <div className="text-faint">after trade {hover + 1}</div>
            <div className="tnum">
              <span className="text-faint">P90 </span>
              <span className="text-pos">{fmtNum(bands.p90[hover], 1)}R</span>
              <span className="ml-2 text-faint">med </span>
              <span className="text-gold">{fmtNum(bands.p50[hover], 1)}R</span>
              <span className="ml-2 text-faint">P10 </span>
              <span className="text-neg">{fmtNum(bands.p10[hover], 1)}R</span>
            </div>
          </div>
        </ChartTooltip>
      )}
    </div>
  );
}
