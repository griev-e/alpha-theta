"use client";

import { m } from "framer-motion";
import type { ReactNode } from "react";

/**
 * The shared floating readout for the hand-built SVG charts. One surface (the
 * app's `.overlay` elevation), one type ramp, one motion — so a hover box on the
 * treemap, the price chart, and the heatmap all read as the same instrument
 * rather than each chart speaking its own dialect.
 *
 * Positioned absolutely inside a `position: relative` chart wrapper; the caller
 * passes an anchor point already clamped to the plot. `place="top"` floats the
 * box above the anchor (the default), `"bottom"` below it.
 */
export function ChartTooltip({
  left,
  top,
  place = "top",
  children,
}: {
  left: number;
  top: number;
  place?: "top" | "bottom";
  children: ReactNode;
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: place === "top" ? 3 : -3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
      className="overlay pointer-events-none absolute z-20 whitespace-nowrap px-2.5 py-1.5"
      style={{
        left,
        top,
        transform:
          place === "top"
            ? "translate(-50%, calc(-100% - 8px))"
            : "translate(-50%, 8px)",
      }}
    >
      {children}
    </m.div>
  );
}
