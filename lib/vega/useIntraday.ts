"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVisibilityPoll } from "@/lib/useVisibilityPoll";
import { repairBars } from "./indicators";
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
 * during a symbol switch so the chart crossfades instead of unmounting —
 * but if the switch's FIRST load fails, the stale symbol's tape is dropped
 * rather than shown under the new symbol's header.
 *
 * Bad-print hygiene (`repairBars`) is applied here, once, so every consumer
 * of the intraday feed gets repaired bars — no page can forget.
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
        setSeries({ ...data, bars: repairBars(data.bars) });
        setEmpty(false);
        setDegraded(false);
      } catch {
        if (keyRef.current !== key) return;
        // A failed FIRST load for this key means whatever series we still
        // hold belongs to a different symbol/interval — drop it instead of
        // letting a stale tape masquerade under the new header.
        if (initial) setSeries(null);
        setDegraded(true);
      } finally {
        if (keyRef.current === key && initial) setLoading(false);
      }
    },
    [symbol, interval, key]
  );

  // Initial fetch on key change; steady-state cadence via the shared poll
  // (daily bars don't re-poll — they move once a day and the CDN holds them).
  useEffect(() => {
    void load(true);
  }, [load]);
  const tick = useCallback(() => void load(false), [load]);
  useVisibilityPoll(tick, POLL_MS, interval !== "1d");

  return { series, loading, empty, degraded };
}
