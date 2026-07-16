# alpha · theta · vega — Private Financial Intelligence

A dark, institutional-grade personal-finance suite: three apps, one deployment.

- **alpha** is a portfolio analytics terminal. Import your holdings as CSV and
  get allocation, risk, research, quality, factor, scenario, correlation, and
  Monte Carlo analysis.
- **theta** is alpha's sister budgeting/net-worth app. Import transactions (or
  sync a bank via SimpleFIN) and get spending analytics, debt payoff planning,
  cash-flow forecasting, goal tracking, and a net-worth Monte Carlo.
- **vega** is the suite's day-trading terminal. Chart any symbol intraday with
  a candlestick + volume-profile view, run it through an eight-layer Edge
  Engine read, scan a watchlist for gap/RVOL setups, and track a trade journal
  with P&L, R-multiples, and a bootstrap expectancy simulator.

Every chart is hand-built animated SVG — there is no charting library. By
default there are no accounts and no database: your data lives entirely in the
browser's `localStorage`. Accounts are an **optional** layer — turn them on and
each person signs in to their own portfolio and ledger, saved server-side.

Nothing here is investment advice. It's a set of transparent, model-based
tools for understanding your own money.

## Why it's different

- **Live-only, no bundled data.** There is no static per-ticker snapshot
  anywhere in the codebase. Every quote and fundamental comes from a live
  provider at request time; the handful of inputs with no live source (the
  equity risk premium, index-level profitability aggregates) are explicit,
  user-editable assumptions with reference-anchored presets — never silent
  hard-coded numbers.
- **Provenance, not confidence theater.** Every holding's data is tagged
  live / partial / fallback. A stock with no live fundamentals is *excluded*
  from the risk/quality/factor math rather than assigned a made-up beta, and
  the gap shows up as a coverage percentage in the UI.
- **Graceful degradation is load-bearing.** Kill every external provider and
  the app still works on your imported book — allocation, weights, P&L. This
  is asserted by an end-to-end suite that runs with zero network stubs.
- **No accounts required.** The whole thing runs as a single-user, zero-backend
  tool by default. Accounts are additive, not a requirement to get started.
- **Deterministic simulations.** Monte Carlo (alpha and theta), the optimizer's
  multistart search, and vega's expectancy simulator all use a seeded PRNG, so
  results are reproducible for a given portfolio/ledger/journal rather than
  jittering on every reload.

## alpha — portfolio analytics

| Page | What it does |
| --- | --- |
| **Overview** | Net value, cash, P&L, a squarified allocation treemap (size × performance), an interactive donut, and a sortable holdings table with per-position provenance |
| **Household** | A blended read across every portfolio you hold (individual, Roth, joint, …) — the active book priced live, the rest at last-known value, clearly flagged. Reachable once you have more than one portfolio |
| **Intelligence** | An AI daily brief summarizing the portfolio's state, plus the market regime read |
| **Risk** | Beta / volatility / Sharpe vs the S&P 500, concentration (HHI, effective N, top-N), marginal risk contributions, sector tilts, geographic exposure |
| **Research** | Per-holding dashboard: market cap, revenue/EPS/FCF growth, forward P/E, PEG, ROIC, margins, analyst rating + price-target chart, insider activity, next earnings date, factor profile |
| **Dividends** | Dividend history and forward income projection across the book |
| **Rebalance** | An AI dry-powder allocator — where new cash should go, given current weights and fundamentals |
| **Discover** | An AI stock-idea generator across six research lenses (diversify / growth / value / defensive / quality / thematic), with an ETFs on/off toggle |
| **Optimizer** | A deterministic constrained solver (projected gradient ascent / coordinate descent) over factor covariance and CAPM returns, for eight objectives, plus an AI review of the result |
| **Market Analysis** | The regime engine's composite read across ~23 daily index series — score, confidence, health, and drivers, synthesized by AI into a single narrative |
| **Quality** | A weighted scorecard (growth, ROIC, margins, valuation) graded A+–F against the S&P 500, with a composite grade ring and per-holding drill-down |
| **Benchmark & Factors** | Head-to-head vs the S&P 500 and NASDAQ-100, a Growth/Value/Quality/Momentum factor radar, and a growth-vs-valuation map |
| **Correlation** | A factor-model correlation heatmap with crosshair hover, most/least coupled pairs, and a diversification ratio |
| **Scenarios** | "What if TSLA falls 20%?" — single-name shocks with correlated spillover, market moves by beta, rate shocks scaled by duration/valuation/sector |
| **Monte Carlo** | A 3,000-path GBM simulation run in a Web Worker: percentile fan chart, target probability, terminal distribution — seeded and reproducible |
| **Export Report** | A print-optimized, full-portfolio dossier (risk, quality, factors, correlation, dividends, regime), exported via the browser's native print-to-PDF |
| **Import & Data** | Drag-and-drop or paste CSV, set the cash position, load a demo portfolio, manage multiple named portfolios, export, clear |
| **Patch Notes** | A changelog of notable updates |

