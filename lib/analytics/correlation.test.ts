import { describe, expect, it } from "vitest";
import { holding, makePortfolio } from "../__tests__/factory";
import {
  type CorrInputs,
  correlationMatrix,
  covarianceMatrix,
  pairCorrelation,
} from "./correlation";

const base: CorrInputs = {
  symbol: "A",
  beta: 1,
  vol: 0.2,
  sector: "Technology",
  industry: "Semiconductors",
  isFund: false,
};

describe("pairCorrelation", () => {
  it("is 1 against itself", () => {
    expect(pairCorrelation(base, base)).toBe(1);
  });

  it("adds the most affinity for a shared industry, less for a shared sector", () => {
    const sameIndustry = pairCorrelation(base, { ...base, symbol: "B" });
    const sameSector = pairCorrelation(base, {
      ...base,
      symbol: "B",
      industry: "Software",
    });
    const different = pairCorrelation(base, {
      ...base,
      symbol: "B",
      sector: "Energy",
      industry: "Oil & Gas",
    });
    expect(sameIndustry).toBeGreaterThan(sameSector);
    expect(sameSector).toBeGreaterThan(different);
  });

  it("clamps to the plausible long-only equity band", () => {
    const high = pairCorrelation(
      { ...base, beta: 3, vol: 0.1 },
      { ...base, symbol: "B", beta: 3, vol: 0.1 }
    );
    const low = pairCorrelation(
      { ...base, beta: 0.1, vol: 0.9, sector: "Unknown", industry: "Unknown" },
      { ...base, symbol: "B", beta: 0.1, vol: 0.9, sector: "Unknown", industry: "Unknown" }
    );
    expect(high).toBeLessThanOrEqual(0.96);
    expect(high).toBeGreaterThan(0.9);
    expect(low).toBeGreaterThanOrEqual(0.02);
    expect(low).toBeLessThan(0.1);
  });

  it("is symmetric", () => {
    const a = { ...base, beta: 1.2, vol: 0.3 };
    const b = { ...base, symbol: "B", beta: 0.8, vol: 0.18, sector: "Energy" };
    expect(pairCorrelation(a, b)).toBeCloseTo(pairCorrelation(b, a), 12);
  });
});

describe("correlationMatrix", () => {
  const portfolio = makePortfolio([
    holding({ symbol: "NVDA", shares: 10, price: 100 }),
    holding({ symbol: "MSFT", shares: 10, price: 100 }),
    holding({ symbol: "XOM", shares: 10, price: 100 }),
  ]);

  it("has a unit diagonal and is symmetric", () => {
    const { matrix, symbols } = correlationMatrix(portfolio);
    expect(symbols).toHaveLength(3);
    for (let i = 0; i < matrix.length; i++) {
      expect(matrix[i][i]).toBe(1);
      for (let j = 0; j < matrix.length; j++) {
        expect(matrix[i][j]).toBeCloseTo(matrix[j][i], 12);
      }
    }
  });

  it("reports a sane average and the extreme pairs", () => {
    const { avgCorrelation, highest, lowest } = correlationMatrix(portfolio);
    expect(avgCorrelation).toBeGreaterThan(0);
    expect(avgCorrelation).toBeLessThan(1);
    expect(highest!.rho).toBeGreaterThanOrEqual(lowest!.rho);
  });
});

describe("covarianceMatrix", () => {
  it("puts each name's variance on the diagonal", () => {
    const portfolio = makePortfolio([
      holding({ symbol: "SPY", shares: 10, price: 100 }),
      holding({ symbol: "XOM", shares: 10, price: 100 }),
    ]);
    const { symbols } = correlationMatrix(portfolio);
    const cov = covarianceMatrix(portfolio);
    symbols.forEach((sym, i) => {
      const vol = portfolio.positions.find((p) => p.symbol === sym)!.fundamentals!
        .volatility;
      expect(cov[i][i]).toBeCloseTo(vol * vol, 10);
    });
  });
});
