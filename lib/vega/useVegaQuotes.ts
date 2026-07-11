"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VegaQuote, VegaQuotesResponse } from "./types";

const POLL_MS = 30_000;

export interface VegaQuotesData {
  quotes: Record<string, VegaQuote>;
  asOf: string | null;
  /** True when the last fetch failed — the UI shows its degraded state. */
  degraded: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

/**
 * Polls /api/vega/quotes for a symbol set — 30s cadence, only while the tab
 * is visible, one batched request per poll no matter how many symbols. The
 * sorted key keeps the CDN cache hot across consumers with the same list.
 */
export function useVegaQuotes(symbols: string[]): VegaQuotesData {
  const key = useMemo(() => [...new Set(symbols)].sort().join(","), [symbols]);
  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  const [quotes, setQuotes] = useState<Record<string, VegaQuote>>({});
  const [asOf, setAsOf] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchQuotes = useCallback(async () => {
    if (!key) return;
    try {
      const res = await fetch(`/api/vega/quotes?symbols=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as VegaQuotesResponse;
      if (keyRef.current !== key) return; // symbol set changed mid-flight
      setQuotes(data.quotes);
      setAsOf(data.asOf);
      setDegraded(false);
    } catch {
      if (keyRef.current !== key) return;
      setDegraded(true);
    }
  }, [key]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    void fetchQuotes();
    const start = () => {
      if (timer === null) timer = setInterval(() => void fetchQuotes(), POLL_MS);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void fetchQuotes();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchQuotes]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchQuotes();
    } finally {
      setRefreshing(false);
    }
  }, [fetchQuotes]);

  return { quotes, asOf, degraded, refreshing, refresh };
}
