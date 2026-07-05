"use client";

import { m } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";
import { Sigil } from "@/components/shell/brand";
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
}: {
  icon: ReactNode;
  heading: string;
  body: string;
  primary: ReactNode;
  secondary: ReactNode;
}) {
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="panel mx-auto mt-16 max-w-md px-8 py-10 text-center"
    >
      <div className="mb-4 flex justify-center opacity-90">{icon}</div>
      <h2 className="font-display text-lg font-semibold text-ink">{heading}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-mute">{body}</p>
      <div className="mt-6 flex items-center justify-center gap-3">
        {primary}
        {secondary}
      </div>
    </m.div>
  );
}

/** Shown on analytics pages before any portfolio exists. */
export function EmptyState({ page }: { page: string }) {
  const { ready } = usePortfolio();
  const { loadDemo } = usePortfolioActions();
  if (!ready) return null;
  return (
    <EmptyPanel
      icon={<Sigil size={44} />}
      heading="No portfolio loaded"
      body={`${page} needs holdings to analyze. Import your CSV or load the demo portfolio to explore.`}
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
