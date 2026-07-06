"use client";

import { useState } from "react";

/**
 * A range input with a value bubble that tracks the thumb while dragging — the
 * tactile "you're setting 12 years" read a bare slider lacks. The chip only
 * appears while the control is active (pointer down or focused), so it
 * complements rather than duplicates the always-visible header value; it fades
 * out on release. Thumb is 16px (see globals.css), so the bubble is inset 8px
 * each end to stay centered over it.
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  format,
  disabled = false,
  className = "",
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  /** Renders the drag bubble label. */
  format: (v: number) => string;
  disabled?: boolean;
  className?: string;
}) {
  const [active, setActive] = useState(false);
  const pct = max > min ? (value - min) / (max - min) : 0;
  return (
    <div className={`relative ${className}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-7 z-10 -translate-x-1/2 transition-opacity duration-150"
        style={{
          left: `calc(${pct} * (100% - 16px) + 8px)`,
          opacity: active && !disabled ? 1 : 0,
        }}
      >
        <span className="overlay whitespace-nowrap px-1.5 py-0.5 font-mono tnum text-[11px] text-ink">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={() => setActive(true)}
        onPointerUp={() => setActive(false)}
        onPointerCancel={() => setActive(false)}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        className="w-full"
      />
    </div>
  );
}
