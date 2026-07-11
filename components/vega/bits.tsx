"use client";

import { m } from "framer-motion";
import { fmtPct } from "@/lib/format";
import type { VegaQuote } from "@/lib/vega/types";

/**
 * Small shared vega primitives — the change chip, the day-range position bar,
 * the momentum score dot, setup tags — kept together so the cockpit, scanner
 * and chart pages speak one visual dialect.
 */

/** Signed percent in the pos/neg tone; em-dash when unknown. */
export function ChangePct({ value, digits = 2 }: { value: number | null; digits?: number }) {
  if (value === null) return <span className="font-mono text-[11px] text-faint">—</span>;
  const tone = value > 0.0001 ? "text-pos" : value < -0.0001 ? "text-neg" : "text-mute";
  return (
    <span className={`font-mono tnum text-[12px] ${tone}`}>
      {fmtPct(value, digits, true)}
    </span>
  );
}

/**
 * Where price sits in the day's range — low ▮▮▮▮ high, the at-a-glance
 * "is it pressing highs or bleeding at lows" read.
 */
export function RangeBar({ pos, width = 64 }: { pos: number | null; width?: number }) {
  if (pos === null) {
    return <div className="h-[5px] rounded-full bg-white/[0.05]" style={{ width }} />;
  }
  const color =
    pos >= 0.65 ? "var(--color-pos)" : pos <= 0.35 ? "var(--color-neg)" : "var(--color-mute)";
  return (
    <div
      className="relative h-[5px] rounded-full bg-white/[0.06]"
      style={{ width }}
      title={`Price is ${Math.round(pos * 100)}% of the way up the day range`}
    >
      <m.div
        className="absolute top-1/2 h-[9px] w-[3px] -translate-y-1/2 rounded-full"
        initial={false}
        animate={{ left: `calc(${(pos * 100).toFixed(1)}% - 1.5px)` }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
    </div>
  );
}

/** Momentum score 0–100 as a small filled dot + number, gold-hot. */
export function ScoreChip({ score }: { score: number | null }) {
  if (score === null) return <span className="font-mono text-[11px] text-faint">—</span>;
  const heat = Math.max(0, Math.min(1, score / 100));
  return (
    <span className="inline-flex items-center gap-1.5 font-mono tnum text-[12px] text-ink">
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{
          background: `color-mix(in srgb, var(--color-gold) ${Math.round(heat * 100)}%, rgba(255,255,255,0.12))`,
          boxShadow: heat > 0.7 ? "0 0 8px var(--color-gold)" : "none",
        }}
      />
      {score}
    </span>
  );
}

/** Setup/state tag ("gap ↑", "high rvol") in the machine-status voice. */
export function ScanTag({ label }: { label: string }) {
  const tone = label.includes("↓") || label === "at LOD" || label === "52w low"
    ? "var(--color-neg)"
    : label.includes("↑") || label === "at HOD" || label === "52w high"
      ? "var(--color-pos)"
      : "var(--color-gold)";
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.08em]"
      style={{
        color: tone,
        background: `color-mix(in srgb, ${tone} 10%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 25%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}

/** RVOL readout — brightens as volume runs hotter than normal. */
export function RvolText({ rvol }: { rvol: number | null }) {
  if (rvol === null) return <span className="font-mono text-[11px] text-faint">—</span>;
  const cls =
    rvol >= 2 ? "text-gold" : rvol >= 1.2 ? "text-ink" : "text-mute";
  return (
    <span className={`font-mono tnum text-[12px] ${cls}`} style={rvol >= 2 ? { color: "var(--color-gold)" } : undefined}>
      {rvol.toFixed(2)}×
    </span>
  );
}

/** One internals-tape cell: symbol + change, VIX inverts its tone. */
export function InternalsChip({ quote }: { quote: VegaQuote }) {
  // For the vol/rates complex, up is *pressure*, not health — tone flips.
  const inverse = quote.symbol === "^VIX" || quote.symbol === "^TNX";
  const chg = quote.changePct;
  const tone =
    chg === null
      ? "text-faint"
      : (inverse ? -chg : chg) >= 0
        ? "text-pos"
        : "text-neg";
  const label = quote.symbol.replace(/^\^/, "");
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-[11px] tracking-[0.06em] text-faint">{label}</span>
      <span className={`font-mono tnum text-[11px] ${tone}`}>
        {chg === null ? "—" : fmtPct(chg, 2, true)}
      </span>
    </div>
  );
}
