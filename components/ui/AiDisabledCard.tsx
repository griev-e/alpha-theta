"use client";

import type { ReactNode } from "react";
import { Card } from "./Card";

/** The `ANTHROPIC_API_KEY` token, styled identically wherever it's named. */
export function EnvKey({ name = "ANTHROPIC_API_KEY" }: { name?: string }) {
  return (
    <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px]">
      {name}
    </code>
  );
}

/**
 * The one surface for "this AI feature needs `ANTHROPIC_API_KEY`", unifying
 * copy the AI-backed pages used to spell out by hand. Two shapes, both on the
 * shared glass Card:
 *  - `note` — a quiet single-line footnote (status dot + one sentence) for
 *    pages whose real content already rendered above it (Intelligence, Market,
 *    Rebalance, Optimizer).
 *  - `card` — a centered headline + paragraph for pages where the AI *is* the
 *    view (Discover, theta Intelligence).
 * The copy always makes the graceful-degradation promise: everything else works.
 * `className` carries only sibling margins — padding is owned here so the look
 * stays consistent.
 */
export function AiDisabledCard({
  variant = "note",
  title,
  children,
  i = 0,
  className = "",
}: {
  variant?: "note" | "card";
  /** Headline for the `card` variant. */
  title?: string;
  /** Explanatory copy — a sentence for `note`, a paragraph for `card`. */
  children: ReactNode;
  i?: number;
  className?: string;
}) {
  if (variant === "card") {
    return (
      <Card className={`px-8 py-12 text-center ${className}`} i={i} hover={false}>
        {title && (
          <h2 className="text-balance font-display text-[15px] font-medium text-ink">
            {title}
          </h2>
        )}
        <p className="mx-auto mt-2 max-w-md text-pretty text-[13px] leading-relaxed text-mute">
          {children}
        </p>
      </Card>
    );
  }
  return (
    <Card className={`px-6 py-4 ${className}`} i={i} hover={false}>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-faint">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
        {children}
      </div>
    </Card>
  );
}
