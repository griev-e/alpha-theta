import { expect, test } from "@playwright/test";

/**
 * Whole-app smoke: seed a small portfolio (and theta's sample flag off) into
 * localStorage, then walk every route and assert the page actually rendered —
 * a crash during render/hydration leaves either Next's error overlay or an
 * empty main, both of which fail the `main` visibility + marker checks.
 * External providers are NOT stubbed: graceful degradation to the imported
 * book is a core contract, so the pages must render even with live data
 * unreachable.
 */

const PORTFOLIO = {
  holdings: [
    { name: "Apple", symbol: "AAPL", shares: 10, price: 200, averageCost: 150, totalReturn: 500, equity: 2000 },
    { name: "Microsoft", symbol: "MSFT", shares: 5, price: 400, averageCost: 300, totalReturn: 500, equity: 2000 },
    { name: "Exxon", symbol: "XOM", shares: 20, price: 100, averageCost: 90, totalReturn: 200, equity: 2000 },
  ],
  cash: 1000,
  asOf: new Date().toISOString(),
  isDemo: false,
};

/** Route → text that proves the page-specific tree mounted. */
const ALPHA_PAGES: [string, string | RegExp][] = [
  ["/", /Overview|Portfolio/i],
  ["/risk", /Risk/i],
  ["/quality", /Quality/i],
  ["/benchmark", /Benchmark/i],
  ["/correlation", /Correlation/i],
  ["/scenarios", /Scenario/i],
  ["/montecarlo", /Monte Carlo/i],
  ["/optimizer", /Optimizer/i],
  ["/dividends", /Dividend/i],
  ["/rebalance", /Rebalance/i],
  ["/import", /Import/i],
  ["/patch-notes", /Patch/i],
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript((stored) => {
    localStorage.setItem("alpha.portfolio.v1", JSON.stringify(stored));
  }, PORTFOLIO);
});

for (const [path, marker] of ALPHA_PAGES) {
  test(`renders ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("body")).toContainText(marker, { timeout: 15_000 });
    // Next.js error overlay / error boundary text = a page-level crash.
    await expect(page.locator("body")).not.toContainText("Application error");
  });
}

test("renders theta dashboard", async ({ page }) => {
  await page.goto("/theta");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Application error");
});

/**
 * The empty book is the render corner most likely to throw — analytics that
 * reduce/divide over holdings meet a zero-length portfolio, not the well-formed
 * one above. The default suite always seeds three holdings, so it never hits
 * this; assert the analytics-heavy pages still render on an empty portfolio.
 */
const EMPTY_PORTFOLIO = {
  holdings: [],
  cash: 0,
  asOf: new Date().toISOString(),
  isDemo: false,
};

const EMPTY_SAFE_PAGES = [
  "/",
  "/risk",
  "/quality",
  "/correlation",
  "/optimizer",
  "/montecarlo",
  "/dividends",
  "/report",
];

for (const path of EMPTY_SAFE_PAGES) {
  test(`renders ${path} with an empty portfolio`, async ({ page }) => {
    await page.addInitScript((stored) => {
      localStorage.setItem("alpha.portfolio.v1", JSON.stringify(stored));
    }, EMPTY_PORTFOLIO);
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });
}
