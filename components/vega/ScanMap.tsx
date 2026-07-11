"use client";

import { m, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useElementWidth } from "@/lib/useElementWidth";
import { fmtNum } from "@/lib/format";
import type { ScanRow } from "@/lib/vega/scan";

/**
 * The scanner's battle map — every watched symbol placed by overnight gap (x)
 * against relative volume (y), sized by cross-sectional heat and colored by
 * its move off the open. The guides are the two lines that actually mean
 * something to a day trader: a flat open (gap 0) and an average tape
 * (RVOL 1). Bubbles glide on springs as each 30s poll re-ranks the board.
 */

const POS = "var(--color-pos)";
const NEG = "var(--color-neg)";

export function ScanMap({
  rows,
  onSelect,
  height = 320,
}: {
  rows: ScanRow[];
  onSelect?: (symbol: string) => void;
  height?: number;
}) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const PAD = { top: 18, right: 22, bottom: 30, left: 46 };

  const points = useMemo(
    () => rows.filter((r) => r.gapPct !== null && r.rvol !== null),
    [rows]
  );

  const geom = useMemo(() => {
    if (points.length === 0 || width <= 0) return null;
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    // Symmetric gap axis around 0 so the flat-open line sits mid-plot.
    const gapMax = Math.max(0.01, ...points.map((p) => Math.abs(p.gapPct as number))) * 1.15;
    const rvolMax = Math.max(2.2, ...points.map((p) => p.rvol as number)) * 1.1;
    const x = (gap: number) => PAD.left + ((gap + gapMax) / (2 * gapMax)) * plotW;
    const y = (rvol: number) => PAD.top + (1 - rvol / rvolMax) * plotH;
    return { x, y, gapMax, rvolMax, plotW, plotH };
  }, [points, width, height, PAD.left, PAD.top]);

  if (!geom || points.length < 3) {
    return (
      <div ref={wrapRef} style={{ height }} className="flex w-full items-center justify-center">
        <p className="px-6 text-center text-[12px] text-faint">
          The map draws once at least three symbols have a gap and RVOL reading.
        </p>
      </div>
    );
  }

  const { x, y, gapMax, rvolMax } = geom;
  const hovered = points.find((p) => p.symbol === hover) ?? null;
  const gapTicks = [-gapMax * 0.6, 0, gapMax * 0.6];

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <svg width={width} height={height} className="block">
        {/* Meaningful guides: flat open & average tape. */}
        <line x1={x(0)} x2={x(0)} y1={PAD.top} y2={height - PAD.bottom} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 4" />
        <line x1={PAD.left} x2={width - PAD.right} y1={y(1)} y2={y(1)} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 4" />
        <text x={x(0)} y={height - 8} textAnchor="middle" className="font-mono" style={{ fontSize: 9 }} fill="var(--color-faint)">
          flat open
        </text>
        <text x={PAD.left - 6} y={y(1) + 3} textAnchor="end" className="font-mono" style={{ fontSize: 9 }} fill="var(--color-faint)">
          1×
        </text>

        {/* Axis labels */}
        {gapTicks.map((g) => (
          <text key={g} x={x(g)} y={height - 18} textAnchor="middle" className="font-mono" style={{ fontSize: 9 }} fill="var(--color-faint)">
            {g === 0 ? "" : `${g > 0 ? "+" : ""}${(g * 100).toFixed(1)}%`}
          </text>
        ))}
        {[Math.round(rvolMax * 0.5 * 10) / 10, Math.round(rvolMax * 0.9 * 10) / 10].map((v) => (
          <text key={v} x={PAD.left - 6} y={y(v) + 3} textAnchor="end" className="font-mono" style={{ fontSize: 9 }} fill="var(--color-faint)">
            {v}×
          </text>
        ))}
        <text x={width - PAD.right} y={height - 8} textAnchor="end" className="font-mono" style={{ fontSize: 9 }} fill="var(--color-faint)">
          gap →
        </text>
        <text x={PAD.left - 32} y={PAD.top + 8} className="font-mono" style={{ fontSize: 9 }} fill="var(--color-faint)">
          rvol ↑
        </text>

        {/* Bubbles — spring to new positions each poll. */}
        {points.map((p, i) => {
          const up = (p.fromOpenPct ?? p.changePct ?? 0) >= 0;
          const color = up ? POS : NEG;
          const r = 7 + ((p.score ?? 30) / 100) * 13;
          const cx = x(p.gapPct as number);
          const cy = y(p.rvol as number);
          const dim = hover !== null && hover !== p.symbol;
          return (
            <m.g
              key={p.symbol}
              initial={reduce ? false : { opacity: 0, scale: 0.4 }}
              animate={{ opacity: dim ? 0.35 : 1, scale: 1, x: cx, y: cy }}
              transition={{
                x: { type: "spring", stiffness: 60, damping: 18 },
                y: { type: "spring", stiffness: 60, damping: 18 },
                opacity: { duration: 0.25 },
                scale: { type: "spring", stiffness: 120, damping: 16, delay: reduce ? 0 : i * 0.03 },
              }}
              style={{ cursor: onSelect ? "pointer" : "default" }}
              onMouseEnter={() => setHover(p.symbol)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(p.symbol)}
            >
              <circle r={r} fill={color} fillOpacity="0.13" stroke={color} strokeOpacity="0.75" strokeWidth="1.2" />
              <text y={-r - 4} textAnchor="middle" className="font-mono" style={{ fontSize: 9.5 }} fill={dim ? "var(--color-faint)" : "var(--color-mute)"}>
                {p.symbol}
              </text>
            </m.g>
          );
        })}
      </svg>

      {hovered && (
        <ChartTooltip
          left={Math.min(Math.max(x(hovered.gapPct as number), 110), width - 110)}
          top={Math.max(10, y(hovered.rvol as number) - 8)}
          place="top"
        >
          <div className="font-mono text-[10.5px] leading-relaxed">
            <div className="text-ink">{hovered.symbol}</div>
            <div className="text-faint">
              gap <span className="text-mute">{fmtNum((hovered.gapPct as number) * 100, 1)}%</span>
              {" · "}rvol <span className="text-mute">{fmtNum(hovered.rvol as number, 1)}×</span>
              {hovered.score !== null && (
                <>
                  {" · "}heat <span className="text-gold">{hovered.score}</span>
                </>
              )}
            </div>
          </div>
        </ChartTooltip>
      )}
    </div>
  );
}
