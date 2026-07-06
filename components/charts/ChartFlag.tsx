"use client";

/**
 * ChartFlag — the shared annotation primitive for the SVG chart family.
 *
 * A single dashed guide line plus an optional glyph chip, in two orientations:
 *  - `x` (default): a vertical guide at pixel `at`, chip near the bottom — a
 *    moment in time (an earnings date, a dividend ex-date, a forecast low).
 *  - `y`: a horizontal guide at pixel `at`, chip at the right — a reference
 *    level (a target, a threshold band edge).
 *
 * Rendered as plain SVG so any hand-built chart can drop it in as a child; the
 * full description rides on a native `<title>` so hovering the chip explains
 * the mark without a separate tooltip layer. Annotate computed facts, never
 * opinions — the guardrail from the V2 direction.
 */
export function ChartFlag({
  orientation = "x",
  at,
  start,
  end,
  label,
  glyph,
  color = "var(--color-faint)",
  dashed = true,
}: {
  orientation?: "x" | "y";
  /** Pixel coordinate on the flagged axis (x for vertical, y for horizontal). */
  at: number;
  /** Guide-line extent on the cross axis, in pixels (e.g. plot top → bottom). */
  start: number;
  end: number;
  /** Full text shown on hover via a native title. */
  label: string;
  /** 1–2 char chip glyph; omit for a bare reference line. */
  glyph?: string;
  color?: string;
  dashed?: boolean;
}) {
  const vertical = orientation === "x";
  const line = vertical
    ? { x1: at, x2: at, y1: start, y2: end }
    : { x1: start, x2: end, y1: at, y2: at };
  // Chip sits at the far end of the guide, inset so it never clips the edge.
  const cx = vertical ? at : end - 9;
  const cy = vertical ? end - 9 : at;

  return (
    <g>
      <title>{label}</title>
      <line
        x1={line.x1}
        x2={line.x2}
        y1={line.y1}
        y2={line.y2}
        stroke={color}
        strokeOpacity={0.5}
        strokeWidth={1}
        strokeDasharray={dashed ? "3 4" : undefined}
      />
      {glyph && (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={7}
            fill="color-mix(in srgb, var(--color-void) 82%, transparent)"
            stroke={color}
            strokeWidth={1.2}
          />
          <text
            x={cx}
            y={cy + 0.5}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={color}
            className="font-mono"
            style={{ fontSize: 8.5, fontWeight: 600 }}
          >
            {glyph}
          </text>
        </>
      )}
    </g>
  );
}
