"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { makeSampleTrades } from "./sample";
import {
  EMPTY_VEGA_STATE,
  migrateVegaState,
  WATCHLIST_MAX,
  type NewTrade,
  type Trade,
  type VegaSettings,
  type VegaState,
} from "./types";

/**
 * vega's store — mirrors the shape of lib/store.tsx / lib/theta/store.tsx
 * (localStorage-backed, pure mutations through one `mutate`), with one
 * deliberate difference: the vega blob is browser-local even when accounts
 * are enabled. The journal is a personal scratch ledger, not shared financial
 * state, and keeping it out of `user_state` means no schema migration for
 * existing deploys. When accounts are on, the storage key is suffixed with
 * the signed-in user id so two people on one machine still can't read each
 * other's journals; server-side persistence can layer on later without
 * changing this API.
 */

const STORAGE_KEY = "vega.state.v1";

interface VegaStore {
  /** false until storage has been read (avoids hydration flicker). */
  ready: boolean;
  /** The bundled sample journal is loaded (vs. the user's own trades). */
  isSample: boolean;
  state: VegaState;

  setFocus: (symbol: string) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;

  addTrade: (t: NewTrade) => void;
  updateTrade: (id: string, patch: Partial<NewTrade>) => void;
  deleteTrade: (id: string) => void;
  /** Merge imported trades (skip exact duplicates), never replacing history. */
  importTrades: (ts: NewTrade[]) => void;

  setSettings: (patch: Partial<VegaSettings>) => void;

  loadSampleJournal: () => void;
  clearJournal: () => void;
  clearAll: () => void;
}

const Ctx = createContext<VegaStore | null>(null);

function uid(): string {
  try {
    return `v_${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `v_${Math.random().toString(36).slice(2, 10)}`;
  }
}

const cleanSymbol = (s: string): string =>
  s.trim().toUpperCase().replace(/[^A-Z0-9.^=\-]/g, "");

export function VegaProvider({ children }: { children: ReactNode }) {
  const { enabled, status, userId } = useAuth();
  // Per-user key isolation when accounts are on (see module docblock).
  const storageKey = useMemo(() => {
    if (!enabled) return STORAGE_KEY;
    if (status === "authenticated" && userId) return `${STORAGE_KEY}:${userId}`;
    return null; // session still resolving (or signed out — middleware redirects)
  }, [enabled, status, userId]);

  const [state, setState] = useState<VegaState>(EMPTY_VEGA_STATE);
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!storageKey) {
      setReady(false);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? migrateVegaState(JSON.parse(raw)) : null;
      setState(parsed ?? EMPTY_VEGA_STATE);
      stateRef.current = parsed ?? EMPTY_VEGA_STATE;
    } catch {
      setState(EMPTY_VEGA_STATE);
    }
    setReady(true);
  }, [storageKey]);

  const persist = useCallback(
    (next: VegaState) => {
      stateRef.current = next;
      setState(next);
      if (!storageKey) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* private mode — keep in memory */
      }
    },
    [storageKey]
  );

  /** Apply a pure update. Journal edits drop the sample flag via `own`. */
  const mutate = useCallback(
    (fn: (s: VegaState) => VegaState, own = false) => {
      const cur = stateRef.current;
      const next = fn(cur);
      persist(own ? { ...next, isSample: undefined } : next);
    },
    [persist]
  );

  const setFocus = useCallback(
    (symbol: string) => {
      const sym = cleanSymbol(symbol);
      if (!sym) return;
      mutate((s) => ({ ...s, focus: sym }));
    },
    [mutate]
  );

  const addToWatchlist = useCallback(
    (symbol: string) => {
      const sym = cleanSymbol(symbol);
      if (!sym) return;
      mutate((s) =>
        s.watchlist.includes(sym)
          ? s
          : { ...s, watchlist: [...s.watchlist, sym].slice(0, WATCHLIST_MAX) }
      );
    },
    [mutate]
  );

  const removeFromWatchlist = useCallback(
    (symbol: string) =>
      mutate((s) => ({
        ...s,
        watchlist: s.watchlist.filter((x) => x !== symbol),
      })),
    [mutate]
  );

  const addTrade = useCallback(
    (t: NewTrade) =>
      mutate(
        (s) => ({
          ...s,
          trades: [{ ...t, id: uid(), symbol: cleanSymbol(t.symbol) }, ...s.trades],
        }),
        true
      ),
    [mutate]
  );

  const updateTrade = useCallback(
    (id: string, patch: Partial<NewTrade>) =>
      mutate(
        (s) => ({
          ...s,
          trades: s.trades.map((t) => (t.id === id ? { ...t, ...patch, id } : t)),
        }),
        true
      ),
    [mutate]
  );

  const deleteTrade = useCallback(
    (id: string) =>
      mutate((s) => ({ ...s, trades: s.trades.filter((t) => t.id !== id) }), true),
    [mutate]
  );

  const importTrades = useCallback(
    (ts: NewTrade[]) =>
      mutate((s) => {
        // Merge-append with exact-duplicate skip, so re-importing the same
        // file never doubles the journal.
        const key = (t: NewTrade) =>
          `${t.symbol}|${t.side}|${t.qty}|${t.entry}|${t.exit}|${t.entryAt}`;
        const seen = new Set(s.trades.map(key));
        const fresh: Trade[] = [];
        for (const t of ts) {
          const k = key(t);
          if (seen.has(k)) continue;
          seen.add(k);
          fresh.push({ ...t, id: uid(), symbol: cleanSymbol(t.symbol) });
        }
        if (fresh.length === 0) return s;
        return { ...s, trades: [...fresh, ...s.trades] };
      }, true),
    [mutate]
  );

  const setSettings = useCallback(
    (patch: Partial<VegaSettings>) =>
      mutate((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    [mutate]
  );

  const loadSampleJournal = useCallback(
    () =>
      mutate((s) => ({ ...s, trades: makeSampleTrades(), isSample: true })),
    [mutate]
  );

  const clearJournal = useCallback(
    () => mutate((s) => ({ ...s, trades: [] }), true),
    [mutate]
  );

  const clearAll = useCallback(() => persist(EMPTY_VEGA_STATE), [persist]);

  const value = useMemo<VegaStore>(
    () => ({
      ready,
      isSample: state.isSample === true,
      state,
      setFocus,
      addToWatchlist,
      removeFromWatchlist,
      addTrade,
      updateTrade,
      deleteTrade,
      importTrades,
      setSettings,
      loadSampleJournal,
      clearJournal,
      clearAll,
    }),
    [
      ready, state,
      setFocus, addToWatchlist, removeFromWatchlist,
      addTrade, updateTrade, deleteTrade, importTrades,
      setSettings, loadSampleJournal, clearJournal, clearAll,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVega(): VegaStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useVega must be used inside VegaProvider");
  return ctx;
}
