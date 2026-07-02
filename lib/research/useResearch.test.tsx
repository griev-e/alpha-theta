// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useResearchTarget } from "./useResearch";

/**
 * The Research terminal's single-symbol loader: live quote + fundamentals from
 * the provider, no bundled snapshot. These are the branches that matter and that
 * only a DOM+network harness can reach — the found/live path, the graceful
 * not-found on a total provider failure, and the "quote but empty fundamentals"
 * fallback that shows an estimated profile rather than a dead end. `fetch` is
 * mocked per-URL.
 */
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

/** Route a mocked fetch by URL to quote/fundamentals responders. */
function routeFetch(opts: {
  quote?: unknown;
  quoteOk?: boolean;
  patch?: unknown;
  patchOk?: boolean;
}) {
  fetchMock.mockImplementation((url: string) => {
    const json = (body: unknown, ok = true) =>
      Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
    if (url.startsWith("/api/quotes")) {
      return opts.quoteOk === false
        ? json({}, false)
        : json({ quotes: opts.quote ? { AAPL: opts.quote } : {}, asOf: "2026-01-01" });
    }
    if (url.startsWith("/api/fundamentals")) {
      return opts.patchOk === false
        ? json({}, false)
        : json({ patches: opts.patch ? { AAPL: opts.patch } : {}, asOf: "2026-01-01" });
    }
    return json({}, false);
  });
}

const QUOTE = { symbol: "AAPL", price: 200, prevClose: 198, asOf: "2026-01-01" };

describe("useResearchTarget", () => {
  it("returns an empty, non-loading target for a null symbol", () => {
    const { result } = renderHook(() => useResearchTarget(null));
    expect(result.current.symbol).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.fundamentals).toBeNull();
  });

  it("loads a live quote + fundamentals for a real ticker", async () => {
    routeFetch({ quote: QUOTE, patch: { symbol: "AAPL", asOf: "2026-01-01", beta: 1.2 } });
    const { result } = renderHook(() => useResearchTarget("AAPL"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.quote).toMatchObject({ price: 200 });
    expect(result.current.live).toBe(true);
    expect(result.current.fundamentals).not.toBeNull();
    expect(result.current.notFound).toBe(false);
  });

  it("reports notFound when the provider knows nothing", async () => {
    routeFetch({ quoteOk: false, patchOk: false });
    const { result } = renderHook(() => useResearchTarget("ZZZZ"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.quote).toBeNull();
    expect(result.current.live).toBe(false);
    expect(result.current.notFound).toBe(true);
  });

  it("shows a fallback profile for a real quote with empty fundamentals", async () => {
    routeFetch({ quote: QUOTE }); // quote present, no fundamentals patch
    const { result } = renderHook(() => useResearchTarget("AAPL"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.quote).not.toBeNull();
    expect(result.current.live).toBe(false); // no patch was returned
    expect(result.current.notFound).toBe(false); // not a dead end
    expect(result.current.fundamentals).not.toBeNull(); // estimated profile
  });
});
