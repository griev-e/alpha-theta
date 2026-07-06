"use client";

import { fmtUSD, fmtUSDCompact, splitMoney } from "@/lib/format";

/**
 * Currency, set with a typographic hierarchy: the significant digits carry at
 * full weight while the furniture — the currency symbol/sign and the trailing
 * cents — recedes to ~55% opacity. `$` and `.56` quiet, `12,304` loud. The one
 * numeral-craft item from the original typography eight; use it anywhere a
 * static dollar figure is shown (tables, tickets, EditableMoney's read state).
 * Animated figures dim through `AnimatedNumber`'s `dim` prop instead.
 */
export function Money({
  value,
  compact = false,
  whole = false,
  className = "",
}: {
  value: number;
  compact?: boolean;
  whole?: boolean;
  className?: string;
}) {
  const formatted = compact ? fmtUSDCompact(value) : fmtUSD(value, whole);
  const { lead, main, tail } = splitMoney(formatted);
  return (
    <span className={`tnum ${className}`}>
      {lead && <span className="money-dim">{lead}</span>}
      {main}
      {tail && <span className="money-dim">{tail}</span>}
    </span>
  );
}
