"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { useMarketPulse } from "@/lib/live/useMarketPulse";
import { fmtPct } from "@/lib/format";

/**
 * The market tape — a compact SPY/QQQ pulse in the shell top bar that makes the
 * terminal feel connected to a live market, not just the router. Clicking it
 * jumps to Market Analysis. Renders nothing when the feed is unreachable
 * (graceful degradation), so it never shows a stale or empty tick.
 */
export function MarketPulse() {
  const items = useMarketPulse();
  if (!items || items.length === 0) return null;

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="hidden items-center gap-4 xl:flex"
    >
      {items.map((it) => {
        const up = (it.changePct ?? 0) >= 0;
        const tone = it.changePct === null ? "text-faint" : up ? "text-pos" : "text-neg";
        return (
          <Link
            key={it.symbol}
            href="/market"
            title={`${it.name} (${it.symbol}) — open Market Analysis`}
            className="group flex items-baseline gap-1.5"
          >
            <span className="font-mono text-[11px] tracking-[0.06em] text-faint transition-colors group-hover:text-mute">
              {it.symbol}
            </span>
            <span className={`font-mono tnum text-[11px] ${tone}`}>
              {it.changePct === null
                ? "—"
                : fmtPct(it.changePct, 2, true)}
            </span>
          </Link>
        );
      })}
      <span className="h-3.5 w-px bg-edge2" aria-hidden />
    </m.div>
  );
}
