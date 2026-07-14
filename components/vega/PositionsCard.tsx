"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { fmtNum, fmtUSD } from "@/lib/format";
import type { OpenBook } from "@/lib/vega/positions";

/**
 * The working book, marked live — shared by the cockpit and risk pages. Every
 * open journal trade with its live mark, unrealized P&L and open R; symbols
 * the quote poll can't price show as unpriced (never a stale number). Totals
 * carry the honest caveats: how many rows are unpriced, how many have no stop.
 */
export function PositionsCard({
  book,
  i = 0,
  onFocus,
}: {
  book: OpenBook;
  i?: number;
  /** Called with a symbol when a row is clicked (defaults to charting it). */
  onFocus?: (symbol: string) => void;
}) {
  const router = useRouter();
  if (book.count === 0) return null;
  const totalTone =
    book.unrealized === null
      ? "text-faint"
      : book.unrealized > 0
        ? "text-pos"
        : book.unrealized < 0
          ? "text-neg"
          : "text-mute";
  return (
    <Card i={i} className="p-5">
      <CardHeader
        eyebrow={`${book.count} open`}
        title="Working positions"
        right={
          <Link href="/vega/journal" className="text-[12px] text-faint hover:text-ink">
            Journal →
          </Link>
        }
      />
      <div className="mt-3 flex items-baseline justify-between">
        <span className={`font-mono tnum text-[18px] ${totalTone}`}>
          {book.unrealized === null ? "unpriced" : fmtUSD(book.unrealized)}
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
          unrealized
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {book.positions.slice(0, 6).map((p) => (
          <li key={p.trade.id}>
            <button
              onClick={() =>
                onFocus ? onFocus(p.trade.symbol) : router.push("/vega/journal")
              }
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left font-mono text-[11.5px] transition-colors hover:bg-white/[0.04]"
            >
              <span className="text-ink">{p.trade.symbol}</span>
              <span className={`text-[9px] uppercase ${p.trade.side === "long" ? "text-pos" : "text-neg"}`}>
                {p.trade.side}
              </span>
              <span className="tnum text-faint">
                {p.trade.qty} @ {p.trade.entry.toFixed(2)}
              </span>
              <span className="ml-auto flex items-center gap-2">
                {p.unrealizedR !== null && (
                  <span className={`tnum text-[10px] ${p.unrealizedR >= 0 ? "text-pos" : "text-neg"}`}>
                    {fmtNum(p.unrealizedR, 1)}R
                  </span>
                )}
                <span
                  className={`tnum ${
                    p.unrealized === null
                      ? "text-faint"
                      : p.unrealized > 0
                        ? "text-pos"
                        : p.unrealized < 0
                          ? "text-neg"
                          : "text-mute"
                  }`}
                >
                  {p.unrealized === null ? "—" : fmtUSD(p.unrealized)}
                </span>
              </span>
            </button>
          </li>
        ))}
        {book.positions.length > 6 && (
          <li className="px-1.5 font-mono text-[10.5px] text-faint">
            +{book.positions.length - 6} more in the journal
          </li>
        )}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-faint">
        {fmtUSD(book.riskToStop, true)} at risk if every stop hits
        {book.noStop > 0 && (
          <span className="text-warn"> · {book.noStop} without a stop</span>
        )}
        {book.unpriced > 0 && <span> · {book.unpriced} unpriced right now</span>}
      </p>
    </Card>
  );
}
