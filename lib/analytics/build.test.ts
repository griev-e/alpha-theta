import { describe, expect, it } from "vitest";
import { holding } from "../__tests__/factory";
import type { FundamentalsPatch, LiveQuote } from "../live/types";
import { buildPortfolio } from "./build";

function quote(symbol: string, price: number): LiveQuote {
  return { symbol, price, prevClose: price, asOf: "2026-06-26T00:00:00.000Z" };
}

function patch(symbol: string, p: Partial<FundamentalsPatch>): FundamentalsPatch {
  return { symbol, asOf: "2026-06-26T00:00:00.000Z", ...p };
}

describe("buildPortfolio dataSource", () => {
  it("is fallback with no live quote and no patch", () => {
    // AAPL is in the bundled snapshot, but without a live quote/patch it's fallback.
    const p = buildPortfolio([holding({ symbol: "AAPL" })], 0, "2026-06-10T00:00:00.000Z");
    expect(p.positions[0].dataSource).toBe("fallback");
  });

  it("is partial with a live quote but snapshot fundamentals", () => {
    const p = buildPortfolio(
      [holding({ symbol: "AAPL" })],
      0,
      "2026-06-10T00:00:00.000Z",
      { quotes: { AAPL: quote("AAPL", 200) } }
    );
    expect(p.positions[0].isLivePrice).toBe(true);
    expect(p.positions[0].dataSource).toBe("partial");
  });

  it("is live with a live quote and live critical fundamentals", () => {
    const p = buildPortfolio(
      [holding({ symbol: "AAPL" })],
      0,
      "2026-06-10T00:00:00.000Z",
      {
        quotes: { AAPL: quote("AAPL", 200) },
        patches: {
          AAPL: patch("AAPL", { beta: 1.2, volatility: 0.28, sector: "Technology" }),
        },
      }
    );
    expect(p.positions[0].dataSource).toBe("live");
  });
});
