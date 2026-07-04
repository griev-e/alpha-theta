// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { PortfolioProvider } from "@/lib/store";
import { ThetaProvider, useTheta } from "./store";

/**
 * Full store-level regression test for the SimpleFIN merge wiring — a level
 * above `simplefinMerge.test.ts`'s pure-function coverage. This exercises the
 * *actual* `applySimplefinSync`/`setAccountKind` callbacks as composed in
 * `ThetaProvider` (mutate/ledgerRef/useCallback), in case a bug lives in that
 * wiring rather than in `mergeSimplefinSync` itself. No AuthProvider wrapper
 * is mounted, so `useAuth()` falls back to its open-mode default (disabled,
 * unauthenticated) and both providers use localStorage — no backend needed.
 */
function wrapper({ children }: { children: ReactNode }) {
  return <PortfolioProvider>{<ThetaProvider>{children}</ThetaProvider>}</PortfolioProvider>;
}

const sfAccount = (kind: "checking" | "brokerage", balance: number) => ({
  id: "sf:acct1",
  name: "Everyday Checking",
  institution: "Chase",
  kind,
  balance,
  trend: Array(7).fill(balance),
  mask: "4471",
});

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
});
afterEach(() => vi.unstubAllGlobals());

describe("ThetaProvider — SimpleFIN account-kind persistence", () => {
  it("keeps a manually-corrected account kind across a live re-sync", async () => {
    const { result } = renderHook(() => useTheta(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    // First sync ever: the heuristic guesses "brokerage".
    act(() => {
      result.current.applySimplefinSync({ accounts: [sfAccount("brokerage", 1100)], transactions: [] });
    });
    await waitFor(() =>
      expect(result.current.ledger?.accounts.find((a) => a.id === "sf:acct1")?.kind).toBe("brokerage")
    );

    // The user corrects it on the Accounts page.
    act(() => {
      result.current.setAccountKind("sf:acct1", "checking");
    });
    await waitFor(() =>
      expect(result.current.ledger?.accounts.find((a) => a.id === "sf:acct1")?.kind).toBe("checking")
    );

    // A live re-sync: the server returns the same account, heuristic still
    // (wrongly) says "brokerage", balance has moved.
    act(() => {
      result.current.applySimplefinSync({ accounts: [sfAccount("brokerage", 1150)], transactions: [] });
    });

    const acct = result.current.ledger?.accounts.find((a) => a.id === "sf:acct1");
    expect(acct?.kind).toBe("checking"); // correction survives the real store path
    expect(acct?.balance).toBe(1150); // fresh balance still comes through
  });
});
