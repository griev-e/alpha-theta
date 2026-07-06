"use client";

import { m, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";
import { splitMoney } from "@/lib/format";

/**
 * Spring-animated numeric ticker. Re-targets the spring whenever `value`
 * changes, so imports / scenario tweaks glide instead of snapping. Pass
 * `from` to count up from a starting value on mount (e.g. 0). Set `dim` for
 * currency figures — the symbol/sign and trailing cents recede to ~55% opacity
 * (the `<Money>` hierarchy) while the value keeps animating as one figure.
 */
export function AnimatedNumber({
  value,
  format,
  className,
  from,
  dim = false,
  spring = { stiffness: 80, damping: 22 },
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
  from?: number;
  dim?: boolean;
  spring?: { stiffness: number; damping: number };
}) {
  const sv = useSpring(from ?? value, {
    ...spring,
    restDelta: Math.max(Math.abs(value) * 1e-6, 1e-4),
  });
  useEffect(() => {
    sv.set(value);
  }, [value, sv]);
  const text = useTransform(sv, (v) => format(v));
  // Hooks run unconditionally; only the render branch below reads them.
  const lead = useTransform(sv, (v) => splitMoney(format(v)).lead);
  const main = useTransform(sv, (v) => splitMoney(format(v)).main);
  const tail = useTransform(sv, (v) => splitMoney(format(v)).tail);
  if (dim) {
    return (
      <m.span className={className}>
        <m.span className="money-dim">{lead}</m.span>
        <m.span>{main}</m.span>
        <m.span className="money-dim">{tail}</m.span>
      </m.span>
    );
  }
  return <m.span className={className}>{text}</m.span>;
}
