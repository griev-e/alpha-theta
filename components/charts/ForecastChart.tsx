"use client";

import { useId, useMemo, useState } from "react";
import { useElementWidth } from "@/lib/useElementWidth";
import { fmtUSD } from "@/lib/format";
import { ChartFlag } from "@/components/charts/ChartFlag";
import type { ForecastResult } from "@/lib/theta/forecast";

/**
 * Cash-flow forecast — hand-built SVG (no chart library). Projects the liquid
 * balance forward day by day: an area+line split at today's starting balance
 * (green above, rose below), the running-balance low annotated with a ChartFlag
 * (§50), and a faint zero line drawn only when the projection dips toward an
 * overdraft. Pointer tracking gives a crosshair with the date + balance.
 */
export function ForecastChart({
  forecast,
  height = 220,
}: {
  forecast: ForecastResult;
  height?: number;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId();

  const points = forecast.points;

  const geom = useMemo(() => {
    if (points.length < 2 || width <= 0) return null;
    const vals = points.map((p) => p.balance);
    const start = vals[0];
    const rawLo = Math.min(...vals);
    const rawHi = Math.max(...vals);
    // Keep the zero line in view when the projection threatens an overdraft.
    let lo = Math.min(rawLo, start, forecast.lowBalanceDate ? 0 : rawLo);
    let hi = Math.max(rawHi, start);
    const span = hi - lo || 1;
    lo -= span * 0.1;
    hi += span * 0.1;

    const x = (i: number) => (i / (vals.length - 1)) * width;
    const y = (v: number) => height - ((v - lo) / (hi - lo)) * height;

    const line = vals
      .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(" ");
    const baselineY = y(start);
    const areaBase = `${line} L${width.toFixed(1)} ${baselineY.toFixed(1)} L0 ${baselineY.toFixed(1)} Z`;

    const minIdx = points.findIndex((p) => p.date === forecast.minDate);
    const zeroY = lo <= 0 && hi >= 0 ? y(0) : null;

    return { vals, start, x, y, line, baselineY, areaBase, minIdx, zeroY };
  }, [points, width, height, forecast.minDate, forecast.lowBalanceDate]);

  if (points.length < 2) {
    return (
      <div
        style={{ height }}
        className="flex w-full items-center justify-center text-[12px] text-faint"
      >
        Not enough data to project cash flow
      </div>
    );
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!geom || width <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (points.length - 1)));
  };

  const hoverPoint = hover !== null ? points[hover] : null;
  const tipLeft =
    geom && hover !== null ? Math.min(Math.max(geom.x(hover), 54), width - 54) : 0;

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
              aria-label={`Projected liquid balance over ${points.length - 1} days, lowest ${fmtUSD(
                forecast.minBalance,
                true
              )}.`}
            >
              <defs>
                <linearGradient id={`${gradId}-up`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-pos)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--color-pos)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`${gradId}-dn`} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="var(--color-neg)" stopOpacity={0.22} />
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

              {/* zero line — only drawn when an overdraft is in view */}
              {geom.zeroY !== null && (
                <line
                  x1={0}
                  x2={width}
                  y1={geom.zeroY}
                  y2={geom.zeroY}
                  stroke="color-mix(in srgb, var(--color-neg) 45%, transparent)"
                  strokeDasharray="2 4"
                />
              )}

              {/* baseline at today's starting balance */}
              <line
                x1={0}
                x2={width}
                y1={geom.baselineY}
                y2={geom.baselineY}
                stroke="rgba(255,255,255,0.12)"
                strokeDasharray="3 4"
              />

              {/* split fill: green above the starting balance, rose below */}
              <path d={geom.areaBase} fill={`url(#${gradId}-up)`} clipPath={`url(#${gradId}-above)`} />
              <path d={geom.areaBase} fill={`url(#${gradId}-dn)`} clipPath={`url(#${gradId}-below)`} />
              <path
                d={geom.line}
                fill="none"
                stroke="var(--color-vio)"
                strokeWidth={1.7}
                strokeLinejoin="round"
              />

              {/* the running-balance low, annotated (§50) */}
              {geom.minIdx > 0 && (
                <>
                  <ChartFlag
                    orientation="x"
                    at={geom.x(geom.minIdx)}
                    start={0}
                    end={height}
                    glyph="▼"
                    color="var(--color-warn)"
                    label={`Lowest projected balance ${fmtUSD(forecast.minBalance, true)} on ${fmtLong(
                      forecast.minDate
                    )}`}
                  />
                  <circle
                    cx={geom.x(geom.minIdx)}
                    cy={geom.y(forecast.minBalance)}
                    r={3.2}
                    fill="var(--color-warn)"
                    stroke="var(--color-void)"
                    strokeWidth={2}
                  />
                </>
              )}

              {/* today marker */}
              <circle cx={geom.x(0)} cy={geom.baselineY} r={3} fill="var(--color-vio)" />

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
                    cy={geom.y(points[hover].balance)}
                    r={4}
                    fill="var(--color-vio)"
                    stroke="var(--color-void)"
                    strokeWidth={2}
                  />
                </>
              )}
            </svg>

            {hoverPoint && (
              <div
                className="overlay pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap px-2.5 py-1.5 text-center"
                style={{ left: tipLeft }}
              >
                <div className="font-mono tnum text-[13px] text-ink">
                  {fmtUSD(hoverPoint.balance, true)}
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-faint">
                  {fmtLong(hoverPoint.date)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* time axis: today → horizon end */}
      <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
        <span>Today</span>
        <span>{fmtLong(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}

function fmtLong(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
