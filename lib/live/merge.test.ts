import { describe, expect, it } from "vitest";
import type { Fundamentals } from "@/lib/types";
import { mergeFundamentals } from "./merge";
import type { FundamentalsPatch } from "./types";

const bundled: Fundamentals = {
  symbol: "AAA",
  name: "Alpha Inc",
  sector: "Technology",
  industry: "Software",
  regions: { US: 1 },
  marketCap: 1e11,
  beta: 1.1,
  volatility: 0.3,
  revenueGrowth: 0.1,
  epsGrowth: 0.12,
  fcfGrowth: 0.09,
  forwardPE: 25,
  fcfYield: 0.03,
  roic: 0.2,
  operatingMargin: 0.25,
  grossMargin: 0.6,
  dividendYield: 0,
  return12m: 0.15,
  analyst: { rating: "Buy", priceTarget: 120, targetLow: 90, targetHigh: 150, count: 20 },
  insider: { signal: "Neutral", netActivity6m: 0, buys6m: 0, sells6m: 0 },
  earningsDate: "2026-07-01",
};

function patch(p: Partial<FundamentalsPatch>): FundamentalsPatch {
  return { symbol: "AAA", asOf: "2026-06-26T00:00:00.000Z", ...p };
}

describe("mergeFundamentals provenance", () => {
  it("tags a pure-snapshot merge (no patch) as fallback", () => {
    const merged = mergeFundamentals(bundled, undefined);
    expect(merged).not.toBeNull();
    expect(merged!.provenance?.coverage).toBe("fallback");
    expect(merged!.provenance?.fields.beta).toBe("fallback");
    expect(merged!.provenance?.fields.volatility).toBe("fallback");
    expect(merged!.provenance?.fields.sector).toBe("fallback");
    // A snapshot-only merge is not "live".
    expect(merged!.live).toBeUndefined();
  });

  it("returns null when there's neither a bundle nor a patch", () => {
    expect(mergeFundamentals(null, undefined)).toBeNull();
  });

  it("marks coverage live when every critical field is from the patch", () => {
    const merged = mergeFundamentals(
      bundled,
      patch({ beta: 1.4, volatility: 0.42, sector: "Health Care" })
    );
    expect(merged!.beta).toBe(1.4);
    expect(merged!.volatility).toBe(0.42);
    expect(merged!.sector).toBe("Health Care");
    expect(merged!.provenance?.coverage).toBe("live");
    expect(merged!.provenance?.fields.beta).toBe("live");
    expect(merged!.provenance?.fields.sector).toBe("live");
    // A field the patch didn't supply stays fallback.
    expect(merged!.provenance?.fields.roic).toBe("fallback");
    expect(merged!.roic).toBe(bundled.roic);
    expect(merged!.live).toBe(true);
  });

  it("marks coverage partial when only some critical fields are live", () => {
    const merged = mergeFundamentals(bundled, patch({ beta: 1.4 }));
    expect(merged!.provenance?.coverage).toBe("partial");
    expect(merged!.provenance?.fields.beta).toBe("live");
    expect(merged!.provenance?.fields.volatility).toBe("fallback");
  });

  it("maps the fund sector-weights patch key to the `fund` field source", () => {
    const merged = mergeFundamentals(
      bundled,
      patch({ fundSectorWeights: { Technology: 1 } })
    );
    expect(merged!.provenance?.fields.fund).toBe("live");
    expect(merged!.fund?.sectorWeights.Technology).toBe(1);
  });

  it("builds provenance for an unknown ticker promoted from a patch", () => {
    const merged = mergeFundamentals(
      null,
      patch({ symbol: "ZZZ", beta: 0.8, volatility: 0.25, sector: "Utilities" })
    );
    expect(merged!.symbol).toBe("ZZZ");
    expect(merged!.provenance?.coverage).toBe("live");
    expect(merged!.provenance?.fields.beta).toBe("live");
    // Defaulted fields (no patch value) are fallback, not live.
    expect(merged!.provenance?.fields.roic).toBe("fallback");
    expect(merged!.live).toBe(true);
  });
});
