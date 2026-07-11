"use client";

import { useEffect } from "react";

/**
 * The visibility-gated poll loop shared by vega's data hooks (and any future
 * poller): run `tick` every `ms` while the tab is visible, fire it
 * immediately when the tab becomes visible again, and stop cold when hidden.
 * The INITIAL fetch stays with the owning hook (it usually differs — loading
 * flags, one-shot semantics); this owns only the steady-state cadence, so a
 * lifecycle fix lands in every poller at once.
 */
export function useVisibilityPoll(
  tick: () => void,
  ms: number,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer === null) timer = setInterval(tick, ms);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        tick();
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
  }, [tick, ms, enabled]);
}
