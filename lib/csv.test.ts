import { describe, expect, it } from "vitest";
import { parsePortfolioCSV, toCSV } from "./csv";

const HEADER = "name,symbol,shares,price,averageCost,totalReturn,equity";

describe("parsePortfolioCSV", () => {
  it("parses a clean, well-formed file", () => {
    const { holdings, errors, cash } = parsePortfolioCSV(
      `${HEADER}\nApple,AAPL,10,200,150,500,2000`
    );
    expect(errors).toHaveLength(0);
    expect(cash).toBeNull();
    expect(holdings).toHaveLength(1);
    expect(holdings[0]).toMatchObject({
      symbol: "AAPL",
      name: "Apple",
      shares: 10,
      price: 200,
      averageCost: 150,
      equity: 2000,
      totalReturn: 500, // detected as dollars, left as-is
    });
  });

  it("tolerates reordered columns", () => {
    const { holdings, errors } = parsePortfolioCSV(
      `symbol,shares,price,name,averageCost,equity,totalReturn\nAAPL,10,200,Apple,150,2000,500`
    );
    expect(errors).toHaveLength(0);
    expect(holdings[0]).toMatchObject({ symbol: "AAPL", shares: 10, price: 200 });
  });

  it("strips $/comma formatting and reads percent returns", () => {
    const { holdings } = parsePortfolioCSV(
      `${HEADER}\nTester,TST,10,"$200.00","$150.00",15%,"$2,000.00"`
    );
    expect(holdings[0].price).toBe(200);
    expect(holdings[0].equity).toBe(2000);
    // "15%" → 15% of cost basis (1500) = $225
    expect(holdings[0].totalReturn).toBeCloseTo(225, 5);
  });

  it("reads parenthesized negatives as losses", () => {
    const { holdings } = parsePortfolioCSV(
      `${HEADER}\nLoser,LOSS,10,200,250,(500),2000`
    );
    expect(holdings[0].totalReturn).toBe(-500);
  });

  it("auto-detects an unmarked percent return when it reconciles better", () => {
    // costBasis 1000, equity 1200 → $200 P&L. A raw "20" reconciles far better
    // as 20% (=$200) than as $20, so the importer normalizes it to dollars.
    const { holdings } = parsePortfolioCSV(
      `${HEADER}\nPct,PCT,10,120,100,20,1200`
    );
    expect(holdings[0].totalReturn).toBeCloseTo(200, 5);
  });

  it("captures a CASH row as the cash position, not a holding", () => {
    const { holdings, cash } = parsePortfolioCSV(
      `${HEADER}\nApple,AAPL,10,200,150,500,2000\nCash,CASH,1,5000,5000,0,5000`
    );
    expect(holdings).toHaveLength(1);
    expect(cash).toBe(5000);
  });

  it("reads a $0 cash row as zero, not falling through to the price column", () => {
    // equity column is a legitimate 0; must not fall back to price via `||`.
    const { cash } = parsePortfolioCSV(
      `${HEADER}\nApple,AAPL,10,200,150,500,2000\nCash,CASH,1,1.00,1.00,0,0`
    );
    expect(cash).toBe(0);
  });

  it("recognizes USD as a cash alias and sums multiple cash rows", () => {
    const { cash } = parsePortfolioCSV(
      `${HEADER}\nCash,USD,1,3000,3000,0,3000\nSweep,SWEEP,1,2000,2000,0,2000`
    );
    expect(cash).toBe(5000);
  });

  it("merges duplicate symbols (separately exported lots)", () => {
    const { holdings, warnings } = parsePortfolioCSV(
      `${HEADER}\nApple,AAPL,10,200,100,1000,2000\nApple,AAPL,10,200,150,500,2000`
    );
    expect(holdings).toHaveLength(1);
    expect(holdings[0].shares).toBe(20);
    expect(holdings[0].equity).toBe(4000);
    expect(holdings[0].averageCost).toBeCloseTo(125, 5); // (10*100 + 10*150)/20
    expect(holdings[0].totalReturn).toBe(1500);
    expect(warnings.some((w) => w.includes("merged"))).toBe(true);
  });

  it("defaults equity to shares × price when missing", () => {
    const { holdings } = parsePortfolioCSV(`${HEADER}\nNo Eq,NOEQ,4,50,40,,`);
    expect(holdings[0].equity).toBe(200);
  });

  it("errors when a required column is missing", () => {
    const { holdings, errors } = parsePortfolioCSV(
      `name,symbol,shares,price,averageCost,totalReturn\nApple,AAPL,10,200,150,500`
    );
    expect(holdings).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/equity/);
  });

  it("errors on a header-only / too-short file", () => {
    expect(parsePortfolioCSV(HEADER).errors.length).toBeGreaterThan(0);
    expect(parsePortfolioCSV("").errors.length).toBeGreaterThan(0);
  });

  it("skips rows with invalid shares or price", () => {
    const { holdings, warnings } = parsePortfolioCSV(
      `${HEADER}\nBad,BAD,0,200,150,0,0\nGood,GOOD,5,10,8,10,50`
    );
    expect(holdings).toHaveLength(1);
    expect(holdings[0].symbol).toBe("GOOD");
    expect(warnings.some((w) => w.includes("BAD"))).toBe(true);
  });

  it("round-trips through toCSV", () => {
    const original = parsePortfolioCSV(
      `${HEADER}\nApple,AAPL,10,200,150,500,2000\n"Berkshire, Inc.",BRK.B,2,400,350,100,800`
    );
    const reparsed = parsePortfolioCSV(toCSV(original.holdings, 1000));
    expect(reparsed.errors).toHaveLength(0);
    expect(reparsed.cash).toBe(1000);
    expect(reparsed.holdings).toHaveLength(2);
    const aapl = reparsed.holdings.find((h) => h.symbol === "AAPL")!;
    expect(aapl.shares).toBe(10);
    // quoted name with an embedded comma survives the round trip
    const brk = reparsed.holdings.find((h) => h.symbol === "BRK.B")!;
    expect(brk.name).toBe("Berkshire, Inc.");
  });
});
