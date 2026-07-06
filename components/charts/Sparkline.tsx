"use client";

import { useId, useState } from "react";
import { useElementWidth } from "@/lib/useElementWidth";

/**
 * Compact line chart with an optional reference baseline. Renders in real
 * pixel coordinates (ResizeObserver) so the line never warps.
 *
 * Pass `labels` (one per value) to make it interactive: a crosshair + a small
 * chip follow the pointer, reading the label and value at the hovered point.
 * Omit `labels` and it stays a static, non-interactive spark (the tiny row
 * sparks elsewhere are unaffected).
 */
export function Sparkline({
  values,
  height = 64,
  baseline,
  color = "var(--color-mint)",
  belowColor,
  labels,
  formatValue,
}: {
  values: number[];
  height?: number;
  /** Draw a dashed reference line at this value (e.g. 0). */
  baseline?: number;
  color?: string;
  /** If set, the line uses this color while the latest value < baseline. */
  belowColor?: string;
  /** One label per value; presence turns on the hover crosshair + readout. */
  labels?: string[];
  /** Formats the hovered value for the readout chip. */
  formatValue?: (v: number) => string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  // Unique per instance so many sparklines can share the page without their
  // gradient defs colliding.
  const gid = useId().replace(/[:]/g, "");

  if (values.length < 2) {
    return <div ref={ref} style={{ height }} className="w-full" />;
  }

  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (baseline !== undefined) {
    lo = Math.min(lo, baseline);
    hi = Math.max(hi, baseline);
  }
  const span = hi - lo || 1;
  const pad = span * 0.08;
  lo -= pad;
  hi += pad;

  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => height - ((v - lo) / (hi - lo)) * height;

  const last = values[values.length - 1];
  const stroke =
    belowColor !== undefined && baseline !== undefined && last < baseline
      ? belowColor
      : color;

  const line = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  const interactive = !!labels && labels.length === values.length;
  const fmt = formatValue ?? ((v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 }));
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || width <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (values.length - 1)));
  };
  const hx = hover !== null ? x(hover) : 0;

  return (
    <div
      ref={ref}
      className={`relative w-full ${interactive ? "touch-none" : ""}`}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="block overflow-visible"
          role="img"
          aria-label={`Trend line, latest value ${last.toFixed(1)}${
            baseline !== undefined
              ? `, ${last < baseline ? "below" : "at or above"} the ${baseline} reference`
              : ""
          }.`}
        >
          <defs>
            {/* Vertical wash under the line — richer than a flat tint: brightest
                just beneath the trace, fading to nothing at the floor. */}
            <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
              <stop offset="70%" stopColor={stroke} stopOpacity={0.04} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#spark-${gid})`} />
          {baseline !== undefined && (
            <line
              x1={0}
              x2={width}
              y1={y(baseline)}
              y2={y(baseline)}
              stroke="rgba(255,255,255,0.14)"
              strokeDasharray="3 4"
            />
          )}
          <path d={line} fill="none" stroke={stroke} strokeWidth={1.6} />
          {/* Endpoint: a soft halo behind a solid dot — the "live tip." */}
          <circle
            cx={x(values.length - 1)}
            cy={y(last)}
            r={5}
            fill={stroke}
            opacity={0.18}
          />
          <circle
            cx={x(values.length - 1)}
            cy={y(last)}
            r={2.8}
            fill={stroke}
          />
          {/* Hover crosshair + point (interactive mode only). */}
          {interactive && hover !== null && (
            <>
              <line x1={hx} x2={hx} y1={0} y2={height} stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
              <circle cx={hx} cy={y(values[hover])} r={3.5} fill={stroke} stroke="var(--color-void)" strokeWidth={1.5} />
            </>
          )}
        </svg>
      )}
      {/* Readout chip — label + value at the hovered point. */}
      {interactive && hover !== null && width > 0 && (
        <div
          className="overlay pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap px-2 py-1 text-center"
          style={{ left: Math.min(Math.max(hx, 40), width - 40) }}
        >
          <div className="font-mono tnum text-[11px] text-ink">{fmt(values[hover])}</div>
          <div className="font-mono text-[9.5px] text-faint">{labels![hover]}</div>
        </div>
      )}
    </div>
  );
}
