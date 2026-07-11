"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Interval, IntradaySeries } from "./types";

const POLL_MS = 60_000;

export interface IntradayData {
  series: IntradaySeries | null;
  /** True while the FIRST load for a symbol/interval is in flight. */
  loading: boolean;
  /** True when the provider has conclusively nothing for this symbol. */
  empty: boolean;
  degraded: boolean;
}

/**
 * Bars for one symbol at one interval — fetched on change, then re-polled
 * every 60s while the tab is visible (daily bars don't re-poll; they move
 * once a day and the CDN already holds them). Keeps the previous series
 * during a symbol switch so the chart crossfades instead of unmounting.
 */
export function useIntraday(symbol: string, interval: Interval): IntradayData {
  const [series, setSeries] = useState<IntradaySeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const keyRef = useRef("");
  const key = `${symbol}:${interval}`;
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  const load = useCallback(
    async (initial: boolean) => {
      if (!symbol) return;
      if (initial) {
        setLoading(true);
        setEmpty(false);
      }
      try {
        const res = await fetch(
          `/api/vega/intraday?symbol=${encodeURIComponent(symbol)}&interval=${interval}`
        );
        if (keyRef.current !== key) return;
        if (res.status === 404) {
          setSeries(null);
          setEmpty(true);
          setDegraded(false);
          return;
        }
        if (!res.ok) throw new Error();
        const data = (await res.json()) as IntradaySeries;
        if (keyRef.current !== key) return;
        setSeries(data);
        setEmpty(false);
        setDegraded(false);
      } catch {
        if (keyRef.current !== key) return;
        setDegraded(true);
      } finally {
        if (keyRef.current === key && initial) setLoading(false);
      }
    },
    [symbol, interval, key]
  );

  useEffect(() => {
    void load(true);
    if (interval === "1d") return; // daily bars don't need a poll
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer === null) timer = setInterval(() => void load(false), POLL_MS);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void load(false);
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
  }, [load, interval]);

  return { series, loading, empty, degraded };
}
