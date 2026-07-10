"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  FundamentalsPatch,
  FundamentalsResponse,
  LiveQuote,
  QuotesResponse,
} from "./types";

export interface LiveData {
  quotes: Record<string, LiveQuote>;
  quotesAt: string | null;
  patches: Record<string, FundamentalsPatch>;
  fundamentalsAt: string | null;
  /** True when the last quote fetch failed — UI shows snapshot mode. */
  degraded: boolean;
  /** True while a manual refresh is in flight. */
  refreshing: boolean;
  /** Force-refetch quotes + fundamentals, bypassing every cache layer. */
  refresh: () => Promise<void>;
}

const QUOTE_POLL_MS = 60_000;

/**
 * True when two quote maps carry the same prices — i.e. nothing worth a
 * re-render moved. Compares the meaningful fields (price, prevClose) field by
 * field; the per-quote `asOf` is intentionally ignored (the top-level
 * `quotesAt` still refreshes every poll) so an unchanged tape doesn't churn
 * the portfolio build.
 */
function quotesUnchanged(
  a: Record<string, LiveQuote>,
  b: Record<string, LiveQuote>
): boolean {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  for (const k of ak) {
    const x = a[k];
    const y = b[k];
    if (!y || x.price !== y.price || x.prevClose !== y.prevClose) return false;
  }
  return true;
}

/**
 * Polls live quotes (60s, only while the tab is visible) and fetches the
 * fundamentals overlay once per symbol set. Failures degrade silently to
 * imported prices and the bundled snapshot. `refresh()` is the manual
 * override — it punches through the CDN and server caches.
 */
export function useLiveData(symbols: string[]): LiveData {
  // Sorted key keeps the CDN cache hot and effects stable.
  const key = useMemo(() => [...symbols].sort().join(","), [symbols]);
  // Tracks the latest key so in-flight fetches can detect a mid-flight symbol
  // change. Updated in an effect (not during render) so it's compiler-safe; it
  // still lands before the fetch effect below (declaration order), and a stale
  // resolution compares against the newest key regardless.
  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [quotesAt, setQuotesAt] = useState<string | null>(null);
  const [patches, setPatches] = useState<Record<string, FundamentalsPatch>>({});
  const [fundamentalsAt, setFundamentalsAt] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Pending partial-overlay retry timer, tracked so the effect cleanup can
  // cancel it on unmount / symbol change (otherwise the keyRef guard alone lets
  // it fire after unmount and setState on a dead hook).
  const fundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchQuotes = useCallback(
    async (force = false) => {
      if (!key) return;
      try {
        const res = await fetch(
          `/api/quotes?symbols=${key}${force ? "&fresh=1" : ""}`
        );
        if (!res.ok) throw new Error();
        const data = (await res.json()) as QuotesResponse;
        if (keyRef.current !== key) return; // symbol set changed mid-flight
        // Skip the state update when prices haven't moved (common after
        // hours) — avoids rebuilding the portfolio and re-running
        // animations on every poll. Compare the meaningful fields directly
        // instead of serializing both maps on every poll.
        setQuotes((prev) => (quotesUnchanged(prev, data.quotes) ? prev : data.quotes));
        setQuotesAt(data.asOf);
        setDegraded(false);
      } catch {
        if (keyRef.current === key) setDegraded(true);
      }
    },
    [key]
  );

  const fetchFundamentals = useCallback(
    async (force = false, attempt = 0) => {
      if (!key) return;
      try {
        const res = await fetch(
          `/api/fundamentals?symbols=${key}${force ? "&fresh=1" : ""}`
        );
        if (!res.ok) throw new Error();
        const data = (await res.json()) as FundamentalsResponse;
        if (keyRef.current !== key) return;
        setPatches(data.patches);
        setFundamentalsAt(data.asOf);
        // A cold server can hit its fetch deadline and return a partial
        // overlay; the fetched symbols are now warm-cached there, so a
        // follow-up finishes the rest. Bounded so a dead provider can't loop.
        // The timer id is tracked so the effect cleanup can cancel a pending
        // retry on unmount / symbol change.
        if (data.partial && attempt < 3) {
          if (fundTimer.current) clearTimeout(fundTimer.current);
          fundTimer.current = setTimeout(() => {
            fundTimer.current = null;
            if (keyRef.current === key) void fetchFundamentals(force, attempt + 1);
          }, 8_000);
        }
      } catch {
        // snapshot fallback — nothing to do
      }
    },
    [key]
  );

  useEffect(() => {
    if (!key) {
      setQuotes({});
      setQuotesAt(null);
      setPatches({});
      setFundamentalsAt(null);
      return;
    }

    fetchQuotes();
    fetchFundamentals();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchQuotes();
    }, QUOTE_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchQuotes();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      if (fundTimer.current) {
        clearTimeout(fundTimer.current);
        fundTimer.current = null;
      }
    };
  }, [key, fetchQuotes, fetchFundamentals]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Force both: quotes AND fundamentals punch through the CDN + warm caches
      // (fundamentals otherwise serve the 12h cache, so a manual refresh after
      // earnings would keep stale margins/beta/analyst data).
      await Promise.all([fetchQuotes(true), fetchFundamentals(true)]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchQuotes, fetchFundamentals]);

  return {
    quotes,
    quotesAt,
    patches,
    fundamentalsAt,
    degraded,
    refreshing,
    refresh,
  };
}
