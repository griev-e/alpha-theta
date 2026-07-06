"use client";

import { useEffect, useState } from "react";

/**
 * The first-import moment (§119). On the session where a real portfolio first
 * has data, Overview conducts a one-time overture — the hero counts up from 0,
 * the treemap and table play their entrance — a deliberate ~2s flourish, marked
 * done in localStorage so it never plays again. This is the persisted,
 * once-*ever* cousin of `useFirstView` (which is once *per session*).
 *
 * The persisted flag is read once at mount via a lazy initializer, so the hero
 * can count from 0 the moment `active` turns true (an effect would fire too
 * late). The read is a no-op on the server (localStorage undefined → "seen"),
 * and `active` is false until the client marks the portfolio ready, so the
 * conducting value can't differ between server and client on the first paint.
 */
const KEY = "alpha.overture.v1";

export function useOverture(active: boolean): boolean {
  const [unseen] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "1";
    } catch {
      // private mode / SSR — treat as seen so the overture never loops
      return false;
    }
  });

  const conducting = active && unseen;

  useEffect(() => {
    if (!conducting) return;
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  }, [conducting]);

  return conducting;
}
