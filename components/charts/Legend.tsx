"use client";

export interface LegendItem {
  label: string;
  /** CSS color for the mark. */
  color: string;
  /** Optional trailing value (a percentage, a figure). */
  value?: string;
  /** Mark shape: a filled swatch, a thin line/tick, or a dot. */
  mark?: "swatch" | "line" | "dot";
}

/**
 * Shared chart legend — a swatch/line/dot mark, a label, and an optional value.
 * Replaces the hand-rolled key rows scattered across the chart cards so every
 * legend reads with one grammar. Horizontal by default (a compact key in a card
 * header); `vertical` stacks it for a side list.
 */
export function Legend({
  items,
  vertical = false,
  className = "",
}: {
  items: LegendItem[];
  vertical?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex ${
        vertical ? "flex-col gap-1.5" : "flex-wrap items-center gap-x-3 gap-y-1"
      } font-mono text-[10px] text-faint ${className}`}
    >
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <Mark mark={it.mark ?? "swatch"} color={it.color} />
          <span className={vertical ? "flex-1 text-mute" : ""}>{it.label}</span>
          {it.value && <span className="tnum text-mute">{it.value}</span>}
        </span>
      ))}
    </div>
  );
}

function Mark({ mark, color }: { mark: NonNullable<LegendItem["mark"]>; color: string }) {
  if (mark === "line") {
    return (
      <span
        aria-hidden
        className="inline-block h-2.5 w-px"
        style={{ background: color }}
      />
    );
  }
  if (mark === "dot") {
    return (
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 rounded-sm"
      style={{ background: color }}
    />
  );
}
