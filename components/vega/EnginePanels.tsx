"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useElementWidth } from "@/lib/useElementWidth";
import { etStamp } from "@/lib/vega/session";
import type { EngineDriver, EngineLayer, RibbonPoint } from "@/lib/vega/engine";

/**
 * The Edge Engine console's supporting panels: the eight layer gauges (a
 * diverging bar per layer, weight-scaled, expandable into its raw signals),
 * the driver/caution stacks, and the session score ribbon — the composite
 * replayed bar-by-bar across the day.
 */

const POS = "var(--color-pos)";
const NEG = "var(--color-neg)";
const GOLD = "var(--color-gold)";

const signColor = (v: number): string => (v >= 0 ? POS : NEG);

/* ── Layer gauges ────────────────────────────────────────────────────── */

function LayerRow({ layer, index }: { layer: EngineLayer; index: number }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const score = layer.score;
  const dead = score === null;

  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="border-b border-edge/60 last:border-b-0"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex w-full items-center gap-3 py-2.5 text-left"
      >
        <span className="w-36 shrink-0 truncate text-[12.5px] text-mute group-hover:text-ink transition-colors">
          {layer.label}
        </span>

        {/* Diverging bar: zero-centered, |score| fills out from the middle. */}
        <span className="relative h-[9px] flex-1 overflow-hidden rounded-full bg-white/[0.045]">
          <span className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
          {!dead && (
            <m.span
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${(Math.abs(score) / 2) * 100}%` }}
              transition={{ type: "spring", stiffness: 70, damping: 18, delay: index * 0.05 }}
              className="absolute inset-y-0 rounded-full"
              style={{
                background: signColor(score),
                opacity: 0.3 + 0.7 * Math.min(1, layer.weight * 8),
                [score >= 0 ? "left" : "right"]: "50%",
              }}
            />
          )}
        </span>

        <span className="w-12 shrink-0 text-right font-mono tnum text-[11.5px]" style={{ color: dead ? "var(--color-faint)" : signColor(score!) }}>
          {dead ? "—" : `${score! >= 0 ? "+" : ""}${(score! * 100).toFixed(0)}`}
        </span>
        <span className="hidden w-14 shrink-0 text-right font-mono text-[10px] text-faint sm:inline">
          w {(layer.weight * 100).toFixed(0)}%
        </span>
        <svg
          viewBox="0 0 12 12"
          className={`h-3 w-3 shrink-0 text-faint transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M4.5 2.5 L8.5 6 L4.5 9.5" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-1.5 pl-1 text-[11px] leading-relaxed text-faint">{layer.desc}</p>
            <div className="mb-2.5 space-y-1 rounded-md border border-edge/60 bg-white/[0.015] px-3 py-2">
              {layer.signals.map((s) => (
                <div key={s.key} className="flex items-center gap-2.5 font-mono text-[10.5px]">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: s.score === null ? "var(--color-track)" : signColor(s.score) }}
                  />
                  <span className="text-mute">{s.label}</span>
                  <span className="ml-auto text-faint">{s.detail}</span>
                  <span className="w-10 text-right tnum" style={{ color: s.score === null ? "var(--color-faint)" : signColor(s.score) }}>
                    {s.score === null ? "n/a" : `${s.score >= 0 ? "+" : ""}${(s.score * 100).toFixed(0)}`}
                  </span>
                </div>
              ))}
              <div className="flex gap-4 pt-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
                <span>coverage {(layer.coverage * 100).toFixed(0)}%</span>
                <span>agreement {(layer.agreement * 100).toFixed(0)}%</span>
                <span>earned weight {(layer.weight * 100).toFixed(0)}%</span>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}

export function EngineLayers({ layers }: { layers: EngineLayer[] }) {
  return (
    <div>
      {layers.map((l, i) => (
        <LayerRow key={l.key} layer={l} index={i} />
      ))}
    </div>
  );
}

/* ── Drivers & cautions ──────────────────────────────────────────────── */

