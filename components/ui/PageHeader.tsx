"use client";

import { m } from "framer-motion";
import type { ReactNode } from "react";
import { useFirstView } from "@/lib/firstView";

export function PageHeader({
  eyebrow,
  title,
  description,
  right,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  const firstView = useFirstView();
  return (
    <m.div
      initial={firstView ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6 flex flex-wrap items-end justify-between gap-4"
    >
      <div>
        <div className="eyebrow mb-1 lg:hidden">{eyebrow}</div>
        <h1 className="display-xl text-balance text-ink">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-pretty text-[13px] leading-relaxed text-mute">
            {description}
          </p>
        )}
      </div>
      {right}
    </m.div>
  );
}
