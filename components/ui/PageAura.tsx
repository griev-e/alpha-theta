"use client";

import { m } from "framer-motion";

/**
 * A barely-there radial wash pinned to the top of the viewport, tinted by the
 * section you're in. It's atmosphere and subconscious wayfinding, not decoration
 * — kept under ~5% opacity so it's *felt*, never seen at a glance (if it reads
 * as a colored blob in a screenshot, it's too strong). Sits behind all content;
 * the panels paint over it and the gaps between them carry the tint.
 *
 * Cross-fades when `color` changes so moving between sections drifts rather than
 * cuts.
 */
export function PageAura({ color }: { color: string }) {
  return (
    <m.div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[42vh]"
      initial={false}
      animate={{
        background: `radial-gradient(60% 100% at 50% 0%, ${color}, transparent 72%)`,
      }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}
