"use client";

import { useMemo } from "react";
import { TickerLogo } from "@/components/ui/TickerLogo";
import { fmtPct, relativeTime } from "@/lib/format";
import { SESSION_LABEL, usMarketSession } from "@/lib/marketSession";
import type { Position } from "@/lib/types";

interface Mover {
  symbol: string;
  pct: number;
}

/**
 * Overview session ribbon (§75) — the connective tissue between the hero and
 * the treemap. A slim strip: the market session (from the ET clock, paired with
 * the live/imported truth so it never over-claims) on the left, today's best
 * and worst movers on the right. Degrades to a quiet "last close" state when
 * there's no live day-change to rank.
 */
export function SessionRibbon({
  positions,
  degraded,
  livePriceCount,
  quotesAt,
}: {
  positions: Position[];
  degraded: boolean;
  livePriceCount: number;
  quotesAt: string | null;
}) {
  const { gainers, losers, hasMoves } = useMemo(() => {
    const moves: Mover[] = [];
    for (const p of positions) {
      if (!p.isLivePrice || p.prevClose == null || p.prevClose <= 0) continue;
      const pct = (p.price - p.prevClose) / p.prevClose;
      if (!Number.isFinite(pct) || pct === 0) continue;
      moves.push({ symbol: p.symbol, pct });
    }
    moves.sort((a, b) => b.pct - a.pct);
    const gainers = moves.filter((m) => m.pct > 0).slice(0, 3);
    const losers = moves
      .filter((m) => m.pct < 0)
      .slice(-3)
      .reverse();
    return { gainers, losers, hasMoves: moves.length > 0 };
  }, [positions]);

  const live = !degraded && livePriceCount > 0;
  const session = usMarketSession();
  // The clock names the session; the tape says whether it's actually live.
  const sessionLabel = live ? SESSION_LABEL[session] : "Imported prices";
  const dotClass = degraded
    ? "bg-warn"
    : session === "open" && live
      ? "bg-pos"
      : live
        ? "bg-sky"
        : "bg-mute";

  return (
    <div className="panel mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          {session === "open" && live && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pos opacity-60" />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotClass}`} />
        </span>
        <span className="text-[12px] font-medium text-ink">{sessionLabel}</span>
        {quotesAt && (
          <span className="font-mono text-[10.5px] text-faint">
            · {relativeTime(quotesAt)}
          </span>
        )}
      </div>

      {hasMoves ? (
        <div className="flex flex-1 flex-wrap items-center justify-end gap-x-5 gap-y-2">
          {gainers.length > 0 && <MoverGroup label="Leading" movers={gainers} />}
          {losers.length > 0 && <MoverGroup label="Lagging" movers={losers} />}
        </div>
      ) : (
        <span className="flex-1 text-right font-mono text-[10.5px] text-faint">
          {live ? "Flat tape — no moves yet" : "Showing last close"}
        </span>
      )}
    </div>
  );
}

function MoverGroup({ label, movers }: { label: string; movers: Mover[] }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="eyebrow hidden sm:inline">{label}</span>
      <div className="flex items-center gap-1.5">
        {movers.map((m) => {
          const up = m.pct > 0;
          return (
            <span
              key={m.symbol}
              className="flex items-center gap-1.5 rounded-md bg-white/[0.03] py-1 pl-1 pr-2"
              title={`${m.symbol} ${fmtPct(m.pct, 2, true)} today`}
            >
              <TickerLogo
                symbol={m.symbol}
                accent={up ? "var(--color-pos)" : "var(--color-neg)"}
                size={16}
              />
              <span className="font-mono text-[11px] text-mute">{m.symbol}</span>
              <span
                className={`font-mono tnum text-[11px] ${up ? "text-pos" : "text-neg"}`}
              >
                {fmtPct(m.pct, 1, true)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
