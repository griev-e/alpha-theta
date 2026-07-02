import type { FundamentalsPatch } from "@/lib/live/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The fundamentals orchestrator layers two providers: Yahoo is primary, Finnhub
 * gap-fills only the fields Yahoo left empty and never overrides it. That
 * precedence — plus the subtle rule that each provider is sanitized *before* the
 * merge, so a Yahoo blow-up doesn't block a good Finnhub reading — is the actual
 * contract from the architecture docs and is asserted here with both providers
 * mocked. (`sanitizeImplausibleFields` itself is covered in providers.test.ts.)
 */

const h = vi.hoisted(() => ({
  yahoo: vi.fn(),
  finnhub: vi.fn(),
}));

vi.mock("./yahoo", () => ({ fetchYahooPatch: h.yahoo }));
vi.mock("./finnhub", () => ({ fetchFinnhubPatch: h.finnhub }));

import { fetchFundamentalsPatch } from "./fundamentals";

const patch = (over: Partial<FundamentalsPatch>): FundamentalsPatch => ({
  symbol: "TEST",
  asOf: "2026-01-01T00:00:00.000Z",
  ...over,
});

beforeEach(() => {
  h.yahoo.mockReset();
  h.finnhub.mockReset();
});

describe("fetchFundamentalsPatch", () => {
  it("returns null only when both providers come back empty", async () => {
    h.yahoo.mockResolvedValue(null);
    h.finnhub.mockResolvedValue(null);
    expect(await fetchFundamentalsPatch("TEST")).toBeNull();
  });

  it("returns Yahoo alone when Finnhub has nothing", async () => {
    h.yahoo.mockResolvedValue(patch({ beta: 1.1, roic: 0.2 }));
    h.finnhub.mockResolvedValue(null);
    const out = await fetchFundamentalsPatch("TEST");
    expect(out).toMatchObject({ beta: 1.1, roic: 0.2 });
  });

  it("lets Yahoo win on overlap while Finnhub fills only the gaps", async () => {
    h.yahoo.mockResolvedValue(patch({ beta: 1.1, sector: "Technology" }));
    h.finnhub.mockResolvedValue(
      patch({ beta: 9, roic: 0.3, operatingMargin: 0.25 })
    );
    const out = await fetchFundamentalsPatch("TEST");
    expect(out?.beta).toBe(1.1); // Yahoo wins the overlap
    expect(out?.roic).toBe(0.3); // Finnhub fills a Yahoo gap
    expect(out?.operatingMargin).toBe(0.25);
    expect(out?.sector).toBe("Technology");
  });

  it("gap-fills from Finnhub after Yahoo's implausible reading is sanitized out", async () => {
    // Yahoo returns an absurd beta (numerical artifact for a thin name); it is
    // dropped before the merge, so it must NOT block Finnhub's good value.
    h.yahoo.mockResolvedValue(patch({ beta: 40, roic: 0.2 }));
    h.finnhub.mockResolvedValue(patch({ beta: 1.4 }));
    const out = await fetchFundamentalsPatch("TEST");
    expect(out?.beta).toBe(1.4);
    expect(out?.roic).toBe(0.2);
  });

  it("seeds identity from Finnhub when Yahoo is entirely absent", async () => {
    h.yahoo.mockResolvedValue(null);
    h.finnhub.mockResolvedValue(patch({ symbol: "TEST", roic: 0.15 }));
    const out = await fetchFundamentalsPatch("TEST");
    expect(out?.symbol).toBe("TEST");
    expect(out?.roic).toBe(0.15);
  });
});
