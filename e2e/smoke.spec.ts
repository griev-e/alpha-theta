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

/**
 * theta's own routes. theta seeds its illustrative sample ledger on first load
 * in open mode (no theta.ledger.v1 in storage), so these render with data
 * without extra seeding — the new analytics pages (health, projection, debt)
 * included. Live providers stay unstubbed, so the AI sections must degrade to
 * their idle/offline states rather than throw.
 */
const THETA_PAGES: [string, string | RegExp][] = [
  ["/theta", /Net worth|Dashboard|theta/i],
  ["/theta/networth", /Net Worth/i],
  ["/theta/health", /Health/i],
  ["/theta/intelligence", /Intelligence/i],
  ["/theta/accounts", /Accounts/i],
  ["/theta/transactions", /Transaction/i],
  ["/theta/cashflow", /Cash Flow/i],
  ["/theta/debt", /Debt/i],
  ["/theta/budgets", /Budget/i],
  ["/theta/goals", /Goals/i],
  ["/theta/recurring", /Recurring/i],
  ["/theta/projection", /Projection/i],
  ["/theta/import", /Import/i],
  ["/theta/settings", /Settings/i],
];

for (const [path, marker] of THETA_PAGES) {
  test(`renders ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("body")).toContainText(marker, { timeout: 15_000 });
    await expect(page.locator("body")).not.toContainText("Application error");
  });
}

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