### The regime engine

The market-regime read behind Intelligence and Market Analysis turns roughly
23 daily index series into eight analytical layers (trend, breadth, momentum,
volatility, leadership, relative strength, structure, transition), then a
composite score, confidence, health, and ranked drivers. Its defining rule:
**no hand-tuned thresholds or fixed layer weights.** Every signal is ranked
against its own trailing-year distribution, and each layer's influence is
earned from its data coverage, internal agreement, and month-long stability —
not asserted.

### CSV format

```csv
name,symbol,shares,price,averageCost,totalReturn,equity
Apple,AAPL,10,291.48,250.00,414.80,2914.80
Cash,CASH,1,850.00,850.00,0,850.00
```

The importer is forgiving: any column order, `$`/`,`/`%` formatting,
parenthesized negatives, quoted names, duplicate-lot merging. `totalReturn` is
auto-detected as dollars or percent. A `CASH`/`USD` row sets the cash
position. A sample file lives at `public/sample-portfolio.csv`.

## theta — personal finance

A companion budgeting/net-worth app at `/theta`, sharing the deployment and
optional accounts layer with alpha but with its own state, shell, and
analytics:

| Page | What it does |
| --- | --- |
| **Dashboard** | Net worth, cash flow, budget status, and a conserved income → spending Sankey diagram for the current month |
| **Net Worth** | Historical trajectory derived from your actual transaction/balance record |
| **Health** | A weighted 0–100 Financial Health scorecard (emergency runway, savings rate, debt-to-income, credit utilization, liquidity, housing burden) against published reference bands, with an optional AI review |
| **Intelligence** | An AI money brief over your ledger, plus (if you link an alpha portfolio) a read on how exposed your net worth is to an equity drawdown |
| **Accounts** | Every account with an editable type (checking/savings/brokerage/retirement/credit/loan) that drives the liquid-vs-invested split, and an "exclude from transactions" toggle |
| **Transactions** | Full transaction list with filtering, category editing, and a local (or AI-assisted) merchant→category auto-tagger |
| **Cash Flow** | A short-horizon forecast — a smooth income/spend baseline plus scheduled recurring charges, with the running balance's low point and a runway estimate |
| **Debt Payoff** | Month-by-month amortization under avalanche (highest-APR-first) or snowball (smallest-balance-first) |
| **Budgets** | Per-category budgets with rollover support |
| **Goals** | Pace, projected completion date, required contribution, and a Monte Carlo success probability per goal |
| **Recurring** | Auto-detected subscriptions and recurring charges (cadence + amount stability across ≥3 charges), with price-creep flags and per-charge dismissal |
| **Projection** | A net-worth Monte Carlo — invested assets follow GBM, cash compounds at its yield, savings grow with assumed income growth |
| **Import & Data** | CSV import for transactions, or connect a bank via SimpleFIN for automatic daily sync |
| **Settings** | Forward-looking assumptions (invested return/vol, cash yield, inflation, income growth, fallback APRs) with base/optimistic/conservative presets |

Categorization is inferred from merchant names via a local keyword table
layered with your own corrections, with an optional "Improve with AI" pass.
Bank sync (SimpleFIN) preserves your manual edits — a re-sync never clobbers a
category or account type you've corrected, and a deleted account stays
deleted.

## vega — day trading

A companion day-trading terminal at `/vega`, sharing the deployment with alpha
and theta but with its own state, shell, and analytics. Its journal and
watchlist stay browser-local (`localStorage`) even with accounts turned on —
only the storage key is namespaced per signed-in user so it isn't shared on a
machine:

| Page | What it does |
| --- | --- |
| **Cockpit** | Watchlist quotes (change, RVOL, range, scan tag), the live-marked working book, and account-level P&L in one dashboard |
| **Chart** | Candlestick chart with a volume lane, moving averages/Bollinger/VWAP overlays, an in-plot volume profile, support/resistance levels, price alerts, and bar-by-bar replay |
| **Edge Engine** | An eight-layer intraday read (trend structure, VWAP posture, momentum, volume pressure, range & levels, relative strength vs SPY, gap behavior, an extension guard) into one conviction score, mirroring alpha's regime engine |
| **Scanner** | A gap × RVOL bubble map across your watchlist, ranked by a cross-sectional heat score |
| **Journal** | Trade log with P&L, R-multiples, equity curve/drawdown, streaks, and a P&L calendar |
| **Analytics** | Performance breakdowns by symbol/setup/time, plus a bootstrap Monte Carlo over your own R-multiples — quantile fans, P(positive), risk of ruin |
| **Risk** | Stop-based position sizing, Kelly fraction, and a daily-loss circuit breaker against the open book |
| **Import & Data** | CSV round-trip for the trade journal, watchlist editor, sample data, and reset switches |

