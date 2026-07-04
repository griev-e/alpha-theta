"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTheta } from "./store";

/**
 * Best-effort **daily** bank refresh. When accounts are enabled, a bank is
 * linked, and the last sync is stale (>~20h), this quietly pulls a fresh
 * SimpleFIN sync on load (and when the tab regains focus) so balances and
 * transactions stay current without a manual "Sync now". It's mounted once in
 * `ThetaShell`, so it covers every theta page.
 *
 * Limits, stated honestly: theta has no server-side scheduler, so this only
 * fires while the app is open — it's an on-open refresh, not a true background
 * cron. The staleness gate + a module-scoped cooldown keep it to at most one
 * attempt per ~20h window, and failures are silent (the manual Sync button and
 * everything else keep working).
 */
const STALE_MS = 20 * 3600_000;

// Module scope so navigations / remounts share one cooldown clock.
let lastAttempt = 0;

type SimplefinStatus = { connected: boolean; syncedAt: string | null };

export function useSimplefinAutoSync(): void {
  const { enabled, status } = useAuth();
  const { ready, applySimplefinSync } = useTheta();
  const running = useRef(false);

  useEffect(() => {
    // Only in server mode (a link exists), and only once the ledger has
    // hydrated — merging into a not-yet-loaded ledger could race the hydrate.
    if (!enabled || status !== "authenticated" || !ready) return;

    let alive = true;

    const maybeSync = async () => {
      if (running.current || Date.now() - lastAttempt < STALE_MS) return;
      running.current = true;
      try {
        const res = await fetch("/api/theta/simplefin", { credentials: "same-origin" });
        if (!res.ok) return;
        const st = (await res.json()) as SimplefinStatus;
        if (!st.connected) return; // no bank linked — nothing to refresh
        const last = st.syncedAt ? new Date(st.syncedAt).getTime() : 0;
        if (Number.isFinite(last) && last > 0 && Date.now() - last < STALE_MS) return; // fresh enough

        lastAttempt = Date.now(); // stale → attempt now; starts the cooldown even if it fails
        const sync = await fetch("/api/theta/simplefin/sync", {
          method: "POST",
          credentials: "same-origin",
        });
        if (!sync.ok) return;
        const data = await sync.json();
        if (!alive) return;
        applySimplefinSync({ accounts: data.accounts ?? [], transactions: data.transactions ?? [] });
      } catch {
        /* offline / not configured — silent; manual sync remains available */
      } finally {
        running.current = false;
      }
    };

    void maybeSync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void maybeSync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, status, ready, applySimplefinSync]);
}
