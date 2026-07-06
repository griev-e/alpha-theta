"use client";

import { useEffect, useRef, useState } from "react";
import { fmtPct, fmtUSD } from "@/lib/format";
import { Tooltip } from "./Tooltip";

/**
 * Brand logo for a ticker (Parqet's keyless logo CDN), falling back to the
 * accent-colored monogram chip when no logo exists for the symbol.
 *
 * With `peek`, a long-hover pops a mini card (name · price · day change) through
 * the shared portal Tooltip so it never clips inside a scrolling table (§115).
 * The quote is fetched lazily on first hover and module-cached, so it costs one
 * request per symbol and reveals instantly on every hover after.
 */
export function TickerLogo({
  symbol,
  accent,
  size = 32,
  peek = false,
  peekName,
}: {
  symbol: string;
  accent: string;
  size?: number;
  /** Long-hover reveals a live price/day-change peek card (§115). */
  peek?: boolean;
  /** Company name for the peek title; falls back to the symbol. */
  peekName?: string;
}) {
  const [failed, setFailed] = useState(false);

  const visual = failed ? (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-semibold"
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${accent} 14%, transparent)`,
        color: accent,
      }}
    >
      {symbol.slice(0, 2)}
    </span>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- tiny remote logos; next/image gains nothing here
    <img
      src={`https://assets.parqet.com/logos/symbol/${encodeURIComponent(symbol)}?format=jpg`}
      alt={`${symbol} logo`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-lg border border-edge object-cover"
      style={{ width: size, height: size }}
    />
  );

  if (!peek) return visual;

  return (
    <Tooltip
      content={<TickerPeekCard symbol={symbol} name={peekName} accent={accent} />}
      underline={false}
      openDelay={350}
      maxWidth={210}
    >
      {visual}
    </Tooltip>
  );
}

/** Module cache of peeked quotes — one fetch per symbol for the session. */
const peekCache = new Map<string, { price: number; prevClose: number | null }>();

function TickerPeekCard({
  symbol,
  name,
  accent,
}: {
  symbol: string;
  name?: string;
  accent: string;
}) {
  // Lazy initializers read the module cache, so a cache hit needs no effect
  // work at all (and no synchronous setState in the effect body).
  const [quote, setQuote] = useState(() => peekCache.get(symbol) ?? null);
  const [state, setState] = useState<"idle" | "loading" | "error">(
    peekCache.has(symbol) ? "idle" : "loading",
  );
  const alive = useRef(true);

  useEffect(() => {
    if (peekCache.has(symbol)) return; // already served by the initializer
    alive.current = true;
    fetch(`/api/quotes?symbols=${encodeURIComponent(symbol)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive.current) return;
        const q = j?.quotes?.[symbol];
        if (q && typeof q.price === "number") {
          const val = { price: q.price, prevClose: q.prevClose ?? null };
          peekCache.set(symbol, val);
          setQuote(val);
          setState("idle");
        } else {
          setState("error");
        }
      })
      .catch(() => {
        if (alive.current) setState("error");
      });
    return () => {
      alive.current = false;
    };
  }, [symbol]);

  const dayPct =
    quote && quote.prevClose && quote.prevClose > 0
      ? (quote.price - quote.prevClose) / quote.prevClose
      : null;

  return (
    <div className="min-w-[120px] text-left">
      <div className="flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: accent }}
        />
        <span className="truncate font-medium text-ink">{name ?? symbol}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
          {symbol}
        </span>
        {state === "loading" ? (
          <span className="font-mono text-[11px] text-faint">…</span>
        ) : quote ? (
          <span className="flex items-baseline gap-2">
            <span className="font-mono tnum text-[12px] text-ink">
              {fmtUSD(quote.price)}
            </span>
            {dayPct !== null && (
              <span
                className={`font-mono tnum text-[11px] ${
                  dayPct >= 0 ? "text-pos" : "text-neg"
                }`}
              >
                {fmtPct(dayPct, 2, true)}
              </span>
            )}
          </span>
        ) : (
          <span className="font-mono text-[11px] text-faint">no quote</span>
        )}
      </div>
    </div>
  );
}
