"use client";

import { m, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/**
 * A staggered reveal for content that arrives all at once — chiefly AI results,
 * where a plain block-swap wastes the anticipation the loading state built. Wrap
 * a result in {@link RevealGroup} and its sections in {@link RevealItem}; the
 * sections cascade in top-to-bottom, so the answer *composes* onto the page
 * rather than snapping in. Respects reduced-motion via the app's MotionConfig.
 */
const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.02 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

export function RevealGroup({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <m.div
      variants={container}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </m.div>
  );
}

export function RevealItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <m.div variants={item} className={className}>
      {children}
    </m.div>
  );
}
