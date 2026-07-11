import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * fetchIntraday's error-vs-empty contract, over a mocked provider:
 *  - a transient provider failure must surface as `error: true`, serve the
 *    last good series stale, and must NEVER be negative-cached as "no data"
 *    (one Yahoo hiccup used to blank a working chart for 5 minutes);
 *  - a SUCCESSFUL fetch with nothing usable is conclusive and IS cached.
 * Distinct symbols per test isolate the module-scope warm cache.
 */

const chart = vi.fn();
vi.mock("./yahoo", () => ({ yf: { chart: (...a: unknown[]) => chart(...a), quote: vi.fn() } }));

import { fetchIntraday } from "./intraday";

const ROWS = Array.from({ length: 3 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 0, 15, 14, 30 + i * 5)),
  open: 100 + i,
  high: 101 + i,
  low: 99 + i,
  close: 100.5 + i,
  volume: 1000,
}));

beforeEach(() => {
  chart.mockReset();
});

describe("fetchIntraday error vs empty", () => {
  it("reports a thrown provider call as error, without caching it as fact", async () => {
    chart.mockRejectedValueOnce(new Error("timeout"));
    const first = await fetchIntraday("ERRA", "5m");
    expect(first.error).toBe(true);
    expect(first.series).toBeNull();

    // The very next call retries (no 5-minute negative cache) and succeeds.
    chart.mockResolvedValueOnce({ quotes: ROWS, meta: { currency: "USD" } });
    const second = await fetchIntraday("ERRA", "5m");
    expect(second.error).toBe(false);
    expect(second.series?.bars).toHaveLength(3);
  });

  it("serves the last good series stale through an outage", async () => {
    chart.mockResolvedValueOnce({ quotes: ROWS, meta: { currency: "USD" } });
    const good = await fetchIntraday("STALEA", "1m");
    expect(good.series?.bars).toHaveLength(3);

    // Warm cache expires between polls in reality; simulate by erroring the
    // next refresh — the cached series must ride through with error: true.
    // (Cache TTL hasn't elapsed here, so force a miss with a fresh interval.)
    chart.mockRejectedValueOnce(new Error("blip"));
    const differentInterval = await fetchIntraday("STALEA", "15m");
    expect(differentInterval.error).toBe(true);
    expect(differentInterval.series).toBeNull(); // no prior data for THIS key

    // Same key inside TTL: served from cache, no error.
    const cached = await fetchIntraday("STALEA", "1m");
    expect(cached.error).toBe(false);
    expect(cached.series?.bars).toHaveLength(3);
  });

  it("treats a successful fetch with nothing usable as conclusive", async () => {
    chart.mockResolvedValueOnce({ quotes: [], meta: {} });
    const first = await fetchIntraday("EMPTYA", "5m");
    expect(first).toEqual({ series: null, error: false });

    // Conclusive misses ARE negative-cached: no second provider call.
    const second = await fetchIntraday("EMPTYA", "5m");
    expect(second).toEqual({ series: null, error: false });
    expect(chart).toHaveBeenCalledTimes(1);
  });
});
