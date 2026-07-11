"use client";

import { m, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useElementWidth } from "@/lib/useElementWidth";
import { fmtNum } from "@/lib/format";
import { macd as macdCalc, rsi as rsiCalc } from "@/lib/vega/indicators";
import type { Bar } from "@/lib/vega/types";
import { CHART_PAD } from "./CandleChart";

export type IndicatorKind = "rsi" | "macd";

const POS = "var(--color-pos)";
const NEG = "var(--color-neg)";

function linePath(
  s: (number | null)[],
  x: (i: number) => number,
  y: (v: number) => number
): string {
  let d = "";
  let pen = false;
  for (let i = 0; i < s.length; i++) {
    const v = s[i];
    if (v === null) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`;
    pen = true;
  }
  return d;
}

/**
 * The oscillator pane under the candle chart — RSI (with its 30/70 zone) or
 * MACD (histogram + line/signal). Shares CHART_PAD with the chart above so
 * every bar aligns to its candle.
 */
export function IndicatorPane({
  bars,
  kind,
  height = 110,
}: {
  bars: Bar[];
  kind: IndicatorKind;
  height?: number;
}) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const n = bars.length;
  const plotW = Math.max(0, width - CHART_PAD.left - CHART_PAD.right);
  const plotH = height - 10;

  const data = useMemo(() => {
    const closes = bars.map((b) => b.c);
    if (kind === "rsi") return { rsi: rsiCalc(closes), macd: null };
    return { rsi: null, macd: macdCalc(closes) };
  }, [bars, kind]);

  if (n === 0 || plotW <= 0) {
    return <div ref={wrapRef} style={{ height }} className="w-full" />;
  }

  const step = plotW / n;
  const x = (i: number) => CHART_PAD.left + (i + 0.5) * step;

  let content: React.ReactNode = null;
  let hoverText: string | null = null;

  if (kind === "rsi" && data.rsi) {
    const y = (v: number) => 5 + ((100 - v) / 100) * plotH;
    const cur = hover !== null ? data.rsi[hover] : data.rsi[n - 1];
    hoverText = cur !== null ? `RSI ${fmtNum(cur, 1)}` : null;
    content = (
      <>
        {/* the 30–70 neutral zone */}
        <rect
          x={CHART_PAD.left}
          y={y(70)}
          width={plotW}
          height={y(30) - y(70)}
          fill="rgba(255,255,255,0.03)"
        />
        {[70, 50, 30].map((v) => (
          <g key={v}>
            <line
              x1={CHART_PAD.left}
              x2={CHART_PAD.left + plotW}
              y1={y(v)}
              y2={y(v)}
              stroke="rgba(148,163,184,0.14)"
              strokeDasharray={v === 50 ? "2 4" : undefined}
            />
            <text
              x={CHART_PAD.left + plotW + 8}
              y={y(v) + 3}
              fill="var(--color-faint)"
              className="font-mono"
              style={{ fontSize: 9.5 }}
            >
              {v}
            </text>
          </g>
        ))}
        <m.path
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          d={linePath(data.rsi, x, y)}
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth="1.4"
        />
      </>
    );
  } else if (kind === "macd" && data.macd) {
    const all = [...data.macd.macd, ...data.macd.signal, ...data.macd.hist].filter(
      (v): v is number => v !== null
    );
    const ext = all.length > 0 ? Math.max(...all.map(Math.abs)) : 1;
    const y = (v: number) => 5 + ((ext - v) / (2 * ext)) * plotH;
    const curM = hover !== null ? data.macd.macd[hover] : data.macd.macd[n - 1];
    const curS = hover !== null ? data.macd.signal[hover] : data.macd.signal[n - 1];
    hoverText =
      curM !== null && curS !== null
        ? `MACD ${fmtNum(curM, 2)} · signal ${fmtNum(curS, 2)}`
        : null;
    content = (
      <>
        <line
          x1={CHART_PAD.left}
          x2={CHART_PAD.left + plotW}
          y1={y(0)}
          y2={y(0)}
          stroke="rgba(148,163,184,0.2)"
        />
        {data.macd.hist.map((v, i) =>
          v === null ? null : (
            <m.rect
              key={i}
              initial={reduce ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              style={{ transformOrigin: `${x(i)}px ${y(0)}px` }}
              transition={{ duration: 0.45, delay: Math.min(0.4, i * 0.002) }}
              x={x(i) - Math.max(0.5, step * 0.3)}
              y={v >= 0 ? y(v) : y(0)}
              width={Math.max(1, step * 0.6)}
              height={Math.abs(y(v) - y(0))}
              fill={v >= 0 ? POS : NEG}
              fillOpacity="0.35"
            />
          )
        )}
        <m.path
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          d={linePath(data.macd.macd, x, y)}
          fill="none"
          stroke="var(--color-sky)"
          strokeWidth="1.3"
        />
        <m.path
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          d={linePath(data.macd.signal, x, y)}
          fill="none"
          stroke="var(--color-vio)"
          strokeWidth="1.2"
          strokeDasharray="3 3"
        />
      </>
    );
  }

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        className="block"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - rect.left - CHART_PAD.left;
          const idx = Math.round(px / step - 0.5);
          setHover(idx >= 0 && idx < n ? idx : null);
        }}
        onMouseLeave={() => setHover(null)}
      >
        {content}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={4}
            y2={height - 4}
            stroke="rgba(255,255,255,0.22)"
            strokeDasharray="3 3"
            pointerEvents="none"
          />
        )}
      </svg>
      {hover !== null && hoverText && (
        <ChartTooltip left={Math.min(Math.max(x(hover), 90), width - 90)} top={2} place="bottom">
          <span className="font-mono tnum text-[10.5px] text-mute">{hoverText}</span>
        </ChartTooltip>
      )}
    </div>
  );
}
