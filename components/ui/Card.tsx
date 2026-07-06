"use client";

import { m } from "framer-motion";
import type { ReactNode } from "react";
import { useFirstView } from "@/lib/firstView";

/** Glass panel with a staggered rise-in. Use `i` to order siblings. The rise-in
 *  plays only on a route's first visit this session (see {@link useFirstView});
 *  revisits render instantly so repeat navigation stays snappy. */
export function Card({
  children,
  className = "",
  i = 0,
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  i?: number;
  hover?: boolean;
}) {
  const firstView = useFirstView();
  return (
    <m.section
      initial={firstView ? { opacity: 0, y: 16 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: firstView ? i * 0.06 : 0,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`panel ${hover ? "panel-hover" : ""} ${className}`}
    >
      {children}
    </m.section>
  );
}

export function CardHeader({
  eyebrow,
  title,
  right,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div>
        {eyebrow && <div className="eyebrow mb-0.5">{eyebrow}</div>}
        <h2 className="text-balance font-display text-[15px] font-medium tracking-[-0.01em] text-ink">
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}
