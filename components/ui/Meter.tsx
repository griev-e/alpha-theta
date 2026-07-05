"use client";

import { m } from "framer-motion";
import { Tooltip } from "./Tooltip";

/**
 * Animated horizontal bar with an optional benchmark tick. `value` and
 * `benchmark` are fractions of `max`. Pass `overColor` to swap in a different
 * fill (e.g. a warning red) once `value` exceeds `max` — the shape theta's
 * budget bars need — instead of a separate bar component.
 */
export function Meter({
  value,
  max = 1,
  benchmark,
  benchmarkLabel = "Benchmark",
  color = "var(--color-mint)",
  overColor,
  height = 7,
  delay = 0,
}: {
  value: number;
  max?: number;
  benchmark?: number;
  /** Tooltip on the benchmark tick — "Benchmark" for the index, or e.g.
   *  "On pace" when the tick marks an elapsed-time reference. */
  benchmarkLabel?: string;
  color?: string;
  overColor?: string;
  height?: number;
  delay?: number;
}) {
  const ratio = max > 0 ? value / max : 0;
  const over = overColor !== undefined && ratio > 1;
  const fill = over ? overColor : color;
  const frac = Math.max(0, Math.min(1, ratio));
  const benchFrac =
    benchmark !== undefined && max > 0
      ? Math.max(0, Math.min(1, benchmark / max))
      : null;
  return (
    <div
      className="relative w-full overflow-visible rounded-full bg-white/[0.05]"
      style={{ height }}
    >
      <m.div
        className="h-full rounded-full"
        style={{
          // color-mix keeps the alpha ramp valid for hex *and* var() colors
          background: `linear-gradient(90deg, color-mix(in srgb, ${fill} 35%, transparent), ${fill})`,
          boxShadow: `0 0 12px -2px color-mix(in srgb, ${fill} 40%, transparent)`,
        }}
        initial={{ width: 0 }}
        animate={{ width: `${frac * 100}%` }}
        transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      />
      {benchFrac !== null && (
        <Tooltip content={benchmarkLabel} underline={false}>
          <m.div
            className="absolute top-1/2 w-[2px] rounded-full bg-vio"
            style={{ height: height + 8, translateY: "-50%" }}
            initial={{ left: 0, opacity: 0 }}
            animate={{ left: `${benchFrac * 100}%`, opacity: 0.9 }}
            transition={{ duration: 0.8, delay: delay + 0.15 }}
          />
        </Tooltip>
      )}
    </div>
  );
}