export function DriverStack({
  title,
  items,
  empty,
  tone,
}: {
  title: string;
  items: EngineDriver[];
  empty: string;
  tone: "pos" | "neg";
}) {
  const reduce = useReducedMotion();
  const color = tone === "pos" ? POS : NEG;
  const max = Math.max(...items.map((d) => Math.abs(d.impact)), 0.0001);
  return (
    <div>
      <div className="eyebrow mb-2">{title}</div>
      {items.length === 0 ? (
        <p className="text-[11.5px] text-faint">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((d, i) => (
            <m.div
              key={d.label}
              initial={reduce ? false : { opacity: 0, x: tone === "pos" ? -8 : 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
              className="text-[11.5px]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-mute">{d.label}</span>
                <span className="shrink-0 font-mono text-[10px] text-faint">{d.layer}</span>
              </div>
              <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-white/[0.04]">
                <m.div
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${(Math.abs(d.impact) / max) * 100}%` }}
                  transition={{ duration: 0.5, delay: 0.15 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full"
                  style={{ background: color, opacity: 0.75 }}
                />
              </div>
            </m.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Session score ribbon ────────────────────────────────────────────── */

export function ScoreRibbon({ points, height = 150 }: { points: RibbonPoint[]; height?: number }) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const PAD = { top: 10, right: 46, bottom: 20, left: 8 };
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const n = points.length;

  const geom = useMemo(() => {
    if (n < 2 || plotW <= 0) return null;
    const x = (i: number) => PAD.left + (i / (n - 1)) * plotW;
    const y = (v: number) => PAD.top + ((100 - v) / 200) * plotH;
    let line = "";
    let area = `M${x(0).toFixed(2)},${y(0).toFixed(2)}`;
    points.forEach((p, i) => {
      line += `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.score).toFixed(2)}`;
      area += `L${x(i).toFixed(2)},${y(p.score).toFixed(2)}`;
    });
    area += `L${x(n - 1).toFixed(2)},${y(0).toFixed(2)}Z`;
    return { x, y, line, area };
  }, [n, plotW, plotH, points, PAD.left, PAD.top]);

  if (!geom) {
    return (
      <div ref={wrapRef} style={{ height }} className="flex w-full items-center justify-center">
        <p className="text-[11.5px] text-faint">The ribbon draws once the session has enough bars.</p>
      </div>
    );
  }

  const { x, y, line, area } = geom;
  const label = (i: number) => {
    const { minutes } = etStamp(points[i].t);
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
  };
  const tickIdx = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1];
  const hovered = hover !== null ? points[hover] : null;
  const gid = "ribbon";

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        className="block"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const idx = Math.round(((e.clientX - rect.left - PAD.left) / plotW) * (n - 1));
          setHover(idx >= 0 && idx < n ? idx : null);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={POS} stopOpacity="0.22" />
            <stop offset="50%" stopColor={POS} stopOpacity="0.02" />
            <stop offset="50%" stopColor={NEG} stopOpacity="0.02" />
            <stop offset="100%" stopColor={NEG} stopOpacity="0.22" />
          </linearGradient>
          <clipPath id={`${gid}-clip`}>
            <rect x={PAD.left} y={0} width={plotW} height={height} />
          </clipPath>
        </defs>

        {/* Bias zones */}
        {[50, -50].map((v) => (
          <line key={v} x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 5" />
        ))}
        <line x1={PAD.left} x2={PAD.left + plotW} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.14)" />
        {[100, 50, 0, -50, -100].map((v) => (
          <text key={v} x={PAD.left + plotW + 8} y={y(v) + 3} className="font-mono" style={{ fontSize: 9 }} fill="var(--color-faint)">
            {v > 0 ? `+${v}` : v}
          </text>
        ))}

        <g clipPath={`url(#${gid}-clip)`}>
          <m.path
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            d={area}
            fill={`url(#${gid}-fill)`}
          />
          <m.path
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            d={line}
            fill="none"
            stroke={GOLD}
            strokeWidth="1.6"
          />
        </g>

        {/* Endpoint */}
        <circle cx={x(n - 1)} cy={y(points[n - 1].score)} r={2.4} fill={GOLD} />

        {tickIdx.map((i) => (
          <text key={i} x={x(i)} y={height - 5} textAnchor="middle" className="font-mono" style={{ fontSize: 9 }} fill="var(--color-faint)">
            {label(i)}
          </text>
        ))}

        {hovered && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(hovered.score)} r={3} fill="none" stroke={GOLD} strokeWidth="1.4" />
          </g>
        )}
      </svg>
      {hovered && hover !== null && (
        <ChartTooltip left={Math.min(Math.max(x(hover), 80), width - 80)} top={PAD.top + 4} place="bottom">
          <div className="font-mono text-[10.5px]">
            <span className="text-faint">{label(hover)} ET</span>
            <span className="tnum ml-2" style={{ color: hovered.score >= 0 ? POS : NEG }}>
              {hovered.score >= 0 ? "+" : ""}
              {hovered.score}
            </span>
          </div>
        </ChartTooltip>
      )}
    </div>
  );
}
