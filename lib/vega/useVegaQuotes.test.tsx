// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useVegaQuotes } from "./useVegaQuotes";

/**
 * useVegaQuotes must keep the SAME quotes object identity when a poll
 * returns a byte-identical payload (routine: server/CDN caches, closed
 * markets) — a fresh identity per poll would rerun every consumer memo,
 * including the Edge Engine's full compute, on data that didn't move.
 */

const payload = (price: number) =>
  JSON.stringify({
    quotes: {
      SPY: {
        symbol: "SPY",
        name: "SPDR S&P 500",
        price,
        regularPrice: price,
        prevClose: price - 1,
        open: price - 0.5,
        dayHigh: price + 1,
        dayLow: price - 2,
        volume: 1_000_000,
        avgVolume10d: 2_000_000,
        avgVolume3m: 2_000_000,
        marketState: "CLOSED",
        changePct: 0.002,
        high52w: price + 50,
        low52w: price - 50,
        asOf: "2026-01-16T21:00:00.000Z",
      },
    },
    asOf: "2026-01-16T21:00:05.000Z",
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useVegaQuotes payload identity", () => {
  it("keeps object identity across identical polls; changes it when data moves", async () => {
    let price = 500;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(payload(price), { status: 200 }))
    );
    const { result } = renderHook(() => useVegaQuotes(["SPY"]));
    await waitFor(() => expect(result.current.quotes.SPY).toBeDefined());
    const first = result.current.quotes;

    // Identical payload → same identity (consumer memos stay cold).
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.quotes).toBe(first);

    // The tape moves → new identity.
    price = 501;
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.quotes).not.toBe(first);
    expect(result.current.quotes.SPY.price).toBe(501);
  });
});
