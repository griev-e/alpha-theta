"use client";

import { m } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";
import { Sigil } from "@/components/shell/brand";
import { FanChart } from "@/components/charts/FanChart";
import { Heatmap } from "@/components/charts/Heatmap";
import { GHOST_FAN, GHOST_MATRIX } from "./ghostData";
import { usePortfolio, usePortfolioActions } from "@/lib/store";

/**
 * Shared "nothing here yet" panel — same rise-in, copy rhythm, and two-button
 * layout for both alpha's {@link EmptyState} and theta's `ThetaEmpty`
 * (`components/theta/ui.tsx`), which only differ in mark, copy, and actions.
 */
export function EmptyPanel({
  icon,
  heading,
  body,
  primary,
  secondary,
  watermark,
  preview,
}: {
  icon: ReactNode;
  heading: string;
  body: string;
  primary: ReactNode;
  secondary: ReactNode;
  /** The serif signature glyph (α / θ) drawn huge and faint behind the panel —
   *  one of the few sanctioned homes for the serif. */
  watermark?: string;
  /** A page-specific chart ghost behind the panel (§104). Falls back to the
   *  generic bars-into-a-curve motif when a page has nothing better to show. */
  preview?: ReactNode;
}) {
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="panel-rim relative mx-auto mt-16 max-w-md overflow-hidden px-8 py-10 text-center"
    >
      {watermark && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-4 -top-10 select-none italic leading-none text-white/[0.03]"
          style={{ fontFamily: "var(--font-serif)", fontSize: 220 }}
        >
          {watermark}
        </span>
      )}
      {preview ?? <GhostChart />}
      <div className="relative z-10">
        <div className="mb-4 flex justify-center opacity-90">{icon}</div>
        <h2 className="text-balance font-display text-lg font-semibold text-ink">{heading}</h2>
        <p className="mt-2 text-pretty text-[13px] leading-relaxed text-mute">{body}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          {primary}
          {secondary}
        </div>
      </div>
    </m.div>
  );
}

/**
 * A faint, abstract chart motif behind an empty state — bars rising into a
 * curve — so the panel previews the kind of thing that will live here once
 * there's data, instead of reading as a blank card. Purely decorative and very
 * low-contrast; it drifts up on mount and then holds.
 */
function GhostChart() {
  const bars = [0.35, 0.55, 0.42, 0.7, 0.5, 0.82, 0.62, 0.95];
  return (
    <m.svg
      aria-hidden
      viewBox="0 0 240 120"
      preserveAspectRatio="none"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full"
    >
      {bars.map((h, i) => {
        const w = 240 / bars.length;
        return (
          <rect
            key={i}
            x={i * w + 4}
            y={120 - h * 108}
            width={w - 8}
            height={h * 108}
            rx={3}
            fill="rgba(255,255,255,0.02)"
          />
        );
      })}
      <path
        d="M0 84 C 40 70, 70 92, 108 60 S 180 30, 240 20"
        fill="none"
        stroke="color-mix(in srgb, var(--color-mint) 14%, transparent)"
        strokeWidth={1.5}
      />
    </m.svg>
  );
}

/**
 * A page-specific ghost: the real chart component the page is *about*, rendered
 * faintly behind the empty panel and masked so the heading stays clean (§104).
 * Feeds on the hand-shaped `ghostData` — never any real analytics.
 */
function GhostPreview({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 top-8 select-none opacity-[0.16] [mask-image:linear-gradient(to_bottom,transparent,black_55%)]"
    >
      {children}
    </div>
  );
}

const PREVIEWS: Record<string, ReactNode> = {
  fan: (
    <GhostPreview>
      <FanChart result={GHOST_FAN.result} target={GHOST_FAN.target} height={180} />
    </GhostPreview>
  ),
  heatmap: (
    <GhostPreview>
      <div className="mx-auto max-w-[260px] px-6">
        <Heatmap symbols={GHOST_MATRIX.symbols} matrix={GHOST_MATRIX.matrix} />
      </div>
    </GhostPreview>
  ),
};

/** Shown on analytics pages before any portfolio exists. */
export function EmptyState({
  page,
  preview,
}: {
  page: string;
  /** Which page-specific chart ghost to show behind the panel (§104). */
  preview?: keyof typeof PREVIEWS;
}) {
  const { ready } = usePortfolio();
  const { loadDemo } = usePortfolioActions();
  if (!ready) return null;
  return (
    <EmptyPanel
      watermark="α"
      icon={<Sigil size={44} />}
      heading="No portfolio loaded"
      body={`${page} needs holdings to analyze. Import your CSV or load the demo portfolio to explore.`}
      preview={preview ? PREVIEWS[preview] : undefined}
      primary={
        <Link href="/import" className="btn-primary">
          Import CSV
        </Link>
      }
      secondary={
        <button onClick={loadDemo} className="btn-secondary">
          Load demo
        </button>
      }
    />
  );
}
