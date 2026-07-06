"use client";

import type { ReactNode } from "react";
import { AnimatedNumber } from "./AnimatedNumber";
import { Tooltip } from "./Tooltip";
import { useToast } from "./Toast";

export function Stat({
  label,
  value,
  format,
  sub,
  toneClass = "text-ink",
  size = "md",
  tip,
  dim = false,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  sub?: ReactNode;
  toneClass?: string;
  size?: "sm" | "md" | "lg";
  /** When set, the label gains a hover box explaining the metric. */
  tip?: ReactNode;
  /** Dim a currency figure's symbol/sign and cents (the `<Money>` hierarchy). */
  dim?: boolean;
}) {
  const sizeClass =
    size === "lg"
      ? "text-[30px] sm:text-[34px]"
      : size === "md"
        ? "text-[21px]"
        : "text-[16px]";
  const toast = useToast();
  // Click the figure to copy what's shown — analyst muscle memory. Reads the
  // formatted string (what the eye sees), not a raw fraction.
  const copy = () => {
    const text = format(value);
    navigator.clipboard?.writeText(text).then(
      () => toast(`Copied ${text}`),
      () => {}
    );
  };
  return (
    <div>
      {tip ? (
        <Tooltip content={tip}>
          <span className="eyebrow">{label}</span>
        </Tooltip>
      ) : (
        <div className="eyebrow">{label}</div>
      )}
      <button
        type="button"
        onClick={copy}
        title="Click to copy"
        className={`group/stat mt-1.5 block cursor-copy text-left font-mono tnum leading-none ${sizeClass} font-medium ${toneClass}`}
      >
        <AnimatedNumber value={value} format={format} dim={dim} />
      </button>
      {sub && <div className="mt-1 text-[12px] text-mute">{sub}</div>}
    </div>
  );
}
