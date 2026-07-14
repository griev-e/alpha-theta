# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

alpha is a dark, institutional-grade personal portfolio
analytics terminal. You import holdings as CSV and it computes allocation,
risk, research, quality, factor, scenario, correlation, and Monte Carlo
analysis. By default there are no accounts and no database: the portfolio lives
in the browser's `localStorage`, almost all analytics run client-side, and the
only server code is a thin set of caching proxies to external data providers.
Accounts are an **optional** layer (see "Accounts & persistence" below): set
`AUTH_SECRET` + `DATABASE_URL` and each person signs in to their own saved
portfolio and theta ledger; leave them unset and the app behaves exactly as the
single-user, localStorage tool it has always been.

Stack: Next.js 16 (App Router) · React 19 · TypeScript 6 (strict) · Tailwind CSS 4
· Framer Motion. All charts are hand-built SVG — **no chart library**.

## Commands

```bash
npm run dev        # dev server → http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
npm run lint       # eslint . — flat config (eslint.config.mjs) + eslint-config-next
npm run typecheck  # tsc --noEmit — strict type check, run this after edits
npm test           # vitest run — the analytics unit suite
npm run test:watch # vitest in watch mode
npm run test:e2e   # playwright — whole-app smoke suite (needs a build first)
```

After edits, verify with `npm run typecheck` and `npm run lint`; run `npm test`
when you touch anything under `lib/analytics`, `lib/csv.ts`, or `lib/data`. CI
(`.github/workflows/ci.yml`) has two jobs: `build` runs lint → typecheck → test
→ build, and `e2e` runs `npm run build` then the Playwright smoke suite — both
must be green on every push and PR. Linting also runs during `next build`, so a
lint **error** fails the production build (warnings don't).
Tests live next to the code as `*.test.ts` (Vitest, `node` environment by
default — see `vitest.config.ts`); shared fixtures are in
`lib/__tests__/factory.ts`. The suite covers the pure analytics (risk,
correlation, quality, factors, scenarios, rebalance, dividends, the optimizer,
the Ledoit-Wolf covariance shrinkage in `lib/analytics/shrinkage.ts`, the
regime engine and its `mathx` helpers plus each of the 8 signal layers,
`buildPortfolio`, the cross-portfolio `lib/household.ts` blend), CSV parsing
(both apps, incl. the shared `csvCore` splitter), the live-data merge layer
(`lib/live/merge.ts`, `lib/live/cma.ts`), theta's compute/csv/categorize/simplefin
modules plus its newer money-analytics layer (debt payoff, financial health +
its ledger adapter, subscription detection, cash-flow forecast, the cash-flow
Sankey model, net-worth Monte Carlo, goal feasibility, derived flow/net-worth
history, the SimpleFIN merge/dedup rules, the alpha↔theta balance and
risk-exposure bridges), the client save-back layer (`lib/persist.ts`), the
per-user DB queries' credential-isolation invariant (`lib/db/state.ts` —
`getUserState` never selects the `simplefin` column), and server-side
correctness (fundamentals sanitization + the Yahoo/Finnhub gap-fill merge,
Yahoo/Finnhub provider math, the SimpleFIN mapper, the envelope-encryption
round-trip in `lib/server/secretBox.ts`, the shared AI-endpoint plumbing —
cache, generation/request limiters, cost math, error mapping — the login rate
limiter, and the AI-model contract guard in `lib/server/aiModels.test.ts`).

**React hooks and components** are tested as `*.test.tsx` files that opt into a
DOM per-file with a `// @vitest-environment jsdom` docblock (jsdom +
`@testing-library/react`, `@vitejs/plugin-react` for the JSX transform,
`@testing-library/jest-dom` matchers via `vitest.setup.ts`) — so the pure
analytics suite stays in the fast `node` environment while hooks
(`useAsyncCompute`, `useDebouncedValue`, the `useMonteCarlo` / `useOptimizer`
Web-Worker sync fallbacks, `useLiveData`'s poll/degrade/refresh, and
`useResearchTarget` — the networked ones over a mocked `fetch`) and
presentational components (`components/ui/Delta`, `components/charts/Sparkline`)
get a real DOM. Add a new DOM test the same way: name it `*.test.tsx` and start
it with the jsdom docblock.

An end-to-end smoke suite lives in `e2e/` (Playwright, `playwright.config.ts`,
excluded from the Vitest glob). It boots the production build and walks every
alpha and theta route with a seeded-localStorage portfolio, asserting each page
actually renders — catching whole-page regressions (a throw during render, a
broken provider fallback, a hydration crash) the unit suite structurally can't.
It deliberately runs with **no network stubs**, so it also verifies the
graceful-degradation contract: pages must render with every live provider
unreachable.

### Environment variables (all optional, see `.env.example`)

