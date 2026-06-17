import { describe, expect, it } from "vitest";
import {
  UNKNOWN_DEFAULTS,
  getFundamentals,
  knownSymbols,
} from "./fundamentals";

describe("getFundamentals", () => {
  it("returns a fully-formed snapshot for a known ticker", () => {
    const f = getFundamentals("AAPL");
    expect(f).not.toBeNull();
    expect(f!.symbol).toBe("AAPL");
    expect(f!.marketCap).toBeGreaterThan(1e11); // scaled from $B to USD
    expect(f!.analyst.priceTarget).toBeGreaterThan(0);
    // derived targetLow/High bracket the mean target
    expect(f!.analyst.targetLow).toBeLessThanOrEqual(f!.analyst.priceTarget);
    expect(f!.analyst.targetHigh).toBeGreaterThanOrEqual(f!.analyst.priceTarget);
  });

  it("resolves share-class and legacy aliases", () => {
    expect(getFundamentals("BRK-B")?.symbol).toBe("BRK.B");
    expect(getFundamentals("BRKB")?.symbol).toBe("BRK.B");
    expect(getFundamentals("FB")?.symbol).toBe("META");
  });

  it("returns null for unknown tickers (graceful degradation)", () => {
    expect(getFundamentals("NOTATICKER")).toBeNull();
    expect(getFundamentals("")).toBeNull();
  });

  it("exposes look-through sector weights for ETFs", () => {
    const spy = getFundamentals("SPY");
    expect(spy!.fund).toBeDefined();
    const total = Object.values(spy!.fund!.sectorWeights).reduce(
      (s, w) => s + (w ?? 0),
      0
    );
    expect(total).toBeCloseTo(1, 1);
  });

  it("keeps every region mix normalized to 1", () => {
    for (const symbol of knownSymbols()) {
      const f = getFundamentals(symbol)!;
      const sum = Object.values(f.regions).reduce((s, w) => s + (w ?? 0), 0);
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  it("covers a broad snapshot universe", () => {
    const syms = knownSymbols();
    expect(syms.length).toBeGreaterThanOrEqual(90);
    expect(syms).toContain("NVDA");
    expect(syms).toContain("SPY");
  });

  it("ships conservative defaults for unknown names", () => {
    expect(UNKNOWN_DEFAULTS.beta).toBe(1.0);
    expect(UNKNOWN_DEFAULTS.volatility).toBeGreaterThan(0);
    expect(UNKNOWN_DEFAULTS.sector).toBe("Unknown");
    expect(UNKNOWN_DEFAULTS.regions.US).toBe(1);
  });

  it("marks unprofitable names with a null forward P/E", () => {
    // RKLB is carried as unprofitable in the snapshot (pe: null)
    expect(getFundamentals("RKLB")!.forwardPE).toBeNull();
  });
});
