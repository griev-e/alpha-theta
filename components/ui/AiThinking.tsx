"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/* A restrained monochrome set — the field is drawn in whites and grays so the
   loading state reads as one calm, black-and-white thing across every
   Claude-backed call, matching the app's near-black surfaces. */
const PALETTE = ["#f2f2f2", "#b8b8b8", "#8a8a8a"];

const DEFAULT_MESSAGES = [
  "Reading the inputs",
  "Weighing the tradeoffs",
  "Synthesizing",
  "Writing it up",
];

/**
 * A full-bleed loading screen for any Claude-backed generation. It fills its
 * block with a living "neural field" — drifting nodes wired by distance-faded
 * links, pulses of light flowing along the network, and a slow aurora — with a
 * headline and a cycling phase message floated over the top. Drop it straight
 * into a card body; it spans the whole area rather than sitting as a small
 * centered spinner.
 */
export function AiThinking({
  label = "Claude is thinking",
  messages = DEFAULT_MESSAGES,
  colors = PALETTE,
  minHeight = 340,
  className = "",
}: {
  label?: string;
  messages?: string[];
  colors?: string[];
  minHeight?: number;
  className?: string;
}) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(
      () => setPhase((p) => (p + 1) % messages.length),
      2000
    );
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`relative flex w-full items-center justify-center overflow-hidden rounded-[inherit] ${className}`}
      style={{ minHeight }}
    >
      <NeuralField colors={colors} />

      {/* Vignette so the type stays legible over the busy field. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 50% at 50% 50%, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.28) 42%, transparent 68%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-2 px-6 text-center">
        <div className="font-display text-[14.5px] font-medium tracking-tight text-ink">
          {label}
        </div>
        <div className="relative flex h-[16px] items-center justify-center">
          <AnimatePresence mode="wait">
            <m.div
              key={phase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-mute"
            >
              {messages[phase]}
              <PulseDots />
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function PulseDots() {
  return (
    <span className="flex gap-[3px]">
      {[0, 1, 2].map((i) => (
        <m.span
          key={i}
          className="h-[3px] w-[3px] rounded-full bg-mute"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}

/* ── The animation ───────────────────────────────────────────────────────
   A canvas "neural constellation": nodes drift and connect to their neighbours
   with links that fade by distance; light sparks travel node-to-node along the
   network (a fresh nearest-ish hop each time they arrive), leaving a short
   glowing trail; behind it all, a few colored blobs orbit on additive blend to
   make a breathing aurora. Hand-built — no animation library, in the spirit of
   the app's hand-drawn SVG charts. */

type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h.split("").map((c) => c + c).join("")
      : h.slice(0, 6),
    16
  );
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const smooth = (t: number) => t * t * (3 - 2 * t);

function NeuralField({ colors }: { colors: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const rgb = (colors.length ? colors : PALETTE).map(hexToRgb);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;

    type Node = { x: number; y: number; vx: number; vy: number };
    type Spark = { a: number; b: number; t: number; speed: number; c: number };
    let nodes: Node[] = [];
    let sparks: Spark[] = [];

    const dist2 = (i: number, j: number) => {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      return dx * dx + dy * dy;
    };

    // Next hop for a spark: one of the three nearest nodes, chosen at random so
    // the light wanders instead of retracing a fixed path.
    const nextHop = (from: number, avoid: number): number => {
      const others = nodes
        .map((_, idx) => idx)
        .filter((idx) => idx !== from && idx !== avoid);
      if (others.length === 0) return from;
      others.sort((p, q) => dist2(from, p) - dist2(from, q));
      const pool = others.slice(0, Math.min(3, others.length));
      return pool[(Math.random() * pool.length) | 0];
    };

    const newSpark = (from?: number): Spark => {
      const a = from ?? (Math.random() * nodes.length) | 0;
      return {
        a,
        b: nextHop(a, -1),
        t: Math.random(),
        speed: 0.005 + Math.random() * 0.007,
        c: (Math.random() * rgb.length) | 0,
      };
    };

    const seed = () => {
      const count = Math.max(14, Math.min(32, Math.round((w * h) / 20000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
      }));
      sparks = Array.from({ length: Math.max(6, Math.round(count / 3)) }, () =>
        newSpark()
      );
    };

    const resize = () => {
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      seed();
    };

    const draw = (time: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const t = time / 1000;

      // Aurora: colored blobs orbiting on additive blend.
      ctx.globalCompositeOperation = "lighter";
      const R = Math.max(w, h) * 0.6;
      for (let i = 0; i < rgb.length; i++) {
        const c = rgb[i];
        const cx = w * (0.5 + 0.34 * Math.sin(t * 0.18 + i * 2.1));
        const cy = h * (0.5 + 0.34 * Math.cos(t * 0.15 + i * 1.7));
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0.08)`);
        grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalCompositeOperation = "source-over";

      // Drift nodes, bouncing off the edges.
      if (!reduce) {
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > w) n.vx *= -1;
          if (n.y < 0 || n.y > h) n.vy *= -1;
          n.x = Math.max(0, Math.min(w, n.x));
          n.y = Math.max(0, Math.min(h, n.y));
        }
      }

      // Links, fading with distance.
      const D = Math.min(w, h) * 0.44;
      const D2 = D * D;
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d2 = dist2(i, j);
          if (d2 < D2) {
            const a = (1 - Math.sqrt(d2) / D) * 0.18;
            ctx.strokeStyle = `rgba(150,170,205,${a})`;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Node cores.
      ctx.fillStyle = "rgba(205,215,235,0.55)";
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Light sparks flowing across the network.
      ctx.globalCompositeOperation = "lighter";
      for (const s of sparks) {
        if (!reduce) s.t += s.speed;
        if (s.t >= 1) {
          s.a = s.b;
          s.b = nextHop(s.a, s.a);
          s.t = 0;
        }
        const A = nodes[s.a];
        const B = nodes[s.b];
        if (!A || !B) continue;
        const c = rgb[s.c];
        const e = smooth(s.t);
        const x = A.x + (B.x - A.x) * e;
        const y = A.y + (B.y - A.y) * e;
        const e0 = smooth(Math.max(0, s.t - 0.14));
        const tx = A.x + (B.x - A.x) * e0;
        const ty = A.y + (B.y - A.y) * e0;

        const trail = ctx.createLinearGradient(tx, ty, x, y);
        trail.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0)`);
        trail.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0.85)`);
        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.stroke();

        const glow = ctx.createRadialGradient(x, y, 0, x, y, 7);
        glow.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0.95)`);
        glow.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      raf = requestAnimationFrame(draw);
    };

    let raf = 0;
    resize();
    const ro =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(resize)
        : null;
    ro?.observe(parent);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [colors]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
