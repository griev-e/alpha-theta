"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";

/* The signature "AI is working" accent — the same mint→violet gradient the
   Computing spinner uses, so every Claude-backed call across alpha and theta
   reads as the one, consistent thing. */
const FROM = "#5eead4";
const TO = "#a78bfa";

const DEFAULT_MESSAGES = [
  "Reading the inputs",
  "Weighing the tradeoffs",
  "Synthesizing",
  "Writing it up",
];

/**
 * A clean, self-contained loading screen for any Claude-backed generation.
 * Shows an animated orb, a fixed headline, a cycling phase message, and — by
 * default — a few "document being written" shimmer lines. Pass `children` to
 * swap the skeleton for a bespoke one (e.g. a card grid). Fills and centers
 * within its parent, so drop it straight into a card body.
 */
export function AiThinking({
  label = "Claude is thinking",
  messages = DEFAULT_MESSAGES,
  from = FROM,
  to = TO,
  className = "",
  children,
}: {
  label?: string;
  messages?: string[];
  from?: string;
  to?: string;
  className?: string;
  children?: ReactNode;
}) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(
      () => setPhase((p) => (p + 1) % messages.length),
      1900
    );
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center justify-center gap-4 py-8 ${className}`}
    >
      <ThinkingOrb from={from} to={to} />

      <div className="text-center">
        <div className="font-display text-[13.5px] font-medium text-ink">
          {label}
        </div>
        <div className="relative mt-1.5 flex h-[15px] items-center justify-center">
          <AnimatePresence mode="wait">
            <m.div
              key={phase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint"
            >
              {messages[phase]}
              <PulseDots />
            </m.div>
          </AnimatePresence>
        </div>
      </div>

      {children ?? (
        <div className="mt-1 flex w-full max-w-sm flex-col gap-2.5">
          <ShimmerLine width="100%" delay={0} />
          <ShimmerLine width="94%" delay={0.15} />
          <ShimmerLine width="80%" delay={0.3} />
        </div>
      )}
    </div>
  );
}

/** Two counter-rotating gradient arcs around a pulsing core, over a soft glow. */
function ThinkingOrb({
  from,
  to,
  size = 50,
}: {
  from: string;
  to: string;
  size?: number;
}) {
  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <m.div
        className="absolute inset-0 rounded-full blur-lg"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${from}66, ${to}22 55%, transparent 72%)`,
        }}
        animate={{ opacity: [0.4, 0.85, 0.4], scale: [0.8, 1.08, 0.8] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <m.div
        className="absolute rounded-full"
        style={{
          inset: 0,
          border: "2px solid transparent",
          borderTopColor: from,
          borderRightColor: from,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      />
      <m.div
        className="absolute rounded-full"
        style={{
          inset: size * 0.22,
          border: "2px solid transparent",
          borderBottomColor: to,
          borderLeftColor: to,
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />
      <m.div
        className="rounded-full"
        style={{
          width: 6,
          height: 6,
          background: `linear-gradient(135deg, ${from}, ${to})`,
        }}
        animate={{ scale: [0.7, 1.2, 0.7], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function PulseDots() {
  return (
    <span className="flex gap-[3px]">
      {[0, 1, 2].map((i) => (
        <m.span
          key={i}
          className="h-[3px] w-[3px] rounded-full bg-faint"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}

/** A skeleton bar with a traveling sheen — reads as text being generated. */
export function ShimmerLine({
  width = "100%",
  delay = 0,
  height = 9,
}: {
  width?: string;
  delay?: number;
  height?: number;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-full bg-white/[0.04]"
      style={{ width, height }}
    >
      <m.div
        className="absolute inset-y-0 w-1/2"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)",
        }}
        animate={{ x: ["-120%", "260%"] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        }}
      />
    </div>
  );
}
