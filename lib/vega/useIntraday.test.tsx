// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIntraday } from "./useIntraday";
import type { Bar } from "./types";

/**
 * useIntraday's degradation contract over a mocked fetch:
 *  - 404 is conclusive → empty, not degraded;
 *  - a failed FIRST load for a new symbol DROPS the previous symbol's series
 *    (a stale tape must never masquerade under a new header) and flags
 *    degraded;
 *  - delivered bars arrive already repaired (the phantom-print pass runs in
 *    the hook, so no consumer can forget it).
 */

const bar = (min: number, over: Partial<Bar> = {}): Bar => ({
  t: new Date(Date.UTC(2026, 0, 15, 14, 30 + min * 5)).toISOString(),
  o: 100,
  h: 101,
  l: 99,
  c: 100.5,
  v: 1000,
  ...over,
});

const ok = (symbol: string, bars: Bar[]) =>
  new Response(JSON.stringify({ symbol, interval: "5m", currency: "USD", bars }), {
    status: 200,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useIntraday", () => {
  it("treats 404 as conclusive empty, not degraded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    const { result } = renderHook(() => useIntraday("^VIX", "5m"));
    await waitFor(() => expect(result.current.empty).toBe(true));
    expect(result.current.degraded).toBe(false);
    expect(result.current.series).toBeNull();
  });

  it("drops the previous symbol's series when the new symbol's first load fails", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("symbol=AAPL")) return ok("AAPL", [bar(0), bar(1), bar(2)]);
      return new Response("{}", { status: 503 }); // TSLA fetch fails
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(({ sym }) => useIntraday(sym, "5m"), {
      initialProps: { sym: "AAPL" },
    });
    await waitFor(() => expect(result.current.series?.symbol).toBe("AAPL"));

    rerender({ sym: "TSLA" });
    await waitFor(() => expect(result.current.degraded).toBe(true));
    // The stale AAPL tape must NOT survive under the TSLA header.
    expect(result.current.series).toBeNull();
  });

  it("delivers bars already repaired — the phantom print never reaches consumers", async () => {
    // A zero-volume phantom close (o≈100 → c=150) the next bar never confirms.
    const bars = [bar(0), bar(1), bar(2), bar(3, { c: 150, h: 150, v: 0 }), bar(4), bar(5)];
    vi.stubGlobal("fetch", vi.fn(async () => ok("NVDA", bars)));
    const { result } = renderHook(() => useIntraday("NVDA", "5m"));
    await waitFor(() => expect(result.current.series).not.toBeNull());
    const delivered = result.current.series!.bars;
    expect(Math.max(...delivered.map((b) => b.c))).toBeLessThan(150);
  });
});
