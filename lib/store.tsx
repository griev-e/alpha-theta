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
import { buildPortfolio, mergeAllFundamentals } from "./analytics/build";
import { parsePortfolioCSV } from "./csv";
import { primeLiveCMA } from "./live/cma";
import { useLiveData } from "./live/useLiveData";
import { useReturnHistory } from "./live/useReturnHistory";
import { getServerState, putPortfolio } from "./persist";
import {
  activePortfolio,
  addPortfolio,
  makePortfolio,
  migrate,
  removePortfolio,
  renamePortfolio as renameInSet,
  selectPortfolio as selectInSet,
  updateActive,
  uniqueName,
  type PortfolioSet,
} from "./portfolios";
import { SAMPLE_CASH, SAMPLE_CSV } from "./sample";
import type { Portfolio, RawHolding } from "./types";

const STORAGE_KEY = "alpha.portfolio.v1";
/** Pre-rebrand keys — migrated on first load, then removed. */
const LEGACY_STORAGE_KEYS = [
  "grieve.portfolio.v1",
  "sanctum.portfolio.v1",
  "hlee.portfolio.v1",
  "meridian.portfolio.v1",
];

export interface LiveStatus {
  /** ISO time of the last successful quote refresh, null = none yet. */
  quotesAt: string | null;
  fundamentalsAt: string | null;
  /** Last quote fetch failed — running on imported prices / snapshot. */
  degraded: boolean;
  /** How many positions are currently repriced live. */
  livePriceCount: number;
  /** True while a manual refresh is in flight. */
  refreshing: boolean;
}

/** Lightweight descriptor of one portfolio in the set, for the switcher UI. */
export interface PortfolioSummary {
  id: string;
  name: string;
  isDemo: boolean;
  /** Number of holdings (excludes cash). */
  count: number;
}

/** Options for how an import lands. */
export interface ImportOptions {
  /** Import into a brand-new portfolio instead of replacing the active one. */
  asNew?: boolean;
  /** Name for the new portfolio (only used with `asNew`). */
  name?: string;
}

/**
 * Portfolio data — changes only when the book itself moves (import, cash edit,
 * portfolio switch, or a real price tick that rebuilds the portfolio).
 * Deliberately split from `LiveStatus`: the live status carries a `quotesAt`
 * timestamp that updates on every 60s poll even when no price moved, so folding
 * it in here would re-render every analytics page once a minute for nothing.
 */
interface PortfolioData {
  /** null until localStorage has been read (avoids hydration flicker). */
  ready: boolean;
  /** True when the active portfolio has holdings to analyze. */
  hasData: boolean;
  isDemo: boolean;
  portfolio: Portfolio | null;
  /** Every portfolio in the set (for the switcher). Empty when none exist. */
  portfolios: PortfolioSummary[];
  /** id of the active portfolio, or null when the set is empty. */
  activeId: string | null;
}

/** Stable action handles — identity survives price ticks. */
interface PortfolioActions {
  /** Import holdings into the active portfolio (or a new one via `opts.asNew`). */
  importHoldings: (
    holdings: RawHolding[],
    cash: number | null,
    opts?: ImportOptions
  ) => void;
  loadDemo: () => void;
  setCash: (cash: number) => void;
  /** Create an empty portfolio and switch to it. */
  createPortfolio: (name?: string) => void;
  renamePortfolio: (id: string, name: string) => void;
  /** Delete a portfolio; reassigns the active one, or empties the set. */
  deletePortfolio: (id: string) => void;
  /** Switch which portfolio is active. */
  selectPortfolio: (id: string) => void;
  /** Force-refetch live quotes + fundamentals, bypassing caches. */
  refreshLive: () => Promise<void>;
}

