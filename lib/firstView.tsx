"use client";

import { createContext, useContext, useEffect } from "react";

/**
 * Whether the current route is being seen for the *first time this session*.
 *
 * Entrance choreography (cards rising in, rows staggering, headers sliding up)
 * is a first-impression flourish — replaying the full 700ms sequence every time
 * you revisit Overview turns delight into friction. The shell computes this once
 * per navigation (a module-level set of visited paths, reset on full reload) and
 * broadcasts it; `Card`, `PageHeader`, and per-row staggers read it to run the
 * entrance on the first visit and render instantly on every return.
 *
 * Interaction motion (hover springs, the nav pill, count-ups, chart draws) is
 * deliberately *not* gated by this — only the one-time page entrance is.
 */
const FirstViewContext = createContext(true);

export const FirstViewProvider = FirstViewContext.Provider;

export function useFirstView(): boolean {
  return useContext(FirstViewContext);
}

// Paths whose entrance has already played this session. Module-scoped so it
// survives client navigations but resets on a full reload.
const visited = new Set<string>();

/**
 * Computed by the shell once per navigation: true while rendering a route not
 * seen yet this session, then marked seen after commit. Feed the result into
 * {@link FirstViewProvider}.
 */
export function useRouteFirstView(pathname: string): boolean {
  const isFirst = !visited.has(pathname);
  useEffect(() => {
    visited.add(pathname);
  }, [pathname]);
  return isFirst;
}
