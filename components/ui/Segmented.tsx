"use client";

import { m } from "framer-motion";
import { useId } from "react";

/**
 * Small pill-group toggle — the "Holdings / Sector" switcher shape, reused
 * anywhere a page needs to pick one of a few short-labeled views (chart mode,
 * chart range, …) instead of restating the same bordered button row per page.
 *
 * The active option is marked by a single thumb that *slides* between choices
 * (a shared-layout spring, the same motion as the sidebar's active-row pill)
 * rather than the fill snapping on and off — the small tactile detail that
 * reads as considered rather than functional.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
}) {
  // Distinct per instance so multiple Segmented controls on one page don't
  // animate their thumbs across each other.
  const group = useId();
  return (
    <div className="flex gap-0.5 rounded-md border border-edge p-0.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`relative rounded px-2 py-0.5 font-mono text-[10.5px] transition-colors ${
              active ? "text-ink" : "text-faint hover:text-ink"
            }`}
          >
            {active && (
              <m.span
                layoutId={`seg-${group}`}
                className="absolute inset-0 rounded bg-white/[0.08]"
                style={{ boxShadow: "var(--edge-hi)" }}
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
