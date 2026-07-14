"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Small persisted UI preferences for vega — the chart's interval, overlay
 * toggles, and indicator choice survive a reload without touching the
 * versioned VegaState blob (these are cosmetic per-browser choices, not
 * data, so they don't belong in the migrated store and never sync).
 *
 * One JSON blob under a single key; each pref hydrates after mount (the
 * first paint uses the fallback, same contract as the store's `ready`) and
 * writes through on change. A sanitize hook rejects stale/foreign values so
 * a bad blob degrades to the default instead of an invalid control state.
 */

const KEY = "vega.ui.v1";

function readAll(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeOne(name: string, value: unknown): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [name]: value }));
  } catch {
    /* private mode — keep in memory */
  }
}

export function useUiPref<T>(
  name: string,
  fallback: T,
  sanitize: (raw: unknown) => T | null
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    const raw = readAll()[name];
    if (raw === undefined) return;
    const ok = sanitize(raw);
    if (ok !== null) setValue(ok);
    // Sanitize is a pure validator — deliberately not a dependency, so an
    // inline arrow at the call site can't re-run hydration every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const set = useCallback(
    (v: T) => {
      setValue(v);
      writeOne(name, v);
    },
    [name]
  );

  return [value, set];
}

/** Sanitizer for enum-like prefs: keeps the raw value only if it's one of
 *  the allowed choices. */
export function oneOf<T extends string>(allowed: readonly T[]): (raw: unknown) => T | null {
  return (raw) => (typeof raw === "string" && (allowed as readonly string[]).includes(raw) ? (raw as T) : null);
}

/** Sanitizer for a fixed-key boolean record (the overlay toggle set):
 *  unknown keys are dropped, missing keys keep their defaults. */
export function boolRecord<K extends string>(
  defaults: Record<K, boolean>
): (raw: unknown) => Record<K, boolean> | null {
  return (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const out = { ...defaults };
    for (const k of Object.keys(defaults) as K[]) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === "boolean") out[k] = v;
    }
    return out;
  };
}
