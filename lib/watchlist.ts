"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "alpha.watchlist.v1";

/** Broadcast within the tab so multiple mounts (rail + header star) stay in sync. */
const EVENT = "alpha:watchlist";

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function write(symbols: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(symbols));
  } catch {
    /* private mode — the watchlist just won't persist */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/**
 * A tiny localStorage-backed watchlist — symbols you want to track in Research
 * without holding them. Lives entirely client-side (like the portfolio), and
 * syncs across the current tab's mounts via a custom event so the rail and the
 * header star never disagree.
 */
export function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setSymbols(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync); // other tabs
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const has = useCallback(
    (symbol: string) => symbols.includes(symbol.toUpperCase()),
    [symbols]
  );

  const toggle = useCallback((symbol: string) => {
    const s = symbol.toUpperCase();
    const cur = read();
    write(cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  }, []);

  const remove = useCallback((symbol: string) => {
    const s = symbol.toUpperCase();
    write(read().filter((x) => x !== s));
  }, []);

  return { symbols, has, toggle, remove };
}
