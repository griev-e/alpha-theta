"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVisibilityPoll } from "@/lib/useVisibilityPoll";
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
  // Serialized last payload: server + CDN caches make byte-identical repeats
  // routine (all weekend, every poll), and a fresh object identity per poll
  // would rerun every consumer memo — including the Edge Engine's full
  // compute — on data that didn't move. Same payload → same identities.
  const lastPayloadRef = useRef("");

  const fetchQuotes = useCallback(async () => {
    if (!key) return;
    try {
      const res = await fetch(`/api/vega/quotes?symbols=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as VegaQuotesResponse;
      if (keyRef.current !== key) return; // symbol set changed mid-flight
      const payload = `${key}|${JSON.stringify(data.quotes)}`;
      if (payload !== lastPayloadRef.current) {
        lastPayloadRef.current = payload;
        setQuotes(data.quotes);
        setAsOf(data.asOf);
      }
      setDegraded(false);
    } catch {
      if (keyRef.current !== key) return;
      setDegraded(true);
    }
  }, [key]);

  // Initial fetch on key change; steady-state cadence via the shared poll.
  useEffect(() => {
    void fetchQuotes();
  }, [fetchQuotes]);
  const tick = useCallback(() => void fetchQuotes(), [fetchQuotes]);
  useVisibilityPoll(tick, POLL_MS);

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
