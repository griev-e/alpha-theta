// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveData } from "./useLiveData";

/**
 * The live-data poller: quotes + fundamentals over the network, degrading
 * silently to imported prices when a fetch fails, a manual `refresh()` that
 * punches through caches (`&fresh=1`), and a 60s visible-tab poll. These are
 * DOM+network behaviors the pure suite can't reach; `fetch` is mocked per-URL
 * and `document.visibilityState` is pinned to "visible".
 */
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
});
afterEach(() => vi.unstubAllGlobals());

const QUOTE = { symbol: "AAPL", price: 200, prevClose: 198, asOf: "q-1" };

/** Route the mocked fetch to quote/fundamentals responders and count quote hits. */
function routeFetch(opts: { quoteOk?: boolean } = {}) {
  const calls: string[] = [];
  fetchMock.mockImplementation((url: string) => {
    calls.push(url);
    const json = (body: unknown, ok = true) =>
      Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
    if (url.startsWith("/api/quotes")) {
      return opts.quoteOk === false
        ? json({}, false)
        : json({ quotes: { AAPL: QUOTE }, asOf: "q-1" });
    }
    return json({ patches: { AAPL: { symbol: "AAPL", asOf: "f-1", beta: 1.1 } }, asOf: "f-1" });
  });
  return { calls };
}

const quoteCalls = (calls: string[]) =>
  calls.filter((u) => u.startsWith("/api/quotes"));

describe("useLiveData", () => {
  it("does nothing for an empty symbol set", () => {
    routeFetch();
    const { result } = renderHook(() => useLiveData([]));
    expect(result.current.quotes).toEqual({});
    expect(result.current.quotesAt).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads quotes + fundamentals and clears the degraded flag", async () => {
    routeFetch();
    const { result } = renderHook(() => useLiveData(["AAPL"]));
    await waitFor(() => expect(result.current.quotesAt).toBe("q-1"));
    expect(result.current.quotes.AAPL).toMatchObject({ price: 200 });
    await waitFor(() => expect(result.current.fundamentalsAt).toBe("f-1"));
    expect(result.current.patches.AAPL).toMatchObject({ beta: 1.1 });
    expect(result.current.degraded).toBe(false);
  });

  it("degrades when the quote fetch fails", async () => {
    routeFetch({ quoteOk: false });
    const { result } = renderHook(() => useLiveData(["AAPL"]));
    await waitFor(() => expect(result.current.degraded).toBe(true));
    expect(result.current.quotes).toEqual({}); // still empty → imported prices
  });

  it("refresh() bypasses caches with fresh=1 and toggles refreshing", async () => {
    const { calls } = routeFetch();
    const { result } = renderHook(() => useLiveData(["AAPL"]));
    await waitFor(() => expect(result.current.quotesAt).toBe("q-1"));

    await act(async () => {
      await result.current.refresh();
    });
    expect(calls.some((u) => u.includes("fresh=1"))).toBe(true);
    expect(result.current.refreshing).toBe(false);
  });

  it("re-polls quotes every 60s while the tab is visible", async () => {
    vi.useFakeTimers();
    try {
      const { calls } = routeFetch();
      renderHook(() => useLiveData(["AAPL"]));
      await vi.advanceTimersByTimeAsync(0); // flush the initial load
      const initial = quoteCalls(calls).length;
      expect(initial).toBeGreaterThan(0);

      await vi.advanceTimersByTimeAsync(60_000); // one poll interval
      expect(quoteCalls(calls).length).toBeGreaterThan(initial);
    } finally {
      vi.useRealTimers();
    }
  });
});
