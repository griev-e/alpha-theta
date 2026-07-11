"use client";

import { useEffect, useMemo, useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import { pricesFromQuotes, sweepAlerts, type PriceMap } from "./alerts";
import { useVega } from "./store";
import { useVegaQuotes } from "./useVegaQuotes";

/**
 * The live half of the alert engine — mounted ONCE in VegaShell so alerts
 * ring on every vega page. Polls quotes for the symbols with armed alerts
 * (nothing armed → nothing polled), sweeps each tick against the previous
 * one through the pure `sweepAlerts`, persists fired stamps, and surfaces a
 * toast + (permission-granted) browser notification per hit.
 *
 * Provider hygiene: this rides the same 30s batched quote proxy as the
 * cockpit; overlapping symbols are served from the server's warm quote cache,
 * so arming alerts adds at most one small batch call per poll.
 */
export function useAlertEngine(): void {
  const { ready, state, applyAlertSweep } = useVega();
  const toast = useToast();

  const armedSymbols = useMemo(
    () => [...new Set(state.alerts.filter((a) => !a.firedAt).map((a) => a.symbol))].sort(),
    [state.alerts]
  );
  const { quotes } = useVegaQuotes(ready ? armedSymbols : []);

  const prevRef = useRef<PriceMap>({});
  const alertsRef = useRef(state.alerts);
  useEffect(() => {
    alertsRef.current = state.alerts;
  }, [state.alerts]);

  useEffect(() => {
    const cur = pricesFromQuotes(quotes);
    if (Object.keys(cur).length === 0) return;
    const prev = prevRef.current;
    const { fired, next } = sweepAlerts(
      alertsRef.current,
      prev,
      cur,
      new Date().toISOString()
    );
    prevRef.current = { ...prev, ...cur };
    if (fired.length === 0) return;
    applyAlertSweep(next);
    for (const a of fired) {
      const msg = `${a.symbol} crossed ${a.dir} ${a.price.toFixed(2)}${a.note ? ` — ${a.note}` : ""}`;
      toast(msg, { tone: "warn", duration: 8000, href: "/vega/chart" });
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(`vega · ${a.symbol}`, { body: msg });
        }
      } catch {
        /* notifications unsupported — the toast already fired */
      }
    }
  }, [quotes, applyAlertSweep, toast]);
}

/** Ask for browser-notification permission off a user gesture (arming an
 *  alert). Safe no-op when the API is missing or already decided. */
export function requestAlertPermission(): void {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch {
    /* unsupported */
  }
}