const DataCtx = createContext<PortfolioData | null>(null);
const LiveCtx = createContext<LiveStatus | null>(null);
const ActionsCtx = createContext<PortfolioActions | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { enabled, status } = useAuth();
  // Server-backed when real auth is on and a user is signed in; otherwise the
  // original localStorage model (open mode / not signed in).
  const serverMode = enabled && status === "authenticated";

  const [set, setSet] = useState<PortfolioSet | null>(null);
  const [ready, setReady] = useState(false);

  // True once it's safe to write to the server: only after a successful hydrate.
  // A failed hydrate leaves this false so an edit can't overwrite the (possibly
  // non-empty) saved portfolio with the empty state we fall back to on failure.
  const serverWritableRef = useRef(false);

  useEffect(() => {
    primeLiveCMA();
  }, []);

  // Hydrate from the right backend. In server mode we read ONLY from the server
  // (never the shared-browser localStorage), so one user's portfolio can't leak
  // to the next person who signs in on the same machine. `migrate` normalizes
  // both the multi-portfolio set shape and the legacy single-portfolio blob.
  useEffect(() => {
    if (!enabled) {
      serverWritableRef.current = true; // open mode writes localStorage, never the server
      try {
        let raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          for (const legacy of LEGACY_STORAGE_KEYS) {
            const old = localStorage.getItem(legacy);
            if (old && !raw) {
              raw = old;
              localStorage.setItem(STORAGE_KEY, old);
            }
            localStorage.removeItem(legacy);
          }
        }
        setSet(raw ? migrate(JSON.parse(raw)) : null);
      } catch {
        setSet(null); // corrupted state — start fresh
      }
      setReady(true);
      return;
    }
    if (status === "loading") {
      setReady(false);
      return;
    }
    if (status === "authenticated") {
      let alive = true;
      setReady(false);
      serverWritableRef.current = false;
      getServerState().then((s) => {
        if (!alive) return;
        if (s === null) {
          // Hydrate failed after retries. Surface no portfolio but keep server
          // writes disabled, so an import/edit can't overwrite the saved book;
          // the next load retries. In-memory edits still work (private-mode-like).
          serverWritableRef.current = false;
          setSet(null);
          setReady(true);
          return;
        }
        serverWritableRef.current = true;
        setSet(migrate(s.portfolio));
        setReady(true);
      });
      return () => {
        alive = false;
      };
    }
    // enabled but unauthenticated (middleware normally prevents reaching here)
    setSet(null);
    setReady(true);
  }, [enabled, status]);

  const persist = useCallback(
    (next: PortfolioSet | null) => {
      setSet(next);
      if (serverMode) {
        // Skip the server write until a successful hydrate, so a failed load
        // (shown as empty) can't clobber the saved portfolio.
        if (serverWritableRef.current) void putPortfolio(next);
        return;
      }
      try {
        if (next === null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable (private mode) — keep in memory
      }
    },
    [serverMode]
  );

  const importHoldings = useCallback(
    (holdings: RawHolding[], cash: number | null, opts?: ImportOptions) => {
      const asOf = new Date().toISOString();
      if (opts?.asNew || !activePortfolio(set)) {
        const p = makePortfolio(uniqueName(set, opts?.name || "Portfolio"));
        p.holdings = holdings;
        p.cash = cash ?? 0;
        p.asOf = asOf;
        persist(addPortfolio(set, p));
        return;
      }
      const active = activePortfolio(set)!;
      persist(
        updateActive(set, {
          holdings,
          cash: cash ?? active.cash,
          asOf,
          isDemo: undefined,
        })
      );
    },
    [persist, set]
  );

  const loadDemo = useCallback(() => {
    const { holdings } = parsePortfolioCSV(SAMPLE_CSV);
    const asOf = new Date().toISOString();
    if (!activePortfolio(set)) {
      const p = makePortfolio(uniqueName(set, "Demo"));
      p.holdings = holdings;
      p.cash = SAMPLE_CASH;
      p.asOf = asOf;
      p.isDemo = true;
      persist(addPortfolio(set, p));
      return;
    }
    persist(
      updateActive(set, {
        holdings,
        cash: SAMPLE_CASH,
        asOf,
        isDemo: true,
      })
    );
  }, [persist, set]);

  const setCash = useCallback(
    (cash: number) => {
      if (!activePortfolio(set)) return;
      persist(updateActive(set, { cash }));
    },
    [persist, set]
  );

  const createPortfolio = useCallback(
    (name?: string) => {
      const p = makePortfolio(uniqueName(set, name || "Portfolio"));
      persist(addPortfolio(set, p));
    },
    [persist, set]
  );

  const renamePortfolio = useCallback(
    (id: string, name: string) => {
      if (!set) return;
      persist(renameInSet(set, id, name));
    },
    [persist, set]
  );

  const deletePortfolio = useCallback(
    (id: string) => {
      if (!set) return;
      persist(removePortfolio(set, id));
    },
    [persist, set]
  );

  const selectPortfolio = useCallback(
    (id: string) => {
      if (!set) return;
      persist(selectInSet(set, id));
    },
    [persist, set]
  );

  const active = useMemo(() => activePortfolio(set), [set]);

  const symbols = useMemo(
    () => active?.holdings.map((h) => h.symbol) ?? [],
    [active]
  );
  const liveData = useLiveData(symbols);

  // Primes the return-history singleton the covariance estimator reads (see
  // lib/live/returns.ts). The returned version bumps when a batch of history
  // resolves; it's not an input to buildPortfolio, but folding it into the memo
  // below yields a fresh Portfolio identity so the risk / correlation /
  // optimizer pages recompute against the newly-loaded sample covariance.
  const returnsVersion = useReturnHistory(symbols);

  // Fundamentals merge keyed only on the symbol set + patches (slow-moving), so
  // a 60s quote tick reprices without re-running the field-by-field merge.
  const fundamentals = useMemo(
    () => mergeAllFundamentals(symbols, liveData.patches),
    [symbols, liveData.patches]
  );

  const portfolio = useMemo(
    () =>
      active && active.holdings.length > 0
        ? buildPortfolio(active.holdings, active.cash, active.asOf, {
            quotes: liveData.quotes,
            patches: liveData.patches,
            fundamentals,
          })
        : null,
    // returnsVersion is intentionally a dependency (not consumed by
    // buildPortfolio) so a new batch of primed history re-derives downstream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, liveData.quotes, liveData.patches, fundamentals, returnsVersion]
  );

  const live = useMemo<LiveStatus>(
    () => ({
      quotesAt: liveData.quotesAt,
      fundamentalsAt: liveData.fundamentalsAt,
      degraded: liveData.degraded,
      livePriceCount:
        portfolio?.positions.filter((p) => p.isLivePrice).length ?? 0,
      refreshing: liveData.refreshing,
    }),
    [
      liveData.quotesAt,
      liveData.fundamentalsAt,
      liveData.degraded,
      liveData.refreshing,
      portfolio,
    ]
  );

  const summaries = useMemo<PortfolioSummary[]>(
    () =>
      set?.portfolios.map((p) => ({
        id: p.id,
        name: p.name,
        isDemo: !!p.isDemo,
        count: p.holdings.length,
      })) ?? [],
    [set]
  );

  const data = useMemo<PortfolioData>(
    () => ({
      ready,
      hasData: !!portfolio,
      isDemo: !!active?.isDemo,
      portfolio,
      portfolios: summaries,
      activeId: set?.activeId ?? null,
    }),
    [ready, portfolio, active?.isDemo, summaries, set?.activeId]
  );

  const actions = useMemo<PortfolioActions>(
    () => ({
      importHoldings,
      loadDemo,
      setCash,
      createPortfolio,
      renamePortfolio,
      deletePortfolio,
      selectPortfolio,
      refreshLive: liveData.refresh,
    }),
    [
      importHoldings,
      loadDemo,
      setCash,
      createPortfolio,
      renamePortfolio,
      deletePortfolio,
      selectPortfolio,
      liveData.refresh,
    ]
  );

  // Three nested providers, narrowest churn innermost: `live` ticks every poll,
  // `data` only on a real book change, `actions` ~never. Consumers subscribe to
  // just the slice they need (usePortfolio / useLiveStatus / usePortfolioActions).
  return (
    <ActionsCtx.Provider value={actions}>
      <DataCtx.Provider value={data}>
        <LiveCtx.Provider value={live}>{children}</LiveCtx.Provider>
      </DataCtx.Provider>
    </ActionsCtx.Provider>
  );
}

export function usePortfolio(): PortfolioData {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error("usePortfolio must be used inside PortfolioProvider");
  return ctx;
}

export function useLiveStatus(): LiveStatus {
  const ctx = useContext(LiveCtx);
  if (!ctx) throw new Error("useLiveStatus must be used inside PortfolioProvider");
  return ctx;
}

export function usePortfolioActions(): PortfolioActions {
  const ctx = useContext(ActionsCtx);
  if (!ctx)
    throw new Error("usePortfolioActions must be used inside PortfolioProvider");
  return ctx;
}
