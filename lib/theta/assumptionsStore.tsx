"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ASSUMPTION_PRESETS,
  cloneAssumptions,
  DEFAULT_ASSUMPTIONS,
  matchPreset,
  type PresetId,
  type ThetaAssumptions,
} from "./assumptions";

/**
 * Holds theta's forward money assumptions — the parallel of alpha's
 * `lib/assumptions/store.tsx`. These are non-sensitive planning *views* (return,
 * yield, inflation, income growth, fallback APRs), so like alpha's market
 * assumptions they persist as a device-level preference in `localStorage`, not
 * per-account server-side. The projection / goal / debt engines take these as an
 * explicit argument, so there's no analytics singleton to prime — pages read the
 * context and pass the values in. A `version` counter bumps on every change for
 * compute keys.
 */

const STORAGE_KEY = "theta.assumptions.v1";

export type ThetaFieldKey = keyof ThetaAssumptions;

interface ThetaAssumptionsCtx {
  assumptions: ThetaAssumptions;
  preset: PresetId | null;
  version: number;
  setField: (key: ThetaFieldKey, value: number) => void;
  applyPreset: (id: PresetId) => void;
  reset: () => void;
}

const Ctx = createContext<ThetaAssumptionsCtx | null>(null);

function load(): ThetaAssumptions {
  if (typeof window === "undefined") return DEFAULT_ASSUMPTIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ASSUMPTIONS;
    const parsed = JSON.parse(raw) as Partial<ThetaAssumptions>;
    // Shallow-merge over defaults so a future added field can't read undefined.
    return { ...DEFAULT_ASSUMPTIONS, ...parsed };
  } catch {
    return DEFAULT_ASSUMPTIONS;
  }
}

export function ThetaAssumptionsProvider({ children }: { children: ReactNode }) {
  const [assumptions, setState] = useState<ThetaAssumptions>(DEFAULT_ASSUMPTIONS);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setState(load());
    setVersion((v) => v + 1);
  }, []);

  const commit = useCallback((next: ThetaAssumptions) => {
    setState(next);
    setVersion((v) => v + 1);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable (private mode) — keep in memory
    }
  }, []);

  const setField = useCallback(
    (key: ThetaFieldKey, value: number) => {
      setState((prev) => {
        const next = { ...prev, [key]: value };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      setVersion((v) => v + 1);
    },
    []
  );

  const applyPreset = useCallback(
    (id: PresetId) => {
      const preset = ASSUMPTION_PRESETS.find((p) => p.id === id);
      if (preset) commit(cloneAssumptions(preset.values));
    },
    [commit]
  );

  const reset = useCallback(() => commit(cloneAssumptions(DEFAULT_ASSUMPTIONS)), [commit]);

  const value = useMemo<ThetaAssumptionsCtx>(
    () => ({
      assumptions,
      preset: matchPreset(assumptions),
      version,
      setField,
      applyPreset,
      reset,
    }),
    [assumptions, version, setField, applyPreset, reset]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useThetaAssumptions(): ThetaAssumptionsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useThetaAssumptions must be used inside ThetaAssumptionsProvider");
  return ctx;
}
