"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveQuote, QuotesResponse } from "./types";

export interface PulseItem {
  /** Ticker actually fetched (SPY / QQQ) — the honest label. */
  symbol: string;
  /** Friendly name for the proxy. */
  name: string;
  price: number;
  /** Day change vs previous close, or null when prevClose is unknown. */
  changePct: number | null;
}

// The broad-market proxies the rest of the terminal already leans on (the CMA
// layer reads SPY/QQQ too). Index symbols like ^GSPC can't be used here — the
// quotes proxy sanitizes carets out — so the ETF proxies are the honest,
// resolvable stand-ins for "the tape."
const PULSE_SYMBOLS: { symbol: string; name: string }[] = [
  { symbol: "SPY", name: "S&P 500" },
  { symbol: "QQQ", name: "Nasdaq 100" },
];

const POLL_MS = 60_000;

/**
 * A tiny, self-contained market tape for the shell top bar. Polls the broad
 * proxies every 60s while the tab is visible and degrades to `null` on any
 * failure — consistent with the app's graceful-degradation contract, so a
 * dead provider simply hides the strip rather than showing stale ticks.
 */
export function useMarketPulse(): PulseItem[] | null {
  const [items, setItems] = useState<PulseItem[] | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    const key = PULSE_SYMBOLS.map((s) => s.symbol).join(",");

    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/quotes?symbols=${key}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as QuotesResponse;
        if (!alive) return;
        const next = PULSE_SYMBOLS.map(({ symbol, name }) => {
          const q: LiveQuote | undefined = data.quotes?.[symbol];
          if (!q || !Number.isFinite(q.price)) return null;
          const changePct =
            q.prevClose && q.prevClose > 0 ? q.price / q.prevClose - 1 : null;
          return { symbol, name, price: q.price, changePct };
        }).filter((x): x is PulseItem => x !== null);
        setItems(next.length > 0 ? next : null);
      } catch {
        if (alive) setItems(null);
      }
    };

    load();
    timer.current = setInterval(load, POLL_MS);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return items;
}
