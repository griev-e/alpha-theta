"use client";

import { LazyMotion, MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Wraps the app in framer-motion's LazyMotion so components can use the
 * lightweight `m` component instead of the full `motion` factory. The heavy
 * feature bundle (`domMax`) is loaded lazily from ./features, keeping it out of
 * the initial JS for every route — it arrives as a separate async chunk just
 * after hydration. `strict` makes any stray `motion.*` usage throw in dev, so
 * the full bundle can never sneak back in.
 *
 * `reducedMotion="user"` makes every `m.*` animation everywhere in the app
 * defer to the OS-level "reduce motion" preference — looping glows, drawing
 * charts, and spring transitions all snap to their end state instead of
 * animating, with no per-component opt-in needed.
 */
const loadFeatures = () => import("./features").then((res) => res.default);

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion strict features={loadFeatures}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
