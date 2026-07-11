export type PatchNote = {
  version: string;
  date: string;
  title: string;
  changes: string[];
};

// Newest first. Add an entry here whenever a notable change ships.
export const PATCH_NOTES: PatchNote[] = [
  {
    version: "1.60",
    date: "2026-07-11",
    title: "vega — a day trading terminal joins the portal",
    changes: [
      "The portal is now three doors: alpha (portfolio analytics), theta (personal finance), and vega — a gold-accented day trading terminal at /vega, reachable from the lock screen, the app-title switcher, and the ⌘K palette.",
      "Chart terminal: intraday candlesticks (1m/5m/15m/daily, pre/post included) with session-anchored VWAP ±σ bands, EMA 9/20, Bollinger bands, an RSI/MACD pane, session boundaries, a crosshair OHLCV readout, and a live last-price tape line. Key levels draw themselves — prior-day high/low/close, floor-trader pivots, the opening range, premarket range — plus the day's volume profile with its point of control.",
      "Cockpit & scanner: one batched quote poll powers a market-internals tape (SPY/QQQ/IWM/DIA/VIX/10Y), watchlist breadth, and a momentum board that ranks gap, relative volume, range, and move-off-the-open as percentiles within the set you're watching — the regime engine's no-magic-thresholds principle, applied cross-sectionally.",
      "Journal & analytics: log entries, exits, stops and setups (or import a broker CSV; export any time), and the performance layer computes itself — a P&L calendar, equity curve with drawdown, win rate, profit factor, expectancy, R-multiple distribution, and per-setup / per-symbol / time-of-day breakdowns. A bundled sample journal (clearly badged) previews the machinery.",
      "Risk manager: position sizing off the stop with a scale-out R ladder, a daily-loss circuit breaker fed by the day's realized journal P&L, and a half-Kelly check derived from your actual win rate and payoff.",
      "Provider-friendly by construction: the whole watchlist quotes in one batched request per 30s poll, the chart is one call per minute for the focused symbol only, and every layer is cached server-side and at the CDN — no per-symbol fan-out anywhere.",
    ],
  },
  {
    version: "1.59",
    date: "2026-07-10",
    title: "Import CSVs into theta, a truthful refresh, and a hardening pass",
    changes: [
      "theta can now import transactions from a CSV. On the Import & Data page, upload an export from your bank or a spreadsheet — columns are matched by name, and rows are added to your ledger (existing transactions are never replaced, and exact duplicates are skipped). Uncategorized rows fall back to the keyword rules, and the AI pass can clean up the rest.",
      "\"Refresh live data\" now actually refreshes fundamentals, not just prices: a manual refresh punches through the fundamentals cache too, so margins, beta, and analyst figures update right after an earnings release instead of lagging up to 12 hours.",
      "Quality scoring got more honest. Metrics are now graded only over holdings whose underlying figure came from a live provider — a newly-listed name with no real data no longer contributes a fabricated neutral default to your composite; each metric carries its own live-coverage share.",
      "The live total return now preserves the income and realized-gain component your broker folded into the imported figure across a live reprice, rather than silently collapsing it to price-return-on-cost.",
      "Under the hood: tighter rate limits on the data endpoints, a bounded benchmark P/E derivation, several Monte Carlo / dividend-calendar / cash-flow-forecast edge-case fixes, and a round of memory-leak and accessibility cleanups.",
    ],
  },
  {
    version: "1.58",
    date: "2026-07-07",
    title: "A household view across all your portfolios",
    changes: [
      "If you keep more than one portfolio — an individual account, a Roth, a joint book — the portfolio switcher now has a \"Household\" option that blends them into one read: your total value across every book, how much each contributes, a combined allocation donut, and a merged holdings list where a name you hold in two accounts shows as a single line. It's honest about what's live: only your active portfolio is priced in real time, so the others are shown at their last-known values and labelled as such.",
    ],
  },
  {
    version: "1.57",
    date: "2026-07-07",
    title: "The command palette learns verbs",
    changes: [
      "The ⌘K command palette now does more than navigate — it takes commands. In alpha, type \"cash 5000\" to set your cash position on the spot. In theta, type \"spent 12.50 coffee\" to log an expense, or \"income 500 freelance\" to log a deposit — booked to your default account, which the palette shows you before you confirm. Amounts understand $, commas, and k/m shorthand (\"cash 2.5k\"). A hint in the empty state points the way.",
    ],
  },
  {
    version: "1.56",
    date: "2026-07-07",
    title: "Overview allocation map: a sector view",
    changes: [
      "The Overview allocation map (the treemap) now has a Holdings / Sector toggle. In Sector view, your positions regroup under faint sector containers — Technology, Energy, Consumer Staples, and so on, each labelled with its total — so you can see how your book concentrates by sector at a glance, then flip back to the flat per-holding view. Cells spring smoothly between the two layouts. Each holding files under its dominant sector (a fund by its largest look-through weight).",
    ],
  },
  {
    version: "1.55",
    date: "2026-07-07",
    title: "theta Net Worth, as a trajectory",
    changes: [
      "theta's Net Worth page now leads with a stacked area chart of your net worth over time, split into the three things it's actually made of — liquid cash, invested assets, and what you owe — so you see not just the number but its shape. The net-worth line rides on top, and milestone crossings (net worth turning positive, a new all-time high in the window) are flagged right on the chart. Hovering any month breaks it into the three bands. The total always matches the headline figure; for months before your transaction record begins, the mix is estimated from today's shape and labelled as such.",
    ],
  },
  {
    version: "1.54",
    date: "2026-07-07",
    title: "One table system: sortable, sticky, and dense-able lists",
    changes: [
      "The app's list tables now share one implementation instead of each page re-spelling its own. The Dividends per-holding table is sortable on every column (click a header — income, yield, growth, payout, streak — to re-rank), its header stays pinned to the top as you scroll a long book, and a comfortable/compact toggle in the card's corner lets you tighten the rows. Your density choice is remembered per app.",
      "theta's Transactions now groups by month with a sticky month band that shows that month's net as it scrolls past, sitting above the existing Today/Yesterday day labels — so a long ledger stays oriented — plus the same comfortable/compact density toggle.",
    ],
  },
  {
    version: "1.53",
    date: "2026-07-05",
    title: "Design-system pass: keyboard focus, first-paint skeletons, and a unified button/nav system",
    changes: [
      "Every interactive element — buttons, links, inputs, the sortable Overview table headers, the sidebar filter — now shows a visible keyboard-focus ring, and every Framer-driven animation (the looping hero glows included) now honors your OS's \"reduce motion\" setting app-wide.",
      "Pages no longer flash blank while your portfolio or ledger loads from storage; a matching skeleton placeholder holds the layout instead. Add/Edit modals now trap focus while open and hand it back to whatever you triggered them from when they close.",
      "alpha's and theta's sidebars share one nav implementation (so the two can't drift from each other going forward), the resize handle between sidebar and content now works from the keyboard (arrow keys, Home to reset) and double-click, and a live-updated holding row briefly flashes to mark a repriced value instead of swapping silently.",
      "Cleaned up drift accumulated across the app: one button system app-wide (folding in a few one-off pill buttons), a shared empty-state and progress-bar component instead of near-duplicates in alpha and theta, amber reserved for things that need your attention rather than routine data-provenance notes, and the last of the sub-10px metadata text bumped up to stay legible.",
    ],
  },
  {
    version: "1.52",
    date: "2026-07-05",
    title: "Multi-asset honesty, budget rollover, a cash-flow Sankey, and portfolio risk in theta",
    changes: [
      "alpha now recognizes what each holding actually is. Bond funds, commodity/gold ETFs, crypto, and money-market/cash funds are classified from the provider (Yahoo quote type + fund category) and no longer treated as if they were stocks: the correlation model clusters each class with its own kind — bonds move with bonds, crypto with crypto — and cross-asset co-movement flows only through market beta, so a bond ETF lands near-zero (or negative) correlation to your equities instead of inheriting the tech names it happens to share the \"Fund / ETF\" bucket with. Names the provider gives no beta/vol for now fall back to a class-appropriate profile rather than a β-1 stock. The Risk page carries a new asset-allocation breakdown across equity / fixed income / commodity / crypto / cash.",
      "theta budgets can now roll over. Flip a budget to envelope mode and each month's unspent (or overspent) amount carries forward — the effective limit is your base limit plus the accumulated balance, derived straight from your transaction history rather than stored, so it always reflects what really happened. A carryover chip shows what rolled in, and \"remaining\" accounts for it.",
      "theta's Cash Flow page opens with a Sankey diagram: the latest active month's income sources flow through an Income hub out to each spending category and what's left over as Saved — a conserved, animated, hand-built SVG (a shortfall month is drawn as money pulled from savings so the ribbons still balance).",
      "The alpha↔theta bridge goes deeper. When a theta account mirrors your live alpha portfolio, the Net Worth page now reads that portfolio's real beta and volatility to show how a market drawdown (correction / bear / crash) would hit your net worth in dollars and percent — and reassures you that your liquid runway, measured in months of spending, doesn't move with the market.",
    ],
  },
  {
    version: "1.51",
    date: "2026-07-04",
    title: "An AI strategist on Market Analysis",
    changes: [
      "The Market Analysis page can now generate a Claude-written read of the tape. It reasons across the composite regime score, the eight analytical layers, and the contribution-ranked drivers, then returns a synthesis: a headline, what's moving it, what a risk-on/off posture implies, what to watch, and the single strongest counter-signal. Reasoned with Sonnet 4.6 at high effort, cached one read per day per regime shape; the regime numbers themselves are still computed locally and work with the AI off.",
    ],
  },
  {
    version: "1.50",
    date: "2026-07-04",
    title: "A unique AI loading animation, and a richer theta dashboard",
    changes: [
      "Every Claude-backed generation — the alpha daily brief, the dry-powder allocator, the optimizer review, Discover's idea generator, the new Market Analysis read, and theta's money brief and Financial Health review — now fills its whole block with a hand-built \"neural field\" while it thinks: a dark, black-and-white constellation of drifting nodes wired by distance-faded links, with pulses of light flowing across the network. It sits on the same near-black as the rest of the app and replaces the plain spinners, so the wait reads as one deliberate thing across both apps. (The zero-cost transaction categorizer, which runs inline, is deliberately left alone.)",
      "theta's Dashboard got a visual overhaul. The net-worth hero now carries an inline trend chart of your net worth over the trailing months, a softly animated aurora glow, and a clearer up/down delta chip — a much richer snapshot than the flat number it was before.",
    ],
  },
  {
    version: "1.49",
    date: "2026-07-04",
    title: "Discover: a toggle to include or exclude ETFs from AI ideas",
    changes: [
      "The Discover page now has a \"Suggest ETFs\" switch above the research lenses. On (the default) lets Claude propose ETFs alongside individual stocks, same as before; off restricts every idea to individual stocks only. The choice is part of the request, so it's cached separately per mode and portfolio shape.",
    ],
  },
  {
    version: "1.48",
    date: "2026-07-04",
    title: "theta: a corrected account type now survives bank re-sync",
    changes: [
      "Fixed a bug in yesterday's editable account type: correcting a mistyped account (e.g. a checking account the bank-sync heuristic guessed was a brokerage) didn't stick — the next sync silently reverted it, since SimpleFIN carries no account-type field and the guess is re-derived on every pull. The ledger's existing type now always wins on re-sync, the same way a manually-corrected transaction category already did.",
    ],
  },
  {
    version: "1.47",
    date: "2026-07-04",
    title: "theta: sync respects deleted accounts, editable account type, dismissible subscriptions",
    changes: [
      "Deleting a SimpleFIN-synced account now sticks: re-syncing your bank no longer re-adds an account you removed on the Accounts page (or its transactions). A \"Restore on next sync\" link on the bank-sync card undoes this if you want the account back.",
      "Bank sync now refreshes automatically about once a day while theta is open, instead of only on a manual \"Sync now\" — no server-side scheduler needed, so it's a stale-check on load/focus rather than a true background job, but the balances and transactions you see should now stay current on their own.",
      "Fixed a bug where a manually-corrected transaction category (e.g. tagging \"ATM Fee\", which no keyword rule can place) would silently revert back to \"Other\" the next time the account synced. The ledger's own category now wins over the server's re-derived guess on every sync.",
      "Every account now has an editable \"Account type\" in its settings (Accounts page) — checking, savings, brokerage, retirement, credit, or loan. This matters beyond labeling: it drives the liquid-vs-invested split behind net worth, the projection, and the Financial Health scorecard's emergency-runway and liquidity metrics. The bank-sync heuristic can mistype an account (e.g. a checking account it guesses is a brokerage), which silently zeroed those two metrics; this makes it a one-click fix.",
      "The Recurring page's auto-detected subscriptions can now be dismissed (the × on hover) when a repeating charge isn't actually a subscription — it stops being suggested, with a \"Restore N dismissed\" link to bring them back.",
    ],
  },
  {
    version: "1.46",
    date: "2026-07-04",
    title: "theta: excluded accounts no longer feed the auto-tagger + AI categorizer batching fix",
    changes: [
      "The transaction auto-tagger now respects account exclusion. If you've excluded an account (e.g. a brokerage), its transactions — buys and sells that don't belong to any spending category — are kept out of the \"needs a category\" banner and the auto-tag review, on both the Transactions and Import pages. This also means the AI categorizer is only ever asked about real spend, instead of being handed brokerage trades it can only file as \"Other\".",
      "The learned-history layer of the auto-tagger likewise learns only from visible activity, so hidden-account trades never influence a suggestion.",
      "Fixed the AI categorizer erroring on larger batches: a big set of merchants overran the model's output limit, truncated the JSON mid-response, and failed the whole request. It now processes merchants in bounded chunks, so large imports categorize reliably and one bad chunk degrades to a partial result instead of an error.",
    ],
  },
  {
    version: "1.45",
    date: "2026-07-04",
    title: "theta accounts: exclude an account's transactions in one toggle",
    changes: [
      "Every account now has an \"Exclude from transactions\" switch (in its settings gear on the Accounts page). Flip it on a brokerage or retirement account and its buys and sells stop showing up in the transactions log — and stop counting toward your spending, budgets, and cash flow — while the account's balance stays in net worth. It applies to future synced activity too, and excluded accounts show an \"Excluded\" badge.",
      "This surfaces the existing per-account transaction filter (previously only reachable from the Transactions page's Filter popover) as a persistent, discoverable account setting, so noisy investment activity is easy to keep out of your everyday money view.",
    ],
  },
  {
    version: "1.44",
    date: "2026-07-04",
    title: "theta transactions: a redesigned tab with advanced auto-tagging",
    changes: [
      "The Transactions tab now groups charges into dated sections (Today / Yesterday / weekday) with each day's net, adds a Money-in / Money-out / Net summary, and gives every category a proper tinted pill — a cleaner read of where your money went.",
      "New advanced auto-tagger, front and center: a banner shows how many merchants are still in \"Other\" and opens a review sheet with a suggested category for each. Suggestions are ranked by a local, zero-cost engine that layers your own tagging history over theta's (now much larger) keyword table, so the tool learns your patterns and gets smarter the more you use it — every suggestion shows where it came from and how confident it is.",
      "The auto-tagger learns from you: once you've tagged a merchant, every future charge from it is suggested the same way (majority-wins when you've been inconsistent), and applying a batch also re-tags matching charges going forward. An optional one-click \"Improve with AI\" pass (Claude Haiku 4.5) places whatever the local rules couldn't. Nothing is written until you review and press Apply.",
    ],
  },
  {
    version: "1.43",
    date: "2026-07-03",
    title: "theta grows up: projections, financial health, debt payoff, and smarter money analytics",
    changes: [
      "theta now derives its cash-flow and net-worth history from your actual transactions instead of storing a static series — flows bucket by calendar month and past net worth is reconstructed by reverse-walking each account's balance, so the charts self-correct when you import older data and internal transfers no longer create phantom swings. Your existing ledger is migrated automatically.",
      "New Net-Worth Projection page: a Monte Carlo of your whole balance sheet — invested assets grow with market risk, cash compounds at its yield, and your monthly savings ride on top — with 5-to-30-year horizons, an optional target and its probability, and a today's-dollars (inflation-adjusted) median. Deterministic per balance sheet, like alpha's simulator.",
      "New Financial Health scorecard: a weighted 0–100 grade across emergency runway, savings rate, debt-to-income, credit utilization, liquidity and housing burden — each scored against a published reference band, not a made-up threshold, with coverage-reweighting when a metric lacks data. Includes an optional Claude (Sonnet 4.6) review that reasons across the findings and ranks what to do first.",
      "New Debt Payoff planner: amortizes your liabilities under avalanche or snowball, dates the payoff, totals the interest, and shows exactly what an extra $X/month buys you in time and interest saved.",
      "Goals now come with a feasibility read: the pace you need, the date the current pace projects to, the contribution required to hit your target date, an on-track / behind / at-risk status, and a Monte-Carlo probability of success.",
      "Recurring page auto-detects subscriptions from your transactions — steady, repeating charges you're not yet tracking — and flags price creep (the bill that quietly climbed). Track one in a click.",
      "Spending analytics now rank each category against its own trailing history (percentiles, not fixed dollar thresholds), surfacing what's genuinely running hot for you rather than what's simply large.",
      "Editable planning assumptions (invested return, volatility, cash yield, inflation, income growth, default APRs) with base / optimistic / conservative presets, in Settings — the forward inputs behind the projection, goals and debt engines.",
      "alpha↔theta bridge: link a theta brokerage or retirement account to one of your alpha portfolios and its balance tracks that portfolio's live market value instead of a number you maintain by hand. Accounts also gained editable APRs (for the debt planner) and credit limits (for the utilization score).",
      "Import & Data is now bank-first: SimpleFIN sync is the primary way to bring in accounts and transactions, with a one-pass AI auto-categorizer (Haiku 4.5) to clean up anything the keyword rules left in \"Other\".",
    ],
  },
  {
    version: "1.42",
    date: "2026-07-03",
    title: "CSV import now always replaces the active portfolio",
    changes: [
      "Importing a CSV while a portfolio is selected now replaces that portfolio's holdings directly, rather than offering a choice between replacing it and creating a new one. To start a separate portfolio (a second brokerage account, a Roth IRA, …), press \"New\" in the Your portfolios panel first, then import into it.",
      "Replacing a portfolio that already has holdings now asks for confirmation before overwriting; importing into an empty or freshly-created portfolio skips the prompt since there's nothing to lose.",
    ],
  },
  {
    version: "1.41",
    date: "2026-07-03",
    title: "Track multiple portfolios — individual, Roth IRA, and more",
    changes: [
      "alpha now holds more than one portfolio at a time. Keep your individual brokerage account and your Roth IRA (or any split you like) as separate books and switch between them from the new picker in the sidebar — each has its own holdings, cash, and every downstream analytic. Your data stays per-user and per-browser exactly as before; nothing is shared or uploaded.",
      "CSV import is unchanged and now targets the portfolio you choose: replace the active one, or import straight into a brand-new portfolio (name it on the spot). The Import & Data page gained a portfolios panel to create, rename, switch, and delete them.",
      "Your existing portfolio is migrated automatically into the new multi-portfolio format on first load — it simply becomes your first named portfolio, and signed-in accounts keep saving server-side as one blob (no schema change).",
    ],
  },
  {
    version: "1.40",
    date: "2026-07-02",
    title: "Full-codebase review: 20 fixes across math, data, sync, and security",
    changes: [
      "Live prices can no longer be blacked out by one dead ticker. A delisted symbol used to make the whole quote batch fail — on a cold start that meant no live prices at all, every poll, forever. The fetcher now isolates the bad symbol, prices everything else individually, and backs the dead one off so the book heals.",
      "Quality grades are now correct under the Recession preset. Scoring was ratio-based, which inverts ordering against a negative benchmark — beating a −10% index EPS-growth assumption scored *worse* than missing it. Scores now use signed distance, PEG goes neutral when the growth benchmark makes it meaningless, and a new Debt/Equity metric grades balance-sheet resilience (financials excluded, unknown scores neutral — never fabricated). Dividend safety also now penalizes heavy leverage, and ROIC correctly excludes idle cash from invested capital.",
      "The optimizer's expected returns are no longer a beta sort. When every holding has a market cap, returns are Black–Litterman equilibrium returns — reverse-optimized from cap weights against the same covariance the risk pages use — so μ and Σ agree by construction (CAPM fallback otherwise). Hold-floors are now solved *under* as real constraints rather than projected onto afterwards, risk parity respects the position cap inside its iteration, and the whole solve + frontier runs in a Web Worker so constraint sliders stay smooth.",
      "Monte Carlo now reports tail risk properly: CVaR 95 (the average of the worst 5% of outcomes, not just where they start) and the median / 1-in-10 maximum drawdown a path suffers on the way — the number that tells you what you'd have to sit through.",
      "Two devices signed into the same account can no longer silently overwrite each other. Saves are revision-checked (compare-and-swap): a save that lost the race is rejected, and a banner explains what happened instead of the console quietly eating it. Failed saves surface in the same banner.",
      "Security hardening: bank-sync credentials are now encrypted at rest (AES-256-GCM) so a leaked database backup exposes nothing; unknown-username logins burn the same bcrypt time as wrong-password ones (no timing-based user enumeration); and the history / forced-refresh endpoints are rate-limited like search and the AI routes.",
      "Recurring charges anchored on the 29th–31st no longer drift: advancing a Jan 31 monthly charge now lands Feb 28, not Mar 3.",
      "The geographic-exposure card is gone. No revenue-by-region source exists without API keys, so it could never render real data — an honest empty state, but dead weight. It can return when a real source does.",
      "One-way turnover is now the single convention across Rebalance and the Optimizer (they previously disagreed by 2×).",
      "New end-to-end smoke suite boots the production build and walks every page with a seeded portfolio — with live providers unreachable — so the graceful-degradation promise is now tested, not just intended.",
    ],
  },
  {
    version: "1.39",
    date: "2026-07-02",
    title: "Modeled numbers now show their uncertainty instead of false precision",
    changes: [
      "Monte Carlo no longer pretends the expected return is known. The CAPM drift — the least certain input — is now drawn per simulated path (SE ≈ σ/√10) so the fan reflects that uncertainty, and shocks are Student-t (fat-tailed) rather than Gaussian, so the downside carries the heavy left tail real equity returns have. The target probability widens honestly as a result; read it to the nearest few points, not the decimal.",
      "Expected return and Sharpe on the Risk page now show a band across a plausible 3–6% equity-risk-premium range, with a pointer to edit the ERP assumption on the Benchmark page — the headline is the midpoint of a range, not a forecast.",
      "Scenario rate shocks now use each holding's empirical rate beta (its returns regressed on actual rate moves) where enough price history is available, falling back to the previous duration heuristic otherwise. Scenario outputs are labeled as first-order, instantaneous estimates.",
      "The Benchmark factor radar is relabeled a 'style tilt' — a 0–100 cross-sectional score of your holdings' fundamentals versus the market (~50), which is what it always was, rather than a returns-based factor loading.",
      "Added a consistent 'modeled' marker across these figures (the counterpart to the existing live/estimated data dot), so a model-based number is never presented as if it were measured.",
    ],
  },
  {
    version: "1.38",
    date: "2026-07-01",
    title: "Correlations now learn from realized returns, not just sector labels",
    changes: [
      "Until now, how two holdings co-move was inferred purely from structure — their betas plus fixed sector/industry/fund affinities — so any two tech names got the same assumed correlation regardless of how they've actually traded. The risk stack now pulls ~1y of daily price history per holding and blends the realized sample covariance with that structural model using Ledoit–Wolf shrinkage: the data speaks where there's enough of it, and the structural estimate anchors the rest. Two names that genuinely move together (or apart) are now measured, not assumed.",
      "This flows through every page that reads the covariance — Risk (beta, volatility, diversification ratio, risk contributions), Correlation, the Optimizer, and Scenarios. It stays honest by design: the structural model is always the shrink target, so the covariance remains positive-definite; and if any holding lacks sufficient history, or a provider is down, the whole matrix falls back to the structural estimate exactly as before — no half-measured mixes, no fabricated data.",
    ],
  },
  {
    version: "1.37",
    date: "2026-06-30",
    title: "Reject implausible beta/volatility readings before they corrupt risk math",
    changes: [
      "A thinly-traded, newly-listed holding can occasionally come back from the live provider with a statistically unstable beta or volatility — a regression blow-up, or realized vol off a handful of wild early prints, producing a value like β -31 that no real security has. Left unchecked, one such holding could single-handedly distort the entire portfolio: beta, volatility, correlation, diversification ratio, and risk contributions all share the same covariance math, so one bad number poisoned all of them, not just its own row. Implausible readings (|β| > 5, volatility > 300% annualized) are now rejected at the data layer and treated as a normal coverage gap — falls back to the neutral default and shows \"Estimated\" — before they ever reach the risk math.",
    ],
  },
  {
    version: "1.36",
    date: "2026-06-30",
    title: "Surface the actual estimated number instead of hiding it",
    changes: [
      "Research now labels every metric — not just FCF growth and ROIC — as \"est\" when it's a model fallback rather than a live read, including Beta and a newly-added Volatility row that wasn't shown at all before. A ticker with a live price but a completely empty fundamentals fetch (rare, but happens for thin coverage) now shows a full estimated profile clearly marked \"Live price · estimated fundamentals\" instead of a dead-end \"no data\" page.",
      "The Risk page's coverage banner now states the actual model default (β 1.0, ~28% volatility) that a no-data holding would carry if it were estimated, for reference — it's still excluded from the math exactly as before, this just makes clear what the number would be.",
      "Fixed the Risk page's coverage banner firing on cash alone: holding any uninvested cash always pushed the headline coverage percentage below 100%, even with zero actual data gaps, so the banner claimed holdings were excluded when none were. It now only appears when a holding genuinely has no live fundamentals.",
    ],
  },
  {
    version: "1.35",
    date: "2026-06-30",
    title: "Fixed portfolio beta/volatility being diluted by no-data holdings",
    changes: [
      "Portfolio beta, volatility, expected return and Sharpe were silently understated whenever a holding had no live fundamentals: the no-data holding's weight dropped out of the math entirely instead of being excluded, which is mathematically identical to treating it as riskless cash. A 50% position with no data could cut your reported beta roughly in half. These figures are now renormalized over the priced portion of the book (cash + holdings with live data), with the excluded weight still reported honestly via the existing coverage gap.",
      "This affected every page that reads portfolio beta/volatility/expected return — Overview, Risk, Correlation, Monte Carlo, Benchmark, Discover and the printable Report.",
    ],
  },
  {
    version: "1.34",
    date: "2026-06-30",
    title: "Live-only data — the static fundamentals snapshot is gone",
    changes: [
      "Every fundamental you see is now live. The bundled ~90-ticker snapshot that used to backfill missing fields has been removed entirely: sector, beta, margins, growth, ROIC, analyst targets, insider flows, earnings dates and ETF sector look-through all come from the provider, with realized volatility derived from price history. No more frozen values quietly standing in for live data.",
      "Holdings the provider has no data for are now handled honestly. Instead of being imputed with a placeholder beta and volatility, a no-data holding is excluded from the risk, correlation, quality, factor and scenario math and shown as a coverage gap — your allocation and P&L still work from the imported book, but the analytics never pretend to know a number they don't.",
      "Benchmark valuation is live too: the S&P 500 and NASDAQ-100 P/E, dividend yield, FCF yield and sector weights are now pulled from the SPY/QQQ proxies, alongside the already-live risk-free rate and index volatility.",
      "The handful of inputs with no live market quote — the equity risk premium, the S&P dividend-growth anchor, and the index profitability & growth aggregates (no keyless source exists for index-level margins/ROIC/growth) — are now explicit, editable assumptions on the Benchmark page. Snap to a reference preset (Market today / 10-year average / Recession) or fine-tune each with a slider; every analytics page reflects your choice. They're transparent assumptions now, not constants hidden in the code.",
    ],
  },
  {
    version: "1.33",
    date: "2026-06-28",
    title: "theta — accurate income/spending, category filters, and bulk re-tagging",
    changes: [
      "Fixed inflated income and spending. Transfers between your own accounts are no longer counted as income (only the spending leg was being excluded before, so the receiving leg quietly inflated income), and the activity filters now drive the headline math — so hiding a noisy brokerage account stops its buys and sells from being counted as income and spending. Your net worth still reflects every account's balance; only the transaction-derived figures honor the filter.",
      "Filter by category, not just by account. The Transactions filter now has a Categories section alongside Accounts — hide a whole category (and account) from the lists, the dashboard's recent activity, and the income/spending/budget math in one place.",
      "Re-tagging is now bulk by default: change one transaction's category and every other transaction from the same merchant is re-tagged to match, so fixing one auto-categorized charge fixes the whole group. Combined with category filters, that means you can re-tag a merchant and immediately filter the lot.",
    ],
  },
  {
    version: "1.32",
    date: "2026-06-28",
    title: "theta — sharper Intelligence, account logos, and more control over your activity",
    changes: [
      "The theta Intelligence brief is now on-demand and smarter: it waits for you to press Generate instead of running on every visit, and it's written by Claude Sonnet 4.6 with adaptive thinking at high effort — so it reasons through your month's flows, budget pacing and goal tradeoffs before committing to wins, watch-outs and moves. Your headline numbers are still computed locally and shown instantly.",
      "Accounts now show their institution's brand logo (fetched by domain, with a clean monogram fallback when there's no match) — synced banks carry their own domain, and common institutions are recognized by name.",
      "Filter noisy accounts out of your activity: a new account filter on the Transactions page lets you hide accounts (handy for chatty brokerage churn) from the transaction list, and the same filter is reflected in the dashboard's recent-activity table.",
      "Re-tag transactions inline: click any transaction's category to change it — useful for correcting an auto-categorized import.",
      "Add recurring charges by hand: the Recurring page now has an Add button for logging a subscription or bill with its amount, cadence, category and next charge date.",
    ],
  },
  {
    version: "1.31",
    date: "2026-06-28",
    title: "theta — connect a bank with SimpleFIN",
    changes: [
      "theta can now sync balances and transactions automatically through SimpleFIN — a read-only bank-aggregation bridge that works with Robinhood and most US banks. Connect your bank at bridge.simplefin.org, paste the setup token into Import & Data, and theta pulls your accounts and transactions on demand. No more wrestling a CSV out of a bank that won't export one.",
      "Private by design: the link is claimed and stored server-side against your account (it requires accounts to be enabled), so the credential never touches the browser — only the resulting accounts and transactions come back. Re-syncing is incremental and de-duplicated by a stable id, so pending charges settle in place and your manual edits and manually-added accounts are always preserved.",
      "Synced transactions are auto-categorized from the merchant name (with an honest 'Other' fallback you can correct by hand). The same categorizer now also fills the category for any CSV import that doesn't carry one.",
    ],
  },
  {
    version: "1.30",
    date: "2026-06-27",
    title: "Rebrand: delta is now theta",
    changes: [
      "Renamed the sister personal-finance app from delta to theta — new wordmark (θ), new favicon, new /theta routes, and a new dictionary-style definition on the lock screen ('a measure of time's impact on value'). The portal is now α | θ.",
      "Lock screen: each terminal's part-of-speech label and definition are now left-aligned under the name instead of centered.",
    ],
  },
  {
    version: "1.29",
    date: "2026-06-27",
    title: "Accounts — sign in, and your data follows you",
    changes: [
      "alpha and theta now support real accounts. When a database is configured, the portal takes a username and password instead of a PIN, and each person gets their own saved portfolio and theta ledger stored server-side — so your data follows you across devices instead of living in a single browser. Sign-in is themed to whichever terminal you pick, with the same unlock choreography, and the signed-in name shows in the sidebar.",
      "Your data stays private. Holdings and ledgers are stored as a per-user blob in your own Postgres database and are never sent anywhere else; signing in reads only the server, so two people sharing one computer never see each other's data. There's no public sign-up — logins are provisioned by hand.",
      "Entirely optional and backward-compatible: with no database configured, both apps run exactly as before — open, single-user, in the browser's localStorage — so nothing breaks and local dev never locks you out. (This replaces the old 4-digit PIN gate.)",
    ],
  },
  {
    version: "1.28",
    date: "2026-06-27",
    title: "theta goes live — your own editable ledger + an AI money brief",
    changes: [
      "theta is no longer a static demo. Your ledger — accounts, transactions, budgets, goals and recurring charges — now persists in the browser's localStorage, exactly like alpha's portfolio. Every figure (net worth, spending mix, budget pacing, cash flow, savings rate) is derived live from that ledger, so a single edit ripples across every page at once.",
      "Full editing throughout: add and delete transactions, set and add budget limits, create goals and contribute to them, mark recurring charges paid (which logs the transaction and rolls the next date), and edit or remove account balances. A forgiving CSV importer (any column order, $/comma/parenthesized-negative aware) on a new Import & Data page brings in your own transactions; Load sample and Clear are one click away.",
      "New theta Intelligence tab: a Claude-written monthly money brief (Haiku 4.5) — headline, wins, watch-outs and grounded suggested moves — generated from a snapshot of your ledger and cached one per day per shape, with the estimated cost shown. Degrades gracefully to a locally-computed glance when ANTHROPIC_API_KEY is unset.",
    ],
  },
  {
    version: "1.27",
    date: "2026-06-27",
    title: "theta — a sister personal-finance terminal, and a portal to both",
    changes: [
      "The lock screen is now a portal: α | θ. alpha (portfolio analytics) and theta (personal finance) share one door and one PIN — pick a side with a fluid, animated chooser, then enter the code (or walk straight in when no PIN is set). The unlock choreography tints to whichever terminal you chose.",
      "Introduced theta, a new personal-finance app that shares alpha's dark, institutional aesthetic and its own shell, nav and iris accent. Tabs: Dashboard, Net Worth, Accounts, Transactions, Cash Flow, Budgets, Goals, Recurring and Settings — net worth, balances, spending mix, budget pacing and savings goals, all hand-built in the same SVG/Framer style.",
      "An always-available α ⇄ θ switcher in both sidebars (and the mobile bars) lets you hop between the two terminals at any time. theta currently runs on illustrative sample data — clearly labelled — with no real accounts connected.",
    ],
  },
  {
    version: "1.26",
    date: "2026-06-26",
    title: "Live benchmark volatility & a self-refreshing snapshot",
    changes: [
      "Benchmark volatility is now live: the S&P 500 and NASDAQ-100 figures used on the Risk, Benchmark and Report pages are computed from trailing-1y realized returns (^GSPC / ^NDX) instead of a static number, falling back to the bundled value when the feed is down.",
      "Honest about the one input that can't be live: the equity risk premium has no observable market quote, so it stays a fixed forward-looking assumption — now said plainly in the expected-return explainer, next to the note that the risk-free rate and market volatility are fetched live.",
      "The bundled fundamentals snapshot — the offline backstop — no longer drifts silently: a scheduled monthly job re-pulls live fundamentals for every covered name and opens a pull request with only the values that moved (curated names, sectors and ETF look-through are left alone), so the fallback stays current and every change is reviewed.",
    ],
  },
  {
    version: "1.25",
    date: "2026-06-26",
    title: "Data provenance — live vs snapshot, made visible",
    changes: [
      "Every holding now carries a data-source read-out. As live quotes and fundamentals merge over the bundled snapshot, the app records — field by field — whether each value is live or a snapshot fallback, then rolls that up per holding to Live, Partial, or Snapshot.",
      "Surfaced in the UI so a frozen value is never silently shown as if it were live: a provenance dot next to every symbol on Overview (hover to see which risk-critical fields fell back to the snapshot), a portfolio-wide coverage summary on the holdings table, and a more honest badge on Research — a partial merge no longer reads as fully 'Live'.",
      "Foundation for an opt-in live-only mode (coming next) that will render an explicit 'unavailable' state instead of any stale value.",
    ],
  },
  {
    version: "1.24",
    date: "2026-06-26",
    title: "Live capital-market assumptions",
    changes: [
      "Risk-free rate and market volatility — inputs to expected return, Sharpe, and the optimizer's CAPM math — are now fetched live (13-week T-bill yield and realized S&P 500 volatility) instead of a hand-set constant, refreshed every 6h. Equity risk premium has no observable market quote and stays a static assumption.",
      "Falls back to the static snapshot in lib/data/benchmarks.ts if the live fetch fails, so risk/optimizer math never breaks when the provider is unavailable.",
    ],
  },
  {
    version: "1.23",
    date: "2026-06-24",
    title: "Discover — AI stock ideas",
    changes: [
      "New Discover tab (under Portfolio): AI-generated stock ideas tailored to your book. Six preset research lenses — Diversify, High Growth, Value & Income, Defensive Hedge, Quality Moats, Megatrends — each runs a distinct brief against your holdings.",
      "Claude reads your portfolio (weights, sectors, valuation, quality, and book-level risk/return metrics), then proposes new names you don't own: a standalone thesis, a 'fits your book' rationale tying it to your gaps, a few approximate metrics, and the key risk — highest conviction first. Each idea is grounded with a live price and a deep-link into Research.",
      "Runs on Claude Opus 4.8 with adaptive thinking (selecting securities for a specific book is a genuine reasoning task), with the estimated cost shown like the other AI outputs. Cached once per day per lens + portfolio shape; degrades gracefully when ANTHROPIC_API_KEY is unset.",
    ],
  },
  {
    version: "1.22",
    date: "2026-06-24",
    title: "Live fundamentals — volatility, ROIC, FCF growth, region mix",
    changes: [
      "The fields that used to come only from the hand-maintained snapshot are now pulled live. Realized volatility is computed from Yahoo price history; ROIC and FCF growth are derived from Yahoo's statement modules; all three overlay the snapshot field-by-field where available.",
      "Optional Financial Modeling Prep integration: set FMP_API_KEY and ROIC, FCF growth and a real revenue-by-region mix are sourced from FMP — the fields Yahoo's keyless feed can't cleanly provide. With no key, the app runs on Yahoo alone, unchanged. Kept to three calls per symbol and 12h-cached to respect the free tier.",
      "Groundwork for retiring the static snapshot: fundamentals now flow through a Yahoo + FMP orchestrator (lib/server/fundamentals.ts), with the snapshot demoted to a pure offline backstop.",
    ],
  },
  {
    version: "1.21",
    date: "2026-06-24",
    title: "Analytics audit — math fixes",
    changes: [
      "Monte Carlo: the median return shown under the fan (\"CAGR on money in\") is now a true money-weighted return (IRR). It previously divided the median outcome by every contributed dollar as if all of it had been invested on day one, which understated the rate for plans with monthly contributions; it now grows the actual contribution schedule into the median terminal, so the figure reads higher and is methodologically correct.",
      "Dividends: a year's per-share rate now uses a true median of that year's payments (averaging the two middle payments in an even quarter count) instead of picking the upper-middle one — removing a small upward bias in year-over-year growth and CAGR for some payers.",
      "Internal cleanup: de-duplicated shared math helpers and tightened a couple of module boundaries. No behavior change beyond the two items above.",
    ],
  },
  {
    version: "1.20",
    date: "2026-06-23",
    title: "Holdings news tagging fix",
    changes: [
      "The holdings news feed now tags each story with the holding it's genuinely about. Previously the ticker shown (and the filter chip a story fell under) was just whichever holding's search returned it first — so a market-wide story like \"Alphabet joins the Dow\" could surface under AAPL and stay mislabeled. Tags are now driven by Yahoo's own related-tickers (a confirmed ticker wins, then any other holding the story names), falling back to the search bucket only when there's no better signal.",
      "Incidental noise is filtered out: when Yahoo says a story is about other companies and none of them are in your book, it's no longer shown just because it mentioned a holding in passing.",
    ],
  },
  {
    version: "1.19",
    date: "2026-06-23",
    title: "Unlock transition",
    changes: [
      "Entering the correct PIN now plays a single continuous animation into the terminal: the PIN field collapses inward and the title recedes, the α sigil swells under a soft white glow while two light rings ripple outward, the lock screen washes to black, and the app fades back out of that same black — so the two screens read as one slow, deliberate motion instead of a hard page swap.",
      "The hand-off across the reload is now seamless and smooth: a render-blocking overlay covers the very first painted frame of the app (no flashes), and every step animates only GPU-composited transform/opacity, so it stays at full frame rate.",
    ],
  },
  {
    version: "1.18",
    date: "2026-06-23",
    title: "Rebrand to alpha",
    changes: ["Renamed the project from grieve to alpha across the app, storage keys, and the auth cookie."],
  },
  {
    version: "1.17",
    date: "2026-06-23",
    title: "Hover explainers & cross-tab polish",
    changes: [
      "Added hover-reveal explanation boxes throughout the terminal — rest the pointer on a metric (beta, volatility, Sharpe, expected return, diversification ratio, HHI, effective N, average pairwise ρ, regime confidence/health/direction/age, and the analytical layers' weight/agreement/stability) to read what it actually measures.",
      "Overview: centered the holdings table column headers over their columns.",
      "Intelligence: the daily brief now generates on a button instead of on page load, the earnings calendar has a legend for the weight bar, the holdings news feed dedupes and counts per ticker, and the brief shows its estimated AI cost.",
      "Optimizer: default position cap is now 10%, a new guardrail lets you allow full exits (off by default, with a minimum-position floor when off), the efficient-frontier chart fills its column, bought slices in the allocation bars glow, and the AI review reports its estimated cost.",
      "Market Analysis: the Direction and Regime-age tiles read more clearly at the same size.",
      "Quality: per-holding drill-down cards now show a book-relative grade and a strongest/softest category read alongside the bars.",
      "Dividends: the explainability panel is collapsible and starts collapsed.",
      "Rebalance: target-mix inputs are wider and step in 0.1% increments.",
      "Scenarios: the custom stock-move slider now defaults to 0%, and the empty results panel matches the controls' height.",
      "Monte Carlo: the target can now reach 100× today, hovering a terminal-distribution bar shows how many outcomes landed there, and a Refresh simulation button redraws a fresh set of paths.",
    ],
  },
  {
    version: "1.16",
    date: "2026-06-23",
    title: "AI Optimizer",
    changes: [
      "Added an Optimizer tab under Analysis: an institutional portfolio-construction tool that solves for optimal weights on your holdings against the terminal's factor risk model.",
      "Eight objective presets — maximum Sharpe, minimum volatility, risk parity, max diversification, maximum return, income, quality tilt, and equal weight — with position-cap and drop-threshold guardrails.",
      "Plots the efficient frontier with your current and optimized portfolios, shows the before → after risk/return metrics, and generates a rebalance order ticket.",
      "Claude Sonnet 4.6 reviews each optimization and writes the construction desk note: the thesis, the tradeoffs you take on, the residual risk, and a calibrated verdict.",
    ],
  },
  {
    version: "1.15",
    date: "2026-06-22",
    title: "Risk-weighted average correlation",
    changes: [
      "The Correlation page and Export Report now headline a risk-weighted average pairwise correlation — each pair weighted by its contribution to portfolio variance — so two large, volatile holdings moving together count for more than two tiny tail positions. It tracks the diversification math in the risk model and reflects realized co-movement better than the old equal-weighted mean.",
    ],
  },
  {
    version: "1.14",
    date: "2026-06-20",
    title: "Aligned Intelligence cards",
    changes: [
      "On the Intelligence page, the Holdings news card now matches the height of the Earnings calendar beside it and scrolls its headlines internally, instead of stretching the row to fit the news list.",
    ],
  },
  {
    version: "1.13",
    date: "2026-06-20",
    title: "Steadier Portfolio Mix legend",
    changes: [
      "The allocation donut legend now stays beside the chart and truncates long labels instead of wrapping below it, so switching to the Sector view no longer reflows or grows the card.",
    ],
  },
  {
    version: "1.12",
    date: "2026-06-19",
    title: "Consistent, PSD correlation model",
    changes: [
      "Rebuilt the correlation/covariance estimate as a positive-semi-definite factor model, so risk contributions can no longer come out negative.",
      "The correlation heatmap and the risk math now share one source of truth; most pairwise correlations are unchanged.",
    ],
  },
  {
    version: "1.11",
    date: "2026-06-18",
    title: "Patch notes",
    changes: ["Added this Patch Notes tab under Data to track what's shipped."],
  },
  {
    version: "1.10",
    date: "2026-06-17",
    title: "Tests, perf, and resilience",
    changes: [
      "Added test coverage, performance, and security hardening across the app.",
      "Improved resilience of the AI daily brief pipeline.",
    ],
  },
  {
    version: "1.9",
    date: "2026-06-17",
    title: "Quality tab overhaul",
    changes: [
      "Rebuilt the Quality tab with a categorized scorecard.",
      "Added per-holding quality grades.",
    ],
  },
  {
    version: "1.8",
    date: "2026-06-17",
    title: "Market Analysis refinements",
    changes: [
      "Redesigned the regime dial as the page centerpiece.",
      "Introduced progressive-disclosure layers for the underlying signals.",
    ],
  },
  {
    version: "1.7",
    date: "2026-06-17",
    title: "Research, search-first",
    changes: [
      "Overhauled Research into a search-first terminal for any ticker.",
      "Tab-by-tab UI and analytics refinements across the app.",
      "Renamed the project from Sanctum to alpha and stopped the lock-screen logo spin.",
    ],
  },
  {
    version: "1.6",
    date: "2026-06-16",
    title: "Rebalance tool",
    changes: ["Added the portfolio rebalancer / cash-deployment tool."],
  },
  {
    version: "1.5",
    date: "2026-06-12",
    title: "Intelligence tab",
    changes: [
      "Added the Intelligence tab: AI daily brief, news, earnings, and alerts.",
      "Fact-checked the market analysis engine; fixed a sign bug and misleading copy.",
      "Codebase sweep: dead code, small bugs, and hot-path cleanups.",
    ],
  },
  {
    version: "1.4",
    date: "2026-06-11",
    title: "Dividends, Market Analysis, and UI redesign",
    changes: [
      "Added the Dividends tab: income quality and durability engine.",
      "Added the Market Analysis tab with an adaptive regime engine.",
      "Redesigned the UI in a Vercel-inspired layout with Geist, and rebranded to alpha.",
      "Redesigned the All Positions table, added holdings logos, and compacted the correlation matrix.",
    ],
  },
  {
    version: "1.1",
    date: "2026-06-10",
    title: "Live data",
    changes: [
      "Added live data: Yahoo-backed quotes and fundamentals with offline snapshot fallback.",
      "Rebrand and theme pass, plus a round of UX fixes.",
    ],
  },
  {
    version: "1.0",
    date: "2026-06-10",
    title: "Initial release",
    changes: [
      "Launched the portfolio analytics terminal: allocation, risk, research, correlation, scenarios, and Monte Carlo.",
      "CSV import and PIN lock screen.",
    ],
  },
];
