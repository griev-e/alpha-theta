"use client";

import { m } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Sigil } from "@/components/shell/brand";
import { usePortfolioActions } from "@/lib/store";

/**
 * First-run checklist (§108) — the guided empty-Overview state before any
 * portfolio exists. A dismissible three-step path (Import → Explore → Tune)
 * with a progress rail: step one is live and actionable; the next two preview
 * what follows so the terminal doesn't read as a dead end. Dismissing persists
 * to localStorage and falls back to the plain empty state.
 */
const KEY = "alpha.checklist.v1";

const STEPS = [
  {
    title: "Import your holdings",
    body: "Drop a CSV of your positions — any column order, $/%/parentheses all fine. Or load the demo book to look around first.",
  },
  {
    title: "Explore the analytics",
    body: "Risk, quality, factors, correlation, scenarios and a Monte Carlo — every read computed live from your actual book.",
  },
  {
    title: "Tune your assumptions",
    body: "Set the equity risk premium and index aggregates on the Benchmark page; they flow through every model, honestly surfaced.",
  },
];

export function FirstRunChecklist({ onDismiss }: { onDismiss: () => void }) {
  const { loadDemo } = usePortfolioActions();

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="panel-rim relative mx-auto mt-16 max-w-lg overflow-hidden px-8 py-9"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-4 -top-10 select-none italic leading-none text-white/[0.03]"
        style={{ fontFamily: "var(--font-serif)", fontSize: 220 }}
      >
        α
      </span>

      <div className="relative z-10">
        <div className="mb-5 flex items-center gap-3">
          <Sigil size={34} />
          <div>
            <div className="eyebrow">Welcome</div>
            <h2 className="text-balance font-display text-lg font-semibold text-ink">
              Three steps to a live terminal
            </h2>
          </div>
        </div>

        <ol className="relative space-y-4 pl-1">
          {STEPS.map((step, i) => {
            const active = i === 0;
            return (
              <li key={step.title} className="flex gap-3.5">
                {/* progress rail: a numbered node + connector */}
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] ${
                      active
                        ? "border-accent/50 bg-accent/15 text-ink"
                        : "border-edge2 text-faint"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className="mt-1 w-px flex-1 bg-edge" />
                  )}
                </div>
                <div className={`pb-1 ${active ? "" : "opacity-55"}`}>
                  <div className="text-[13.5px] font-medium text-ink">{step.title}</div>
                  <p className="mt-1 text-pretty text-[12.5px] leading-relaxed text-mute">
                    {step.body}
                  </p>
                  {active && (
                    <div className="mt-3 flex items-center gap-3">
                      <Link href="/import" className="btn-primary">
                        Import CSV
                      </Link>
                      <button onClick={loadDemo} className="btn-secondary">
                        Load demo
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <button
          onClick={onDismiss}
          className="mt-6 text-[11.5px] text-faint underline-offset-2 transition-colors hover:text-mute hover:underline"
        >
          Skip the tour
        </button>
      </div>
    </m.div>
  );
}

/** Reads/writes the dismissal flag. Returns [dismissed, dismiss]. */
export function useChecklistDismissed(): [boolean, () => void] {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  };
  return [dismissed, dismiss];
}
