"use client";

import { useId, useMemo, useState } from "react";
import { useElementWidth } from "@/lib/useElementWidth";
import { fmtPct, fmtUSD } from "@/lib/format";
import type { HistoryPoint, HistoryRange } from "@/lib/research/types";

/**
 * Interactive price-history chart — hand-built SVG (no chart library). Area +
 * line with a dashed baseline at the period's first close, so the gain/loss
 * over the window reads at a glance. Pointer tracking draws a crosshair and a
 * floating tooltip with the date and price at the hovered bar.
 */
export function PriceChart({
  points,
  range,
  height = 260,
  currency = "USD",
}: {
  points: HistoryPoint[];
  range: HistoryRange;
  height?: number;
  currency?: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId();

  const geom = useMemo(() => {
    if (points.length < 2 || width <= 0) return null;
    const closes = points.map((p) => p.c);
    const first = closes[0];
    const dataLo = Math.min(...closes);
    const dataHi = Math.max(...closes);
    let lo = Math.min(dataLo, first);
    let hi = Math.max(dataHi, first);
    const span = hi - lo || 1;
    lo -= span * 0.08;
    hi += span * 0.08;

    const x = (i: number) => (i / (closes.length - 1)) * width;
    const y = (v: number) => height - ((v - lo) / (hi - lo)) * height;

    const line = closes
      .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(" ");
    const area = `${line} L${width.toFixed(1)} ${height} L0 ${height} Z`;
    // Area closed along the first-close baseline rather than the axis floor —
    // clipped above/below the baseline it splits the fill green (in the money)
    // vs rose (under water), the TradingView baseline read.
    const baselineY = y(first);
    const areaBase = `${line} L${width.toFixed(1)} ${baselineY.toFixed(1)} L0 ${baselineY.toFixed(1)} Z`;
    const hiIdx = closes.indexOf(dataHi);
    const loIdx = closes.indexOf(dataLo);

    return { closes, first, dataLo, dataHi, x, y, line, area, baselineY, areaBase, hiIdx, loIdx };
  }, [points, width, height]);

  if (points.length < 2) {
    return (
      <div
        ref={ref}
        style={{ height }}
        className="flex w-full items-center justify-center text-[12px] text-faint"
      >
        No price history available
      </div>
    );
  }

  const last = points[points.length - 1].c;
  const first = points[0].c;
  const up = last >= first;
  const color = up ? "var(--color-pos)" : "var(--color-neg)";

  const ariaLabel = `Price history over the past ${RANGE_LABEL[range]}, ${
    up ? "up" : "down"
  } from ${fmtUSD(first)} to ${fmtUSD(last)}${
    currency !== "USD" ? ` (${currency})` : ""
  }.`;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!geom || width <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (points.length - 1)));
  };

  const hoverPoint = hover !== null ? points[hover] : null;
  const tipLeft =
    geom && hover !== null
      ? Math.min(Math.max(geom.x(hover), 54), width - 54)
      : 0;

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
              aria-label={ariaLabel}
            >
              <defs>
                <linearGradient id={`${gradId}-up`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-pos)" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="var(--color-pos)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`${gradId}-dn`} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="var(--color-neg)" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="var(--color-neg)" stopOpacity={0} />
                </linearGradient>
                <clipPath id={`${gradId}-above`}>
                  <rect x={0} y={0} width={width} height={Math.max(0, geom.baselineY)} />
                </clipPath>
                <clipPath id={`${gradId}-below`}>
                  <rect
                    x={0}
                    y={geom.baselineY}
                    width={width}
                    height={Math.max(0, height - geom.baselineY)}
                  />
                </clipPath>
              </defs>

              {/* baseline at the period's first close */}
              <line
                x1={0}
                x2={width}
                y1={geom.baselineY}
                y2={geom.baselineY}
                stroke="rgba(255,255,255,0.12)"
                strokeDasharray="3 4"
              />

              {/* split fill: green above the baseline, rose below */}
              <path
                d={geom.areaBase}
                fill={`url(#${gradId}-up)`}
                clipPath={`url(#${gradId}-above)`}
              />
              <path
                d={geom.areaBase}
                fill={`url(#${gradId}-dn)`}
                clipPath={`url(#${gradId}-below)`}
              />
              <path
                d={geom.line}
                fill="none"
                stroke={color}
                strokeWidth={1.7}
                strokeLinejoin="round"
              />

              {/* period high / low ticks */}
              {[
                { idx: geom.hiIdx, v: geom.dataHi, up: true },
                { idx: geom.loIdx, v: geom.dataLo, up: false },
              ].map(({ idx, v, up }) => (
                <circle
                  key={up ? "hi" : "lo"}
                  cx={geom.x(idx)}
                  cy={geom.y(v)}
                  r={2.4}
                  fill="var(--color-faint)"
                />
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
                    cy={geom.y(points[hover].c)}
                    r={4}
                    fill={color}
                    stroke="var(--color-void)"
                    strokeWidth={2}
                  />
                </>
              )}

              {/* latest marker — a live endpoint that quietly pulses */}
              {hover === null && (
                <>
                  <circle
                    className="price-pulse"
                    cx={geom.x(points.length - 1)}
                    cy={geom.y(last)}
                    fill={color}
                    style={{ transformOrigin: `${geom.x(points.length - 1)}px ${geom.y(last)}px` }}
                  />
                  <circle
                    cx={geom.x(points.length - 1)}
                    cy={geom.y(last)}
                    r={3.2}
                    fill={color}
                  />
                </>
              )}
            </svg>

            {/* price axis labels */}
            <span className="pointer-events-none absolute right-0 top-0 font-mono text-[10px] text-faint">
              {fmtUSD(geom.dataHi)}
            </span>
            <span className="pointer-events-none absolute bottom-0 right-0 font-mono text-[10px] text-faint">
              {fmtUSD(geom.dataLo)}
            </span>

            {/* hover tooltip — price, the Δ from the period's first close, date */}
            {hoverPoint && (
              <div
                className="overlay pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap px-2.5 py-1.5 text-center"
                style={{ left: tipLeft }}
              >
                <div className="font-mono tnum text-[13px] text-ink">
                  {fmtUSD(hoverPoint.c)}
                </div>
                {(() => {
                  const ret = first > 0 ? hoverPoint.c / first - 1 : 0;
                  return (
                    <div
                      className={`font-mono tnum text-[10.5px] ${
                        ret >= 0 ? "text-pos" : "text-neg"
                      }`}
                    >
                      {ret >= 0 ? "▲" : "▼"} {fmtPct(Math.abs(ret), 2)}
                    </div>
                  );
                })()}
                <div className="mt-0.5 font-mono text-[10px] text-faint">
                  {fmtFullDate(hoverPoint.t)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* time axis */}
      <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
        <span>{fmtAxisDate(points[0].t, range)}</span>
        {currency !== "USD" && <span>{currency}</span>}
        <span>{fmtAxisDate(points[points.length - 1].t, range)}</span>
      </div>
    </div>
  );
}

const RANGE_LABEL: Record<HistoryRange, string> = {
  "1m": "month",
  "6m": "six months",
  "1y": "year",
  "5y": "five years",
};

function fmtFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtAxisDate(iso: string, range: HistoryRange): string {
  const d = new Date(iso);
  if (range === "1m" || range === "6m") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}
