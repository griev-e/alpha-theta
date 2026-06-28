import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CMA as STATIC_CMA, NDX, SPX } from "@/lib/data/benchmarks";

/**
 * The live CMA overlay is the graceful-degradation contract for capital-market
 * assumptions: live values when primed, the static snapshot otherwise, and the
 * equity risk premium always static (no observable quote). The module caches
 * its primed state at module scope, so each test re-imports a fresh copy via
 * `vi.resetModules()` and stubs `fetch`.
 */

async function freshModule() {
  vi.resetModules();
  return import("./cma");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getCMA / liveBenchmarkVolatility — before priming", () => {
  let mod: typeof import("./cma");
  beforeEach(async () => {
    mod = await freshModule();
  });

  it("returns the static snapshot when nothing has been primed", () => {
    expect(mod.getCMA()).toEqual({
      riskFree: STATIC_CMA.riskFree,
      equityRiskPremium: STATIC_CMA.equityRiskPremium,
      marketVolatility: STATIC_CMA.marketVolatility,
    });
  });

  it("falls back to each profile's own static volatility", () => {
    expect(mod.liveBenchmarkVolatility(SPX)).toBe(SPX.volatility);
    expect(mod.liveBenchmarkVolatility(NDX)).toBe(NDX.volatility);
  });
});

describe("primeLiveCMA — success", () => {
  it("overlays live risk-free + benchmark vols, keeping ERP static", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ riskFree: 0.052, marketVolatility: 0.21, ndxVolatility: 0.27 }),
      })
    );
    const mod = await freshModule();
    await mod.primeLiveCMA();

    const cma = mod.getCMA();
    expect(cma.riskFree).toBe(0.052);
    expect(cma.marketVolatility).toBe(0.21);
    // No live source for ERP — always the static assumption.
    expect(cma.equityRiskPremium).toBe(STATIC_CMA.equityRiskPremium);

    expect(mod.liveBenchmarkVolatility(SPX)).toBe(0.21);
    expect(mod.liveBenchmarkVolatility(NDX)).toBe(0.27);
  });

  it("defaults ndxVolatility to the NDX static when the field is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ riskFree: 0.05, marketVolatility: 0.19 }),
      })
    );
    const mod = await freshModule();
    await mod.primeLiveCMA();
    expect(mod.liveBenchmarkVolatility(NDX)).toBe(NDX.volatility);
  });

  it("primes only once even when called repeatedly", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ riskFree: 0.05, marketVolatility: 0.19 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const mod = await freshModule();
    await Promise.all([mod.primeLiveCMA(), mod.primeLiveCMA()]);
    await mod.primeLiveCMA();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("primeLiveCMA — failure falls back silently", () => {
  it("keeps the static snapshot when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const mod = await freshModule();
    await mod.primeLiveCMA();
    expect(mod.getCMA().riskFree).toBe(STATIC_CMA.riskFree);
    expect(mod.liveBenchmarkVolatility(SPX)).toBe(SPX.volatility);
  });

  it("keeps the static snapshot when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const mod = await freshModule();
    await mod.primeLiveCMA();
    expect(mod.getCMA().marketVolatility).toBe(STATIC_CMA.marketVolatility);
  });

  it("ignores a malformed payload missing the required numbers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ riskFree: "oops" }) })
    );
    const mod = await freshModule();
    await mod.primeLiveCMA();
    expect(mod.getCMA().riskFree).toBe(STATIC_CMA.riskFree);
  });
});
