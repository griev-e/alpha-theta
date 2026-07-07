import { describe, expect, it } from "vitest";
import { buildHousehold } from "./household";
import type { NamedPortfolio } from "./portfolios";
import type { Portfolio } from "./types";

const raw = (
  id: string,
  name: string,
  holdings: { symbol: string; name: string; equity: number }[],
  cash: number
): NamedPortfolio => ({
  id,
  name,
  cash,
  asOf: "2026-07-01T00:00:00Z",
  holdings: holdings.map((h) => ({
    ...h,
    shares: 1,
    price: h.equity,
    averageCost: h.equity,
    totalReturn: 0,
  })),
});

describe("buildHousehold", () => {
  const books = [
    raw("a", "Individual", [
      { symbol: "AAPL", name: "Apple", equity: 6000 },
      { symbol: "MSFT", name: "Microsoft", equity: 4000 },
    ], 1000),
    raw("b", "Roth", [
      { symbol: "AAPL", name: "Apple", equity: 2000 },
      { symbol: "NVDA", name: "NVIDIA", equity: 3000 },
    ], 500),
  ];

  it("sums book values with cash and weights them", () => {
    const h = buildHousehold(books, "a", null);
    // a: 10000+1000 = 11000, b: 5000+500 = 5500 → total 16500
    expect(h.total).toBe(16500);
    expect(h.cash).toBe(1500);
    expect(h.invested).toBe(15000);
    const a = h.books.find((x) => x.id === "a")!;
    expect(a.weight).toBeCloseTo(11000 / 16500, 6);
  });

  it("blends holdings across books, merging a name held in two accounts", () => {
    const h = buildHousehold(books, "a", null);
    const aapl = h.holdings.find((x) => x.symbol === "AAPL")!;
    expect(aapl.value).toBe(8000); // 6000 + 2000
    expect(aapl.bookCount).toBe(2);
    // Largest first: AAPL (8000) leads.
    expect(h.holdings[0].symbol).toBe("AAPL");
  });

  it("uses the live portfolio's value for the active book", () => {
    const live = {
      totalValue: 20000,
      cash: 1000,
      positions: [
        { symbol: "AAPL", name: "Apple", equity: 12000 },
        { symbol: "MSFT", name: "Microsoft", equity: 7000 },
      ],
    } as unknown as Portfolio;
    const h = buildHousehold(books, "a", live);
    // active "a" now contributes its live 20000, b stays last-known 5500.
    expect(h.total).toBe(25500);
    expect(h.books.find((x) => x.id === "a")!.live).toBe(true);
    expect(h.books.find((x) => x.id === "b")!.live).toBe(false);
    // AAPL blends live 12000 + last-known 2000.
    expect(h.holdings.find((x) => x.symbol === "AAPL")!.value).toBe(14000);
  });

  it("flags last-known when more than the active book is present", () => {
    expect(buildHousehold(books, "a", {} as Portfolio).anyLastKnown).toBe(true);
    const solo = [books[0]];
    expect(buildHousehold(solo, "a", { totalValue: 11000, cash: 1000, positions: [] } as unknown as Portfolio).anyLastKnown).toBe(false);
  });
});
