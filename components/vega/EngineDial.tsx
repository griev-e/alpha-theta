"use client";

import { m, useReducedMotion } from "framer-motion";
import { useId } from "react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { convictionLabel, type EngineReport } from "@/lib/vega/engine";

/**
 * The Edge Engine's face — a hand-built SVG conviction dial. The needle
 * sweeps a 240° arc from −100 (max short) to +100 (max long) on a spring;
 * the scale's outer ring fills with the earned confidence; two counter-
 * rotating dashed rings give the console its idle "hum" (static under
 * reduced motion). No chart library, house rule.
 */

const POS = "var(--color-pos)";
const NEG = "var(--color-neg)";
const GOLD = "var(--color-gold)";

/** Angle (deg) for a score: −100 → −120°, 0 → 0° (straight up), +100 → +120°. */
const angleFor = (score: number): number => (Math.max(-100, Math.min(100, score)) / 100) * 120;

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** SVG arc path between two dial angles (dial 0° = straight up). */
function arc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  const a = polar(cx, cy, r, fromDeg);
  const b = polar(cx, cy, r, toDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  const sweep = toDeg > fromDeg ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

export function EngineDial({ report, size = 320 }: { report: EngineReport; size?: number }) {
  const reduce = useReducedMotion();
  const gid = useId();
  const cx = size / 2;
  const cy = size / 2 + 10;
  const R = size / 2 - 26;

  const { score, bias, confidence } = report;
  const dialColor = bias === "neutral" ? "var(--color-track)" : score > 0 ? POS : NEG;
  const needleDeg = angleFor(score);

  // Confidence ring: fills clockwise from the short end, in gold.
  const confSpan = 240 * Math.max(0.02, Math.min(1, confidence));

  const ticks = [-100, -75, -50, -25, 0, 25, 50, 75, 100];

  return (
    <div className="relative mx-auto" style={{ width: size, height: size - 34 }}>
      <svg width={size} height={size - 34} className="block overflow-visible">
        <defs>
          <linearGradient id={`${gid}-scale`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={NEG} stopOpacity="0.55" />
            <stop offset="45%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor={POS} stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id={`${gid}-glow`}>
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.13" />
            <stop offset="70%" stopColor={GOLD} stopOpacity="0.03" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Idle hum — two faint counter-rotating dashed rings. */}
        <circle cx={cx} cy={cy} r={R + 16} fill={`url(#${gid}-glow)`} />
        <g style={{ transformOrigin: `${cx}px ${cy}px` }} className={reduce ? undefined : "engine-spin-slow"}>
          <circle cx={cx} cy={cy} r={R + 12} fill="none" stroke="rgba(250,204,21,0.14)" strokeWidth="1" strokeDasharray="1 7" />
        </g>
        <g style={{ transformOrigin: `${cx}px ${cy}px` }} className={reduce ? undefined : "engine-spin-slower"}>
          <circle cx={cx} cy={cy} r={R - 34} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="1 10" />
        </g>

        {/* Scale track */}
        <path d={arc(cx, cy, R, -120, 120)} fill="none" stroke={`url(#${gid}-scale)`} strokeWidth="3.5" strokeLinecap="round" />

        {/* Confidence ring — how much of the machine agrees. */}
        <m.path
          key={`conf-${Math.round(confSpan)}`}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          d={arc(cx, cy, R + 7, -120, -120 + confSpan)}
          fill="none"
          stroke={GOLD}
          strokeOpacity="0.55"
          strokeWidth="1.4"
        />

        {/* Ticks + numerals */}
        {ticks.map((t) => {
          const a = angleFor(t);
          const p1 = polar(cx, cy, R - 6, a);
          const p2 = polar(cx, cy, R - (t % 50 === 0 ? 14 : 10), a);
          const pl = polar(cx, cy, R - 24, a);
          return (
            <g key={t}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="rgba(255,255,255,0.3)" strokeWidth={t === 0 ? 1.6 : 1} />
              {t % 50 === 0 && (
                <text x={pl.x} y={pl.y + 3} textAnchor="middle" className="font-mono" style={{ fontSize: 8.5 }} fill="var(--color-faint, rgba(255,255,255,0.4))">
                  {t === 0 ? "0" : Math.abs(t)}
                </text>
              )}
            </g>
          );
        })}
        <text x={polar(cx, cy, R + 20, -114).x} y={polar(cx, cy, R + 20, -114).y} textAnchor="middle" className="font-mono" style={{ fontSize: 9 }} fill={NEG} fillOpacity="0.8">SHORT</text>
        <text x={polar(cx, cy, R + 20, 114).x} y={polar(cx, cy, R + 20, 114).y} textAnchor="middle" className="font-mono" style={{ fontSize: 9 }} fill={POS} fillOpacity="0.8">LONG</text>

        {/* Score arc — fills from 0 toward the needle. */}
        {Math.abs(score) >= 1 && (
          <m.path
            key={`fill-${score >= 0 ? "p" : "n"}`}
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ type: "spring", stiffness: 55, damping: 16 }}
            d={arc(cx, cy, R, 0, needleDeg)}
            fill="none"
            stroke={dialColor}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        )}

        {/* Needle — a spring-loaded sweep. */}
        <m.g
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          initial={reduce ? { rotate: needleDeg } : { rotate: 0 }}
          animate={{ rotate: needleDeg }}
          transition={{ type: "spring", stiffness: 50, damping: 11, mass: 1.1 }}
        >
          <line x1={cx} y1={cy + 14} x2={cx} y2={cy - R + 20} stroke={dialColor} strokeWidth="2" strokeLinecap="round" />
          <line x1={cx} y1={cy + 14} x2={cx} y2={cy - R + 20} stroke={dialColor} strokeWidth="6" strokeOpacity="0.15" strokeLinecap="round" />
        </m.g>
        <circle cx={cx} cy={cy} r={5} fill="#0a0a0a" stroke={dialColor} strokeWidth="1.6" />
        <circle cx={cx} cy={cy} r={1.8} fill={dialColor} />
      </svg>

      {/* Center readout */}
      <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center" style={{ top: cy + 26 }}>
        <AnimatedNumber
          value={score}
          format={(v) => `${v >= 0 ? "+" : ""}${Math.round(v)}`}
          className="font-display tnum text-[30px] font-semibold tracking-[-0.02em] text-ink"
        />
        <span
          className="font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: bias === "neutral" ? "var(--color-mute)" : score > 0 ? POS : NEG }}
        >
          {bias === "neutral" ? "no edge" : `${convictionLabel(score)} ${bias}`}
        </span>
      </div>
    </div>
  );
}
