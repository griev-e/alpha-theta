"use client";

import type { ReactNode } from "react";
import { Tooltip } from "./Tooltip";

/**
 * Honesty marker for a *modeled* number — the counterpart to
 * {@link DataSourceDot}, which marks data provenance. Where a figure is derived
 * from assumptions or a model rather than measured (the Monte Carlo target
 * probability, CAPM expected return / Sharpe, scenario magnitudes, style-tilt
 * scores), this badge says so explicitly, so a precise-looking value never reads
 * as more certain than its inputs justify.
 *
 * Pass a short `detail` describing what makes it modeled (e.g. the assumption it
 * hinges on); it renders in the hover tooltip alongside the standard blurb.
 */
export function ModelBadge({
  detail,
  label = "modeled",
  className = "",
}: {
  detail?: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <Tooltip
      underline={false}
      maxWidth={260}
      content={
        <div className="space-y-1">
          <div className="font-medium text-warn">Modeled estimate</div>
          <div>
            A model-based figure, not a measured value — read it as an
            indication, not a precise number or a forecast.
          </div>
          {detail && <div className="text-faint">{detail}</div>}
        </div>
      }
    >
      <span
        aria-label="Modeled estimate"
        className={`inline-flex items-center gap-1 rounded border border-warn/40 px-1 py-[1px] font-mono text-[9px] uppercase tracking-wide text-warn/90 ${className}`}
      >
        <span className="inline-block h-[5px] w-[5px] rounded-full border border-warn/70" />
        {label}
      </span>
    </Tooltip>
  );
}