- `AUTH_SECRET` + `DATABASE_URL` — turn on **accounts** (see "Accounts &
  persistence" below). Both must be set; when either is unset the app is open
  and single-user (localStorage), so local dev never locks you out. `AUTH_SECRET`
  signs the NextAuth JWT session; `DATABASE_URL` is a standard Postgres
  connection string (Neon, Supabase, Vercel Postgres — any provider works, via
  the `postgres-js` driver). There is no public sign-up — provision logins with
  `npm run create-user`. (This replaces the old `ACCESS_PIN` PIN gate.)
- `ANTHROPIC_API_KEY` — enables the AI daily brief on the Intelligence page.
  When unset, the brief section degrades gracefully and everything else works.
- `FINNHUB_API_KEY` — optional Finnhub key. A **second live provider that
  gap-fills** the fundamentals Yahoo leaves empty (common for newly-listed
  tickers with no statement history: margins, ROIC, growth, beta). Gap-fill
  only — never overrides Yahoo. Two calls/symbol, 12h-cached, inside the free
  tier's 60-requests/minute budget. See `lib/server/finnhub.ts`.

## Architecture

### The data-layering model (read this first)

The app is **live-only**: there is no bundled per-ticker fundamentals snapshot.
Every fundamental and price value comes from a provider, and the few inputs with
no live quote are explicit, user-editable assumptions — never frozen data
masquerading as live. Understand this before touching `lib/analytics` or
`lib/live`:

1. **Your positions** — the imported CSV is the source of truth for *shares and
   cost basis*. Persisted in `localStorage`, never sent anywhere.
2. **Live quotes / fundamentals** — Yahoo Finance (unofficial, keyless) via
   `yahoo-finance2`, proxied through `/api/quotes` and `/api/fundamentals`. The
   `/api/fundamentals` orchestrator (`lib/server/fundamentals.ts`) returns every
   fundamental field for a stock (sector, beta, margins, growth, analyst,
   insider, earnings), derives **realized volatility** from price history and
   **ROIC / FCF growth** from Yahoo's statement modules, and pulls **ETF sector
   look-through** from `topHoldings`. When `FINNHUB_API_KEY` is set, Finnhub
   **gap-fills** any field Yahoo left empty (never overriding it).
   `lib/live/merge.ts` (`mergeFundamentals`/`fromPatch`) turns the patch into a
   `Fundamentals`; with no patch the result is `null` (no data). Revenue-by-region
   mix has **no keyless source**, so region exposure is usually empty.
3. **Market assumptions** (`lib/data/assumptions.ts`) — the irreducible
   remainder with no live quote: the **equity risk premium**, the S&P
   **dividend-growth anchor**, and the **S&P 500 / NASDAQ-100 profitability &
   growth aggregates** (margins, ROIC, revenue/EPS/FCF growth — no keyless
   index-level source exists). These are user-editable with reference-anchored
   presets (Market today / 10-year average / Recession) on the Benchmark page;
   defaults equal the figures the app previously hard-coded. Held in
   `lib/assumptions/store.tsx` (localStorage), bridged to the pure analytics via
   the `lib/live/assumptions.ts` singleton.

**No-data handling.** A holding whose live fundamentals fetch returns nothing
gets `fundamentals: null` and is **excluded from the factor math** (risk,
correlation, quality, factors, scenarios, optimizer) rather than imputed with a
default β/σ — its weight shows up as a coverage gap (`coveragePct`). Allocation
and P&L still work from the imported book. **Provenance is never silent**:
`mergeFundamentals` records per-field source (live vs fallback) and a
`live/partial/fallback` roll-up, which `buildPortfolio` combines with the
live-price flag into `Position.dataSource` and the UI surfaces (provenance dot,
coverage summary, Research badge).

**Benchmark profiles & CMA are live too.** Risk-free rate (`^IRX`), realized
S&P 500 / NASDAQ-100 volatility, and the benchmark **P/E, dividend yield, FCF
yield and sector weights** (from the SPY/QQQ proxies) are fetched via `/api/cma`
(`lib/server/cma.ts`, 6h-cached) and overlaid in `lib/live/cma.ts`. A full
`BenchmarkProfile` is assembled by `resolveBenchmark` (static identity + live
valuation/sector fields + assumption-driven profitability/growth);
`liveBenchmarkProfiles()` is the resolved S&P 500 / NASDAQ-100 most pages
consume. The equity risk premium is *not* derived (the trailing-earnings "Fed
model" goes negative in a high-rate regime) — it's the editable assumption.

### Client state flow

`app/layout.tsx` wraps everything in `PortfolioProvider` → `AppShell`.

- **`lib/store.tsx`** (`usePortfolio`) is the single source of truth for the
  portfolio. It reads/writes `localStorage` (key `alpha.portfolio.v1`,
  migrates legacy keys), drives `useLiveData`, and memoizes the enriched
  `Portfolio` via `buildPortfolio`.
- **Multiple portfolios per user.** The persisted alpha blob is a *set* of named
  portfolios (individual account, Roth IRA, …) plus an `activeId`, not a single
  book — see `lib/portfolios.ts` (`PortfolioSet`/`NamedPortfolio` + the pure
  migrate/add/rename/remove/select helpers, all unit-tested in
  `portfolios.test.ts`). `lib/store.tsx` builds `buildPortfolio` only for the
  **active** portfolio, so every analytics page stays single-portfolio and
  unchanged; the store just exposes the list + switch/create/rename/delete
  actions (surfaced by `components/shell/PortfolioSwitcher.tsx` in the shell and
  the portfolios panel on `/import`). The whole set persists as one **opaque**
  blob — localStorage in open mode, the `user_state.portfolio` JSONB column in
  server mode — so the DB, `lib/persist.ts`, and per-user isolation need no
  change. `migrate()` transparently upgrades the legacy single-portfolio shape
  (`{ holdings, cash, asOf, isDemo? }`) into a one-entry set on first read.
  When there's more than one book, `usePortfolio` also exposes a `household`
  blend (`lib/household.ts`): the active portfolio contributes its live value,
  every other book its last-known imported value, flagged so the UI never
  implies the whole household is live. Reached via "Household" in the
  `PortfolioSwitcher` dropdown (`/household`) — deliberately not in the main
  `NAV`, since it only makes sense once a second book exists.
- **`lib/analytics/build.ts`** (`buildPortfolio`) is the central enrichment
  step: it reprices holdings from live quotes, computes weights / cost basis /
  P&L / day-change, and merges fundamentals onto each position. **Most pages
  consume the `Portfolio` it produces** — changes here ripple everywhere.
- **`lib/live/useLiveData.ts`** polls `/api/quotes` every 60s (only while the
  tab is visible), fetches the fundamentals overlay once per symbol set, and
  exposes a `refresh()` that punches through every cache layer. Symbols are
  sorted into a stable key to keep the CDN cache hot.
- **`lib/research/useResearch.ts`** (`useResearch`) backs the Research terminal:
  given a single symbol it polls `/api/quotes`, fetches the fundamentals patch,
  and builds a `Fundamentals` from it via `lib/live/merge.ts` (`fromPatch`) —
  live-only, scoped to one ticker, with no data when the provider has none.

### Accounts & persistence (optional)

Off by default. Set `AUTH_SECRET` + `DATABASE_URL` and the app gains real
username/password logins (NextAuth, Credentials provider, bcrypt) with each
user's data saved server-side. Unset either and everything below is bypassed —
the stores fall back to localStorage and the app is the open single-user tool it
has always been. **Preserve both paths when editing the stores, middleware, or
auth.**

- **One gate, both apps.** `middleware.ts` (edge, via the slim `auth.config.ts`)
  protects every route; `components/auth/AuthProvider.tsx` exposes `useAuth()`
  (`enabled` / `status` / `userId` / `name`) and only mounts NextAuth's
  `SessionProvider` when accounts are on. `auth.ts` (Node — bcrypt + DB) holds
  the full config; never import it from middleware or client code.
- **JSONB blob per user, not normalized tables.** The client owns all mutation
  and derivation (`buildPortfolio`, `deriveTheta`), so the DB just stores each
  app's existing shape opaquely: two tables (`users`, `user_state`) in
  `lib/db/schema.ts`, the lazy provider-agnostic Postgres client (via
  `postgres-js`) in `lib/db/index.ts`. Saving an alpha
  change never touches the theta blob (separate `PUT` endpoints). `user_state`
  also carries an optional `simplefin` column (theta's bank-sync access URL +
  last-sync time) that is read **only** by the `/api/theta/simplefin/*` routes
  and deliberately never selected by `getUserState`, so the credential can't
  ride along to the client.
- **The stores choose their backend.** `lib/store.tsx` and `lib/theta/store.tsx`
  branch on `useAuth()`: signed in → hydrate from `/api/state` and push edits
  back through `lib/persist.ts`; otherwise → localStorage as before. In server
  mode they read **only** the server (never the shared-browser cache), so one
  person's data can't leak to the next who signs in on the same machine.
- **No public sign-up.** Provision logins with `npm run create-user -- <user>
  <pass>`; create/update tables with `npm run db:push` (Drizzle Kit).

### Server routes (`app/api/*`) — all thin cached proxies

Each route handler sanitizes input, calls a `lib/server/*` module, and sets
`Cache-Control` for CDN caching. `lib/server/*` modules also keep module-scope
Maps as a warm-lambda cache. Provider code (`yahoo-finance2`, Anthropic SDK) is
**only ever imported from `lib/server/*`** — it must never ship to the browser.

| Route | Backed by | Notes |
| --- | --- | --- |
| `/api/quotes` | `lib/server/yahoo.ts` | Live prices, 60s CDN cache, `?fresh=1` bypasses caches. Extended-hours aware. |
| `/api/fundamentals` | `lib/server/fundamentals.ts` (Yahoo + optional Finnhub) | Fundamentals patch, 12h cache. Yahoo primary; Finnhub gap-fills the fields Yahoo leaves empty. |
| `/api/history` | `lib/server/yahoo.ts` | Adjusted-close price history for one symbol (`?symbol=&range=1m\|6m\|1y\|5y`), 10min cache. Powers the Research price chart. |
| `/api/search` | `lib/server/yahoo.ts` | Ticker / company lookup for the Research terminal, 6h cache. Failures return an empty list, never a 5xx. |
| `/api/cma` | `lib/server/cma.ts` | Capital-market assumptions (risk-free rate, benchmark vols), 6h cache. Overlays live market data onto static forward assumptions. |
| `/api/market` | `lib/server/marketData.ts` | Market regime report (see below), 5min cache. |
| `/api/news` | `lib/server/news.ts` | Headlines for the Intelligence page. |
| `/api/dividends` | `lib/server/dividends.ts` | Dividend history/projection. |
| `/api/brief` | `lib/server/brief.ts` | AI daily brief (Anthropic). POSTs the in-browser portfolio snapshot since holdings never persist server-side. Caches one brief per day per portfolio shape. |
| `/api/allocate` | `lib/server/allocator.ts` | AI dry-powder allocator for the Rebalance page (Anthropic). POSTs a fundamentals-enriched snapshot; returns a structured cash-deployment plan. Caches one plan per day per portfolio shape. |
| `/api/optimize` | `lib/server/optimizer.ts` | AI optimizer review for the Optimizer page (Anthropic, Sonnet 4.6). The optimal weights are solved client-side; this POSTs the before/after metrics + largest shifts and returns a structured construction read. Caches one review per day per objective + portfolio shape. |
| `/api/discover` | `lib/server/discover.ts` | AI stock-idea generator for the Discover page (Anthropic, Sonnet 4.6). POSTs the portfolio shape + chosen research lens; returns structured candidate ideas. |
| `/api/market-brief` | `lib/server/marketBrief.ts` | AI market read for the Market Analysis page (Anthropic, Sonnet 4.6, adaptive thinking at `high` effort). POSTs a compact snapshot of the regime engine's output (composite score, the eight layers, ranked drivers) and returns a structured synthesis — headline, read, positioning, watch items, counter-signal. Cached one per day per regime shape. |
| `/api/theta-brief` | `lib/server/thetaBrief.ts` | theta's AI money brief, parallel to `/api/brief` but over the ledger snapshot instead of the portfolio. User-triggered (not auto-run); Sonnet 4.6 with adaptive thinking at `high` effort, cached one per day per ledger shape. |
| `/api/theta/categorize` | `lib/server/thetaCategorize.ts` | AI batch merchant→category categorizer backing the Transactions/Import auto-tagger's "Improve with AI" pass (Anthropic, Haiku 4.5, thinking disabled). Chunks large merchant batches so one bad chunk degrades to a partial result instead of erroring; cached one response per day per merchant-set shape. |
| `/api/theta/review` | `lib/server/thetaReview.ts` | AI money review for the Financial Health scorecard — a reasoning pass over the health metrics, spending anomalies, and detected subscriptions (Anthropic, Sonnet 4.6, adaptive thinking at `high` effort). Cached one per day per ledger shape. |
| `/api/auth/*` | `auth.ts` (NextAuth) | Session, sign-in/out, CSRF. The Credentials provider (username + password, bcrypt) authenticates against the `users` table; the fixed-window limiter in `lib/server/rateLimit.ts` throttles login brute force. Only meaningful when accounts are enabled. |
| `/api/state` | `lib/db/state.ts` (`lib/server/authState.ts` reads the session) | `GET` returns both saved blobs (alpha portfolio + theta ledger) for the signed-in user; `PUT /api/state/portfolio` and `PUT /api/state/ledger` upsert each independently. 404 when accounts are off, 401 when signed out. |
| `/api/theta/simplefin` | `lib/server/simplefin.ts` + `lib/db/state.ts` | theta's optional SimpleFIN bank sync (**accounts-only**). `POST /claim` exchanges a setup token for an access URL stored server-side; `POST /sync` pulls accounts+transactions and returns them already mapped to theta shapes (the pure `lib/theta/simplefin.ts`), the client merging by stable id via `applySimplefinSync`/`lib/theta/simplefinMerge.ts` (which also keeps deleted accounts deleted and preserves user-edited categories/account types across re-sync); `GET`/`DELETE` report/clear the link. The access URL holds bank credentials — it lives in the `user_state.simplefin` column **sealed at rest** by `lib/server/secretBox.ts` (AES-256-GCM, key derived from `AUTH_SECRET`), is read only by these routes, and **never** reaches the client (`getUserState` omits it). Same `requireUser` gate as `/api/state`. A daily best-effort auto-sync (`lib/theta/useSimplefinAutoSync.ts`, mounted in `ThetaShell`) refreshes it on load/focus when the last sync is stale. |

`middleware.ts` enforces the auth gate **when accounts are on**: pages redirect
to `/lock`, APIs return 401, and `/api/auth/*` + `/lock` are always allowed.
When accounts are off (no `AUTH_SECRET`/`DATABASE_URL`) it short-circuits to a
no-op and the app is fully open — the graceful-degradation default.

`lib/server/cost.ts` has the per-model $/Mtok pricing table and `usdCost()`,
which turns an Anthropic `usage` object into a USD estimate (cache writes at
1.25× input, cache reads at 0.1×). Every Anthropic-backed route surfaces this
as `costUSD` in its response so the UI can show what each AI call cost. When
adding a new Anthropic-backed model, add its pricing here too.

**Shared AI-endpoint plumbing & security hardening.** `lib/server/aiEndpoint.ts`
holds what the eight Anthropic-backed routes (`brief`, `allocator`, `optimizer`,
`discover`, `marketBrief`, `thetaBrief`, `thetaCategorize`, `thetaReview`) used to duplicate:
`AiCache` (the day/shape response cache), `GenLimiter` (an hourly
per-warm-instance generation cap — a cost backstop), and `mapAnthropicError`
(provider errors → user-facing status). `lib/server/rateLimit.ts` does double
duty: a fixed-window brute-force lock on login attempts (keyed by IP +
username, enforced in `auth.ts`) **and** a per-IP request limiter in front of
the AI + search routes, since those are reachable pre-auth in open mode and are
cost-incurring (the daily shape cache alone can't stop request churn).
`next.config.ts` applies a framework-safe CSP subset
(`base-uri`/`object-src`/`frame-ancestors`/`form-action` — deliberately no
`script-src`/`style-src`, so App Router hydration and Framer Motion's inline
styles stay untouched) plus HSTS/`X-Frame-Options`/`nosniff`/Permissions-Policy
to every route via `headers()`. `lib/server/simplefin.ts` guards against SSRF:
before the claim/sync fetches it requires `https` and rejects hosts that
resolve to private/loopback/link-local ranges (including the `169.254.169.254`
cloud-metadata address). `lib/server/secretBox.ts` envelope-encrypts (AES-256-GCM,
HKDF-SHA256 key derived from `AUTH_SECRET`) the one secret the DB holds — the
SimpleFIN access URL — so it's unreadable from a leaked DB snapshot/backup even
though the client-isolation rules already keep it off the wire; legacy
plaintext rows pass through unchanged and reseal on their next write.

### Analytics modules (`lib/analytics/*`)

All pure, client-side, model-based estimates. Methodology notes live next to the
math. Key pieces: `risk.ts`, `correlation.ts` (single-market-factor model with
sector affinity), `quality.ts` (weighted scorecard vs S&P 500; multiples use
weighted harmonic mean), `factors.ts`, `scenarios.ts`, `montecarlo.ts` (seeded
GBM — deterministic per portfolio), `rebalance.ts`, `dividends/`. The
**optimizer** lives in `lib/optimizer/optimize.ts` — a deterministic constrained
solver (projected gradient ascent on a capped simplex, plus cyclical coordinate
descent for risk parity) over the same factor covariance and CAPM expected
returns, producing optimal weights, an efficient frontier, and a trade list for
eight objectives. Monte Carlo and the optimizer's multistart share a seeded PRNG
(`mulberry32` in `lib/analytics/mathUtils.ts`) so both draw reproducible
sequences without duplicating the generator. `shrinkage.ts` implements
Ledoit-Wolf covariance shrinkage: when real return history is available it
blends the structural factor-model covariance with the (noisy) sample
covariance at the analytically-optimal intensity, rather than trusting either
alone.

**The market regime engine (`lib/analytics/regime/`)** is the most involved
subsystem. It turns ~23 daily index series into 8 analytical layers
(`layers/`) → a composite regime score, confidence, health, and drivers. Its
defining principle: **no hand-tuned signal thresholds or layer weights**. Every
signal is ranked against its own trailing-year distribution (percentiles, not
fixed thresholds), and each layer's weight is *earned* from its data coverage,
internal agreement, and month-long stability (`engine.ts`). The aggregation and
labelling layer on top does use structural constants (a confidence exponent,
coherence/stability multipliers, a sign deadband, and the regime-label /
driver cutoffs). To add a signal layer, implement a
`LayerSpec` and register it in `layers/index.ts` — weighting, consensus,
confidence, and UI all adapt automatically.

### Pages & components

- `app/*/page.tsx` — one route per nav item. The nav list is defined in
  `components/shell/AppShell.tsx` (`NAV` array, grouped under **Portfolio** /
  **Analysis** / **Simulation** / **Data**) — add routes there. Current items:
  Overview (`/`), Intelligence, Risk, Research, Dividends, Rebalance,
  Discover; Optimizer, Market Analysis, Quality, Benchmark & Factors,
  Correlation; Scenarios, Monte Carlo; Export Report (`/report`), Import &
  Data (`/import`), Patch Notes. `/household` (see above) is a route that
  deliberately isn't in `NAV`. `/design` is a dev-only design-system gallery
  (`app/design/DesignGallery.tsx`) that 404s in production and is reachable
  only by URL — update it when adding a new primitive or chart.
- **Command palette** — `components/shell/CommandPalette.tsx` (⌘K) surfaces
  page navigation, quick actions (refresh live data, load demo, jump to
  theta), and portfolio switching in one searchable list; `navChords.ts`
  backs single-key nav chords (e.g. `J`/`K` to step through the holdings
  rail) documented in `components/shell/KeyboardMap.tsx`.
- **Discover** (`/discover`) is an AI stock-idea generator: pick one of six
  research lenses (diversify / growth / value / defensive / quality /
  thematic), optionally flip the "Suggest ETFs" toggle off to restrict ideas to
  individual stocks, and POST the portfolio shape + `includeEtfs` to
  `/api/discover` (`lib/server/discover.ts`, Claude Sonnet 4.6), returning a
  structured list of candidate ideas with rationale (cached separately per
  mode + ETF choice + portfolio shape). Types in `lib/discover/types.ts`.
- **`/report`** renders a print-optimized, full-portfolio dossier and exports it
  via the browser's native `window.print()` (→ Save as PDF). Toolbar/nav chrome
  is hidden with `no-print` classes — there is no PDF library. It recomputes
  every analytics report (risk, quality, factors, correlation, dividends,
  regime) inline against the live `Portfolio`.
- **Patch Notes** (`/patch-notes`) renders `lib/data/patchNotes.ts` (`PATCH_NOTES`,
  newest first). Add an entry there whenever a notable change ships.
- `lib/data/benchmarks.ts` holds the S&P 500 / NASDAQ-100 (`SPX`, `NDX`)
  reference profiles the Quality and Report pages score holdings against.
- `components/charts/*` — hand-built SVG visualizations (Treemap, Donut, Radar,
  Heatmap, FanChart, Histogram, Scatter, Sparkline, PriceChart).
- `components/ui/*` — reusable primitives (Card, Gauge, Ring, Stat, Meter,
  AnimatedNumber, Delta, EmptyState, ErrorBoundary, PageHeader, Computing,
  TickerLogo, etc.).
- `lib/useAsyncCompute.ts` — runs expensive synchronous analytics off the
  critical render path (paints UI first, computes on the next tick, keeps the
  previous value so charts don't unmount). Use this for heavy page-level
  computations rather than computing inline. **Monte Carlo** goes one step
  further: `lib/analytics/useMonteCarlo.ts` runs the sim in a Web Worker
  (`montecarlo.worker.ts`) to keep the main thread free, falling back to
  synchronous compute when Workers are unavailable.
- **First-view/first-import choreography.** `lib/firstView.tsx`
  (`useFirstView`) tracks, per navigation, whether a route is being seen for
  the first time *this session* (a module-level set of visited paths reset on
  full reload) so `Card`/`PageHeader`/staggered rows can run their entrance
  animation once and render instantly on return visits; interaction motion
  (hover springs, count-ups, chart draws) is never gated by it. `lib/firstImport.ts`
  (`useOverture`) is the once-*ever* cousin, persisted in localStorage: it
  drives Overview's one-time counting-up flourish the session real portfolio
  data first lands. `lib/syncStatus.ts` is a tiny module-scope channel (set by
  `lib/persist.ts`, read via `useSyncExternalStore`) that makes a failed or
  conflicted server save visible in the shell's sync banner (`StatusCenter.tsx`)
  instead of vanishing into `console.error`. `lib/marketSession.ts` derives the
  US equity session (pre/open/post/closed) from the wall clock for the Overview
  session ribbon (`MarketPulse.tsx`) — calendar-only, paired in the UI with the
  live-price truth rather than replacing it. `lib/watchlist.ts` is a
  localStorage-backed starred-symbol list broadcast across mounts via a
  same-tab custom event.

### theta — the sister personal-finance app (`app/theta/*`)

theta is a separate personal-finance terminal living in the same Next.js app,
behind its own routes (`/theta`, `/theta/networth`, `/theta/health`,
`/theta/intelligence`, `/theta/accounts`, `/theta/transactions`,
`/theta/cashflow`, `/theta/debt`, `/theta/budgets`, `/theta/goals`,
`/theta/recurring`, `/theta/projection`, `/theta/import`, `/theta/settings`).
It shares the project, the optional accounts/auth layer, and `components/ui/*`
with alpha, but otherwise has its own state, shell, and analytics:

- **State** — `lib/theta/store.tsx` (`ThetaProvider`/`useTheta`) mirrors
  `lib/store.tsx`'s pattern exactly: localStorage (key `theta.ledger.v1`,
  plus a `theta.isSample.v1` flag for the bundled sample ledger) by default,
  or server-backed via `lib/persist.ts` when accounts are enabled.
- **Domain types & derivation** — `lib/theta/data.ts` defines `Account`,
  `Transaction`, `Budget`, `Category`, `Goal`, `Recurring`, `Ledger`, plus
  `EMPTY_LEDGER`/`SAMPLE_LEDGER`. `lib/theta/compute.ts` (`deriveTheta`,
  `advanceRecurring`) is theta's analogue to `buildPortfolio` — the pure
  derivation layer most pages consume. `lib/theta/csv.ts` handles transaction
  CSV import; `lib/theta/categorize.ts` is the local, zero-cost merchant→category
  keyword table layered with learned history (used by CSV import and bank sync
  when no category is given); an optional "Improve with AI" pass hits
  `/api/theta/categorize`. `lib/theta/intelligence.ts` holds the shared types
  for the `ThetaSnapshot`/`ThetaBrief` (`/api/theta-brief`) and the AI
  categorizer/review request-response shapes.
- **Money-analytics engines**, each pure with an explicit `now` (mirroring how
  `lib/analytics/*` takes no ambient state):
  - `lib/theta/health.ts` + `lib/theta/healthInputs.ts` — the Financial Health
    scorecard, a weighted 0–100 blend (emergency runway, savings rate,
    debt-to-income, credit utilization, liquidity, housing burden) each scored
    against a published reference band and coverage-reweighted when a metric's
    inputs are missing, theta's analogue of `lib/analytics/quality.ts`.
    `healthInputsFromLedger` is the adapter that assembles `HealthInputs` from
    a `Ledger` + `ThetaView` + assumptions, keeping the scorer itself a pure
    function of its inputs. Backs `/theta/health`, which offers an optional AI
    review (`/api/theta/review`, `lib/server/thetaReview.ts`) that reasons
    across the score, spending anomalies, and detected subscriptions.
  - `lib/theta/debt.ts` — the debt-payoff planner: amortizes liabilities
    month-by-month under avalanche (highest-APR first) or snowball
    (smallest-balance first), routing any budget above the summed minimums at
    the current target. Backs `/theta/debt`.
  - `lib/theta/project.ts` — the net-worth trajectory Monte Carlo: invested
    assets follow GBM, cash compounds at its yield, monthly savings are
    contributed and grow with assumed income growth, liabilities held flat as a
    conservative floor. Seeded via the shared `mulberry32` (deterministic per
    balance sheet, like alpha's Monte Carlo). Backs `/theta/projection`.
  - `lib/theta/goals.ts` — goal feasibility: pace needed, projected completion
    date, contribution required to hit a target date, on-track/behind/at-risk
    status, and a Monte-Carlo success probability (goal pots modeled as
    short-horizon savings, not the equity book, so they don't inherit
    portfolio-level volatility).
  - `lib/theta/detect.ts` — recurring-charge auto-detection: groups
    transactions by normalized merchant and flags ≥3 charges whose cadence and
    amount are stable, surfacing subscriptions the ledger doesn't yet track and
    price creep on ones it does. Dismissible per-charge on the Recurring page.
  - `lib/theta/forecast.ts` — short-horizon cash-flow forecast: a smooth daily
    baseline drift (expected income − discretionary spend) plus discrete
    recurring charges dropped on their scheduled dates, exposing the running
    balance, its low point, and a runway estimate.
  - `lib/theta/spending.ts` — distribution-ranked spending analytics: borrows
    the regime engine's principle of ranking a signal against its own trailing
    history (percentiles) rather than a fixed dollar threshold, so an anomaly
    is relative to how *this* person normally spends in that category.
  - `lib/theta/history.ts` — derives the cash-flow and net-worth chart series
    from the actual transaction record (flows bucketed by calendar month, net
    worth reverse-walked from each account's balance) instead of the ledger's
    old static, hand-anchored arrays; those survive only as a fallback for
    months with no transaction coverage.
  - `lib/theta/assumptions.ts` + `lib/theta/assumptionsStore.tsx` — theta's
    analogue of `lib/data/assumptions.ts`/`lib/assumptions/store.tsx`: the
    forward inputs (invested return/vol, cash yield, inflation, income growth,
    fallback APRs) the projection/goals/debt engines need but have no live
    quote for. User-editable with base/optimistic/conservative presets in
    Settings, persisted in the store and fed to the engines as an explicit
    argument.
  - `lib/theta/bridge.ts` — the alpha↔theta link: a theta brokerage/retirement
    account can carry a `linkedPortfolioId`; `applyPortfolioLinks` overrides
    that account's balance with the linked alpha portfolio's live value
    (only the active alpha portfolio is live-priced, so unresolved links keep
    their manual balance rather than showing a stale one).
  - `lib/theta/household.ts` — goes one step past the balance bridge to read
    the linked alpha portfolio's *risk* (beta/volatility) and model
    drawdown scenarios against net worth and liquid savings, answering how
    exposed theta's safety net is to an equity shock. Pure numeric inputs, no
    store coupling.
  - `lib/theta/sankey.ts` — the cash-flow Sankey model backing the dashboard's
    flow diagram (`components/charts/Sankey.tsx`): turns the current month's
    transactions into a conserved income→hub→category graph, with any
    overspend modeled as an extra inflow from savings so the ribbons always
    balance.
- **Bank sync (optional, accounts-only)** — `lib/theta/simplefin.ts` is the
  pure mapper from a SimpleFIN payload to theta `Account`/`Transaction` records
  (stable prefixed ids for dedup, account-kind inference, liability-sign
  normalization); `lib/theta/simplefinMerge.ts` is the pure merge into an
  *existing* ledger, isolated because its dedup rules back several
  user-visible behaviors: deleted accounts stay deleted (tracked in
  `ledger.dismissedSyncAccounts`, with a "Restore on next sync" undo),
  manually-corrected categories and account types survive a re-sync (the
  server re-derives both from scratch on every pull, so the ledger's existing
  value wins over a fresh guess), and balance-history trends extend rather
  than reset. It's driven by the `/api/theta/simplefin/*` routes over
  `lib/server/simplefin.ts`; the client applies results via
  `applySimplefinSync` in the store, and `lib/theta/useSimplefinAutoSync.ts`
  (mounted once in `ThetaShell`) triggers a best-effort daily refresh on
  load/focus when the last sync is stale. See the route table above for the
  credential-isolation and at-rest-encryption rules.
- **Shell & nav** — `components/shell/ThetaShell.tsx` (own icon set in
  `components/shell/thetaIcons.tsx`) replaces `AppShell` entirely for
  `/theta/*` routes: `AppShell.tsx` detects the `/theta` path prefix, wraps
  the tree in `ThetaProvider`, and renders `ThetaShell` instead of its own
  chrome. theta's nav groups Overview (Dashboard, Net Worth, Health,
  Intelligence), Money (Accounts, Transactions, Cash Flow, Debt Payoff),
  Planning (Budgets, Goals, Recurring, Projection), System (Import & Data,
  Settings) — add new theta routes there, not to alpha's `NAV` array.
- **Components** — theta-only UI lives in `components/theta/*`
  (`EditableMoney.tsx`, `SimplefinCard.tsx`, `InstitutionLogo.tsx`,
  `TransactionFilter.tsx`, `modals.tsx`, `bits.tsx`, `ui.tsx`); shared
  primitives still come from `components/ui/*`.
- Every account has an editable **type** (checking/savings/brokerage/
  retirement/credit/loan — drives the liquid-vs-invested split behind net
  worth, the projection, and Health's runway/liquidity metrics) and an
  **"Exclude from transactions"** toggle (Accounts page settings gear) that
  keeps an account's activity out of spending/budgets/cash-flow/the
  auto-tagger while its balance still counts toward net worth.
- `app/theta/layout.tsx` overrides the root metadata (title "theta", its own
  favicon at `app/theta/icon.svg`) so the two apps feel distinct even though
  they're one deployment.

### vega — the day trading terminal (`app/vega/*`)

vega is the third portal app (gold accent, `--color-gold`, `.vega-scope`),
behind its own routes (`/vega` cockpit, `/vega/chart`, `/vega/engine`,
`/vega/scanner`, `/vega/journal`, `/vega/analytics`, `/vega/risk`,
`/vega/import`). Same delegation pattern as theta: `AppShell` detects the
`/vega` prefix and renders `VegaProvider` + `components/shell/VegaShell.tsx`
(nav groups Trade / Performance / System, icons in
`components/shell/vegaIcons.tsx` — add new vega routes there). The lock-screen
portal, `AppTitle` switcher and both other apps' ⌘K palettes know all three
apps via `components/shell/brand.tsx` (`AppKind`).

- **State** — `lib/vega/store.tsx` (`VegaProvider`/`useVega`): watchlist,
  focus symbol, trade journal, price alerts, and risk settings in one
  localStorage blob (key `vega.state.v1`, shape `v: 2`; migrated/repaired by
  `migrateVegaState` in `lib/vega/types.ts`, which upgrades v1 pre-alert blobs
  transparently). Deliberately browser-local even in accounts mode — no
  `user_state` schema change — but the storage key is suffixed with the
  signed-in userId so journals stay isolated on a shared machine. The sample
  journal (`lib/vega/sample.ts`) is flagged `isSample` and badged. Cosmetic
  chart choices (interval, overlay toggles, indicator pane) persist separately
  under `vega.ui.v1` via `lib/vega/uiPrefs.ts` — per-browser UI prefs,
  deliberately outside the versioned/migrated store blob.
- **Data plumbing** — two vega-specific proxies over `lib/server/intraday.ts`
  (which has its own `sanitizeVegaSymbols` that keeps `^`/`=` so index and
  futures tickers survive): `/api/vega/quotes` returns rich day-trading quotes
  (day OHLC, volume, 10d/3m averages, 52w range, extended hours) for up to 40
  symbols in ONE batched Yahoo call, 30s-cached; `/api/vega/intraday` returns
  OHLCV bars for one symbol (`1m|5m|15m|1d`, pre/post included intraday),
  55s-cached (the route distinguishes a conclusive "no bars" 404 from a
  transient provider failure — the latter is never negative-cached and serves
  the last good series stale, so a hiccup can't blank a working chart).
  Client hooks `lib/vega/useVegaQuotes.ts` (30s poll, identity-stable across
  byte-identical payloads so consumer memos stay cold) and `useIntraday.ts`
  (60s poll, focused symbol only; applies `repairBars` centrally and drops a
  stale symbol's tape if a switch's first load fails) share the
  `lib/useVisibilityPoll.ts` cadence hook.
  **Never add per-symbol fan-out** — the batch endpoint is what keeps vega
  inside the keyless provider's tolerance (the watchlist cap `WATCHLIST_MAX`
  exists for the same reason).
- **Pure analytics (`lib/vega/*`, all unit-tested)** — `indicators.ts` (SMA/
  EMA/RSI/MACD/Bollinger/ATR + session-anchored VWAP with volume-weighted σ
  bands, plus `repairBars` — three-pass bad-print repair whose body passes
  only touch zero-volume bars, so volume-backed real moves are structurally
  exempt), `session.ts` (ET session math over bar timestamps — the VWAP
  anchor, opening range, the `displayWindow`/`replayStart` contracts shared
  by the chart and bar replay, and "minutes into the session" all derive
  from it), `levels.ts` (floor pivots, prior-day H/L/C, opening/premarket
  range, swing S/R clustering — drawn on the chart as `SR` levels),
  `profile.ts` (volume
  profile: POC + 70% value area), `scan.ts` (gap/RVOL/range metrics + the
  cross-sectional heat score — percentiles within the scanned set, the regime
  engine's no-hand-tuned-thresholds principle), `journal.ts` (P&L,
  R-multiples, equity curve/drawdown, streaks, groupings), `risk.ts`
  (stop-based position sizing, Kelly, the daily-loss circuit breaker),
  `csv.ts` (forgiving journal CSV round-trip over the shared `csvCore`
  splitter), `positions.ts` (the working book marked live: unrealized P&L and
  open R against the quote poll, dollars-at-risk-to-stop totals, honest
  unpriced/no-stop counts — open symbols simply join the existing quote batch),
  `markers.ts` (journal fills mapped onto chart bar indices by timestamp —
  binary search over the tape, off-window fills stay unmarked),
  `alerts.ts` (true-cross price-alert sweep + the cap-aware
  `withAlertAdded` — an armed alert is never silently evicted; the live half
  is `useAlertEngine.ts`, mounted once in `VegaShell`, riding the existing
  quote poll with its previous-price map pruned to the armed set), and
  `simulate.ts` (the expectancy simulator — a seeded
  bootstrap Monte Carlo over the journal's own R-multiples: quantile fans,
  P(positive), drawdown-limit risk of ruin).
- **The Edge Engine (`lib/vega/engine.ts` → `/vega/engine`)** — the intraday
  sibling of alpha's regime engine and vega's most involved subsystem. Eight
  signal layers (trend structure, VWAP posture, momentum, volume pressure,
  range & levels, relative strength vs SPY, gap behavior, and a contrarian
  extension guard), each from 2–3 concrete signals over the focused symbol's
  5m bars + quote. Same house principles: bar-derived signals are ranked
  against their own trailing distribution (percentile → −1..+1, no fixed
  thresholds; scores at bar *i* use only bars ≤ *i*, so the session ribbon
  replays without lookahead), layer weights are earned from coverage ×
  internal agreement, missing data drops out rather than defaulting, and the
  aggregation constants (neutral deadband, agreement floor, driver cutoffs)
  are documented at their definitions. The page reuses the chart's existing
  bar fetch — the engine costs the provider nothing new.
- **Components** — vega-only UI lives in `components/vega/*`: the flagship
  `CandleChart.tsx` (candles + volume lane + overlays + levels + in-plot
  volume profile + crosshair readout; exports `CHART_PAD` so
  `IndicatorPane.tsx` aligns bar-for-bar beneath it), the engine console
  (`EngineDial.tsx` — the spring-needle conviction dial with confidence arc
  and idle-hum rings; `EnginePanels.tsx` — layer gauges, driver stacks, score
  ribbon), `ScanMap.tsx` (the scanner's gap × RVOL bubble map, spring-animated
  re-ranking), `SimFan.tsx` (the bootstrap quantile fan), `AlertPopover.tsx`
  (arm/manage price alerts from the chart), `SymbolSearch.tsx` (the debounced
  ticker/company typeahead over `/api/search` shared by the chart/engine
  headers and every watchlist add-form; Enter still resolves raw text as a
  literal symbol), `PositionsCard.tsx` (the live-marked working book, shared
  by cockpit and risk), `EquityCurve.tsx`,
  `PnlCalendar.tsx`, and `bits.tsx` (change/RVOL/range/score/tag chips).
  Shared primitives still come from `components/ui/*`; charts stay hand-built
  SVG. The chart page also owns **bar replay** (freeze the fetched tape, scrub
  bar-by-bar; levels/overlays recompute as-of the cursor's timestamp so
  nothing later in the session leaks back).

## Conventions

- **Path alias:** `@/*` maps to the repo root (e.g. `@/lib/store`).
- **Provider isolation:** never import `yahoo-finance2` or `@anthropic-ai/sdk`
  outside `lib/server/*`. Client code talks to them only through `/api/*`.
- **Client vs server:** files needing browser APIs / hooks start with
  `"use client"`. Route handlers and `lib/server/*` are server-only.
- **CSV import** (`lib/csv.ts`) is intentionally forgiving: any column order,
  `$`/`,`/`%` formatting, parenthesized negatives, quoted names, duplicate-lot
  merging, `totalReturn` auto-detected as $ or %. A `CASH`/`USD` row sets the
  cash position. Sample at `public/sample-portfolio.csv`. The quoted-field row
  splitter is shared with theta's importer via `lib/csvCore.ts`; each app keeps
  its own number parsing (alpha returns `NaN` and strips `%`, theta returns
  `null` and keeps it), since that contract genuinely differs.
- **Graceful degradation is a hard requirement**, not a nicety: with every
  external provider down, the app must stay usable on the imported book —
  allocation, weights, and P&L from imported prices. Analytics that need
  fundamentals degrade honestly to coverage gaps (no-data holdings are excluded,
  never imputed with fake betas). Preserve these paths when editing live/server
  code; never reintroduce a static per-ticker snapshot.
- **No chart libraries** — extend the SVG components in `components/charts/`.
- The AI brief uses Claude Haiku 4.5 (`claude-haiku-4-5`, `lib/server/brief.ts`)
  — the JSON schema does the heavy lifting, so the fastest/cheapest current model
  fits, with thinking disabled for cost control. theta's AI transaction
  categorizer (`lib/server/thetaCategorize.ts`) uses the same Haiku 4.5,
  thinking-disabled shape for the same reason (an enum-constrained category
  set). The dry-powder allocator (`lib/server/allocator.ts`), the Discover idea
  generator (`lib/server/discover.ts`), the Market Analysis read
  (`lib/server/marketBrief.ts`), and theta's Financial Health AI review
  (`lib/server/thetaReview.ts`) use Sonnet 4.6 (`claude-sonnet-4-6`) with
  adaptive thinking at `high` effort: allocation, idea generation, synthesizing
  the eight regime layers into one read, and weighing
  health/spending/subscription findings against each other are all genuine
  reasoning tasks, so they earn the deepest reasoning pass. The optimizer
  review (`lib/server/optimizer.ts`) uses Sonnet 4.6 (`claude-sonnet-4-6`) with
  adaptive thinking at `low` effort — the optimal weights are already solved, so
  the model only reasons about a grounded result, and `low` effort keeps it
  cheap. (It must be Sonnet, not Haiku: `output_config.effort` and adaptive
  thinking are rejected on Haiku 4.5 — see `lib/server/aiModels.test.ts`, which
  guards this.) Use the latest Claude models when adding AI features; pick the
  tier the task needs.
- Analytics are **models, not advice** — keep methodology copy honest and
  surfaced (the regime engine, scenarios, and Monte Carlo all expose their
  assumptions in the UI).

## Deployment

Zero-config for Vercel (Next.js preset auto-detected). Push to GitHub → import
at vercel.com/new, or `npx vercel`. Set `ANTHROPIC_API_KEY` as desired; to enable
accounts set `AUTH_SECRET` + `DATABASE_URL` (any Postgres database — Neon,
Supabase, Vercel Postgres), then run `npm run db:push` and `npm run create-user`
against that database.