The Edge Engine and the regime engine share the same house rule: signals are
ranked against their own trailing distribution rather than a fixed threshold,
and layer weight is earned from coverage and internal agreement, not asserted.
Quotes and intraday bars are proxied through the same keyless Yahoo Finance
path as alpha, batched into one call per watchlist refresh to stay inside the
provider's rate tolerance.

## Data model — read this once

- **Your positions / transactions** are the source of truth for shares, cost
  basis, and ledger entries. They persist in `localStorage` (or server-side,
  with accounts on) and never leave the browser unless you turn accounts on.
- **Live quotes** (Yahoo Finance, unofficial, keyless) are proxied through
  `/api/quotes`, CDN-cached 60 seconds, and polled every minute while the tab
  is visible. If the feed fails, the app falls back to imported prices with a
  visible status indicator — it never silently goes stale.
- **Live fundamentals** (Yahoo, gap-filled by Finnhub when `FINNHUB_API_KEY`
  is set) return growth, margins, forward P/E, analyst targets, insider flows,
  earnings dates, dividend yield, realized volatility, ROIC, FCF growth, and
  ETF sector look-through — entirely live, cached 12 hours. Each stock shows a
  live/partial badge.
- **Market assumptions** cover the few inputs with no live quote — the equity
  risk premium and the S&P 500 / NASDAQ-100 profitability & growth aggregates.
  They're user-editable with reference-anchored presets (market today / 10-year
  average / recession) on the Benchmark page, not hidden constants.
- **Derived analytics** (correlation, portfolio volatility, scenarios, Monte
  Carlo) are model estimates: a single-market-factor correlation model with
  sector/industry affinity (optionally shrunk toward realized covariance via
  Ledoit-Wolf when return history is available), CAPM expected returns, and
  GBM simulation.
- Holdings with no live data degrade honestly: allocation and P&L still work
  from the imported book, but they're excluded from the factor analytics and
  surfaced as a coverage gap.

If Yahoo's (unofficial) API ever breaks, the app keeps working on the imported
book until a fix ships, or the provider can be swapped behind
`lib/server/yahoo.ts` without touching any analytics code.

## Accounts (optional)

Off by default — the app is a fully client-side, single-user tool with no
sign-in. Set `AUTH_SECRET` + `DATABASE_URL` and it gains real
username/password logins (NextAuth, bcrypt), with each person's alpha
portfolio and theta ledger saved server-side instead of in `localStorage`.
vega's journal and watchlist stay in `localStorage` either way — namespaced
per signed-in user, but never sent to the server. There's no public sign-up;
provision each login yourself:

```bash
npm run db:push                              # create the tables
npm run create-user -- <username> <password> # add a login
```

## Run it

```bash
npm install
npm run dev         # → http://localhost:3000
npm run build       # production build
npm run start       # serve the production build
npm run lint        # eslint (flat config + eslint-config-next)
npm run typecheck   # tsc --noEmit (strict)
npm test            # vitest — the analytics/unit suite
npm run test:watch  # vitest in watch mode
npm run test:e2e    # playwright — whole-app smoke suite (build first)
```

## Environment variables (all optional)

See `.env.example` for full details. Nothing below is required to run the
app — every feature degrades gracefully when its variable is unset.

| Variable | Enables |
| --- | --- |
| `AUTH_SECRET` + `DATABASE_URL` | Real username/password accounts (NextAuth + Postgres) with server-side saved data. Both must be set; provision logins with `npm run create-user -- <user> <pass>`. |
| `ANTHROPIC_API_KEY` | The AI daily brief, dry-powder allocator, Discover ideas, optimizer review, Market Analysis synthesis, and theta's money brief / Financial Health review / transaction categorizer (Claude). |
| `FINNHUB_API_KEY` | Finnhub gap-fill for fundamentals Yahoo leaves empty on newly-listed tickers — margins, ROIC, growth, beta (free tier, 60 req/min). |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 ·
Framer Motion. All charts (treemap, donut, radar, heatmap, fan chart,
histogram, scatter, Sankey, gauges, sparklines, price chart, candlestick +
volume profile) are hand-built SVG — no chart library. Server code is a thin
set of caching proxies to Yahoo Finance, Finnhub, and the Anthropic API; the
analytics themselves run entirely client-side.

## Deploy to Vercel

The repo is zero-config for Vercel:

1. Push to GitHub.
2. [vercel.com/new](https://vercel.com/new) → import the repo → Deploy.
   The Next.js framework preset is auto-detected.

Or from the CLI: `npx vercel`.

Set any of the environment variables above as desired, post-deploy. To turn
on accounts, also run `npm run db:push` and `npm run create-user` against
your `DATABASE_URL`.

## Disclaimer

alpha, theta, and vega are analysis tools, not investment or financial advice.
Live fundamentals and prices come from third-party providers and may be
incomplete or delayed; simulations are models with thinner tails than real
markets.
