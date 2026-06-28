"use client";

import type { DataCoverage, Fundamentals } from "@/lib/types";
import { Tooltip } from "./Tooltip";

/**
 * Provenance indicator: shows whether a holding's data is live, partially live,
 * or running on the bundled snapshot — so a frozen value is never silently
 * presented as if it were live. Backed by `Position.dataSource` /
 * `Fundamentals.provenance`.
 */

const META: Record<
  DataCoverage,
  { label: string; dot: string; text: string; blurb: string }
> = {
  live: {
    label: "Live",
    dot: "bg-pos",
    text: "text-pos",
    blurb:
      "Live data — price and the risk-critical fundamentals (beta, volatility, sector) come from a live provider.",
  },
  partial: {
    label: "Partial",
    dot: "bg-warn",
    text: "text-warn",
    blurb:
      "Partially live — some values are from a live provider, others fall back to the bundled snapshot.",
  },
  fallback: {
    label: "Snapshot",
    dot: "border border-warn/70",
    text: "text-warn",
    blurb:
      "No live data — running on the bundled snapshot / conservative defaults. These values may be stale.",
  },
};

/** Risk-critical fields whose staleness is worth calling out by name. */
const CRITICAL: { key: keyof Fundamentals; label: string }[] = [
  { key: "beta", label: "beta" },
  { key: "volatility", label: "volatility" },
  { key: "sector", label: "sector" },
];

function staleCriticalFields(fundamentals?: Fundamentals | null): string[] {
  const fields = fundamentals?.provenance?.fields;
  if (!fields) return [];
  return CRITICAL.filter((c) => fields[c.key] !== "live").map((c) => c.label);
}

function tooltipContent(source: DataCoverage, fundamentals?: Fundamentals | null) {
  const stale = source === "live" ? [] : staleCriticalFields(fundamentals);
  return (
    <div className="space-y-1">
      <div className={`font-medium ${META[source].text}`}>{META[source].label}</div>
      <div>{META[source].blurb}</div>
      {stale.length > 0 && (
        <div className="text-faint">
          From snapshot: {stale.join(", ")}
        </div>
      )}
    </div>
  );
}

/** A small provenance dot. Compact enough to sit next to a ticker symbol. */
export function DataSourceDot({
  source,
  fundamentals,
  className = "",
}: {
  source: DataCoverage;
  fundamentals?: Fundamentals | null;
  className?: string;
}) {
  const m = META[source];
  return (
    <Tooltip content={tooltipContent(source, fundamentals)} underline={false} maxWidth={240}>
      <span
        aria-label={`Data source: ${m.label}`}
        className={`inline-block h-[7px] w-[7px] shrink-0 rounded-full ${m.dot} ${className}`}
      />
    </Tooltip>
  );
}

/**
 * Inline legend summarizing data liveness across a set of holdings, e.g.
 * "● 12 live · ● 3 snapshot". Buckets with zero count are omitted.
 */
export function DataCoverageSummary({
  sources,
  className = "",
}: {
  sources: DataCoverage[];
  className?: string;
}) {
  const counts: Record<DataCoverage, number> = {
    live: 0,
    partial: 0,
    fallback: 0,
  };
  for (const s of sources) counts[s]++;

  const order: DataCoverage[] = ["live", "partial", "fallback"];
  const shown = order.filter((s) => counts[s] > 0);
  if (shown.length === 0) return null;

  const allLive = counts.live === sources.length;
  const summary = allLive
    ? "Every holding is on live data."
    : "Holdings running on the bundled snapshot are marked; their values may be stale.";

  return (
    <Tooltip
      content={<div className="space-y-1">{summary}</div>}
      underline={false}
      maxWidth={240}
    >
      <span className={`inline-flex items-center gap-2 font-mono text-[10px] ${className}`}>
        {shown.map((s, i) => (
          <span key={s} className="inline-flex items-center gap-1">
            {i > 0 && <span className="mr-1 text-edge2">·</span>}
            <span className={`inline-block h-[6px] w-[6px] rounded-full ${META[s].dot}`} />
            <span className={META[s].text}>
              {counts[s]} {META[s].label.toLowerCase()}
            </span>
          </span>
        ))}
      </span>
    </Tooltip>
  );
}
