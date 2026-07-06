"use client";

/**
 * Axis primitives for the hand-built SVG charts — the 10px mono, faint,
 * track-colored tick grammar, factored out so PriceChart / FanChart / Scatter /
 * the optimizer frontier stop restating it and can't drift apart. Both take
 * ticks already positioned in pixels (each chart owns its own scale), so the
 * primitive only owns the *look*, never the math.
 */

export interface AxisTick {
  /** Pixel position along the axis. */
  pos: number;
  label: string;
}

/** Horizontal axis: tick labels at given x positions on a shared baseline. */
export function AxisX({
  ticks,
  y,
  textAnchor = "middle",
  fontSize = 11,
  color = "var(--color-faint)",
}: {
  ticks: AxisTick[];
  /** Baseline y for the labels. */
  y: number;
  textAnchor?: "start" | "middle" | "end";
  fontSize?: number;
  color?: string;
}) {
  return (
    <g>
      {ticks.map((t, i) => (
        <text
          key={i}
          x={t.pos}
          y={y}
          textAnchor={textAnchor}
          fill={color}
          className="font-mono"
          style={{ fontSize }}
        >
          {t.label}
        </text>
      ))}
    </g>
  );
}

/**
 * Vertical axis: a gridline per tick plus a value label. Labels sit to the left
 * of the grid by default; pass `labelSide="right"` for charts that keep their
 * scale on the right (e.g. the projection fan).
 */
export function AxisY({
  ticks,
  gridFrom,
  gridTo,
  labelX,
  labelSide = "left",
  fontSize = 10,
  gridOpacityPct = 8,
  color = "var(--color-faint)",
}: {
  ticks: AxisTick[];
  /** Gridline x extent. */
  gridFrom: number;
  gridTo: number;
  /** X for the label (defaults just outside the grid on the chosen side). */
  labelX?: number;
  /** Which side the labels sit on. */
  labelSide?: "left" | "right";
  fontSize?: number;
  /** Track-color gridline opacity, as a whole-number percent. */
  gridOpacityPct?: number;
  color?: string;
}) {
  const right = labelSide === "right";
  const lx = labelX ?? (right ? gridTo + 6 : gridFrom - 8);
  return (
    <g>
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={gridFrom}
            x2={gridTo}
            y1={t.pos}
            y2={t.pos}
            stroke={`color-mix(in srgb, var(--color-track) ${gridOpacityPct}%, transparent)`}
          />
          {t.label && (
            <text
              x={lx}
              y={t.pos + 3}
              textAnchor={right ? "start" : "end"}
              fill={color}
              className="font-mono"
              style={{ fontSize }}
            >
              {t.label}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}
