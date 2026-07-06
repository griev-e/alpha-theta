"use client";

import { useState } from "react";
import { m } from "framer-motion";
import { fmtPct, fmtUSDCompact } from "@/lib/format";

/** Terminal-value distribution with target threshold coloring. */
export function Histogram({
  bins,
  target,
  height = 160,
}: {
  bins: { x0: number; x1: number; count: number }[];
  target: number;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...bins.map((b) => b.count), 1);
  const total = bins.reduce((s, b) => s + b.count, 0);
  const hb = hover !== null ? bins[hover] : null;

  // Position of the target threshold along the x-axis, so the split between
  // "made it" and "fell short" is marked explicitly rather than only implied by
  // the bar coloring. Null when the target sits outside the plotted range.
  const lo = bins[0]?.x0 ?? 0;
  const hi = bins[bins.length - 1]?.x1 ?? 1;
  const targetFrac =
    target > lo && target < hi && hi > lo ? (target - lo) / (hi - lo) : null;

  return (
    <div className="relative">
      {/* Hover read-out: how many simulated outcomes landed in this bucket. */}
      {hb && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-edge2 bg-[var(--color-elevated)] px-2.5 py-1.5 text-[11px] leading-tight shadow-[0_8px_28px_-6px_rgba(0,0,0,0.85)]"
          style={{
            left: `${((hover! + 0.5) / bins.length) * 100}%`,
            top: -6,
          }}
        >
          <div className="font-mono tnum text-ink">
            {hb.count.toLocaleString()} outcome{hb.count === 1 ? "" : "s"}
          </div>
          <div className="font-mono tnum text-faint">
            {fmtUSDCompact(hb.x0)} – {fmtUSDCompact(hb.x1)} ·{" "}
            {fmtPct(total > 0 ? hb.count / total : 0, 1)}
          </div>
        </div>
      )}

      <div
        className="relative flex items-end gap-[2px]"
        style={{ height }}
        role="img"
        aria-label={`Distribution of ${total} simulated outcomes from ${fmtUSDCompact(
          bins[0]?.x0 ?? 0
        )} to ${fmtUSDCompact(bins[bins.length - 1]?.x1 ?? 0)}.`}
      >
        {/* Shaded shortfall region — everything below the target, tinted rose,
            so "fell short" reads as an area, not only as bar coloring. */}
        {targetFrac !== null && targetFrac > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-0 rounded-l-[3px]"
            style={{
              width: `${targetFrac * 100}%`,
              background: "color-mix(in srgb, var(--color-neg) 4%, transparent)",
            }}
          />
        )}
        {targetFrac !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 z-[1]"
            style={{ left: `${targetFrac * 100}%` }}
          >
            <div
              className="h-full w-px -translate-x-1/2"
              style={{
                borderLeft:
                  "1px dashed color-mix(in srgb, var(--color-warn) 55%, transparent)",
              }}
            />
            <span className="absolute -top-1 left-0 -translate-x-1/2 rounded bg-warn/15 px-1 py-px font-mono text-[9px] leading-none text-warn">
              target
            </span>
          </div>
        )}
        {bins.map((b, i) => {
          const aboveTarget = target > 0 && b.x0 >= target;
          return (
            <m.div
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              className="flex-1 rounded-t-[3px]"
              style={{
                background: aboveTarget
                  ? "linear-gradient(180deg, rgba(94,234,212,0.85), rgba(94,234,212,0.25))"
                  : "linear-gradient(180deg, color-mix(in srgb, var(--color-track) 40%, transparent), color-mix(in srgb, var(--color-track) 12%, transparent))",
                filter: hover === i ? "brightness(1.4)" : undefined,
              }}
              initial={{ height: 0 }}
              animate={{ height: `${(b.count / max) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.012, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-faint">
        <span>{fmtUSDCompact(bins[0]?.x0 ?? 0)}</span>
        <span>{fmtUSDCompact(bins[bins.length - 1]?.x1 ?? 0)}</span>
      </div>
    </div>
  );
}
