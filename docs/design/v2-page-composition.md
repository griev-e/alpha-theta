# V2 Page Composition — one focal point per page

*A layout-and-hierarchy redesign of every major page in alpha and theta. This
document is deliberately silent on tokens, CSS, and components — its only
subject is **composition**: what the eye lands on first, what each panel is
worth relative to its neighbors, and which panels should merge, split, resize,
move, or disappear. The design language (near-black surfaces, hairline panels,
mono numerals, mint/iris accents, the lit-from-above light model) is the given.
The goal is that each page reads as **composed** — a clear subject with
supporting evidence — rather than **assembled** from equally-weighted cards.*

---

## 1. The compositional philosophy

Six rules, applied to every page below.

1. **One focal point.** Before anything else, each page must answer: *what is
   the one thing this page exists to show?* That thing gets the most area, the
   top-left-to-center anchor, and the largest type. Everything else is
   demonstrably secondary. A page with three equal heroes has none.

2. **Verdict, then evidence, then detail.** The strongest analytics pages state
   a conclusion first ("Runs hotter than the index; concentration is the
   story"), then the chart that proves it, then the tables you drill into. Most
   pages here currently open with raw instrumentation (a wall of gauges) and
   make the reader synthesize the verdict themselves. Invert it.

3. **Panels are tiered, not tiled.** Every page should resolve into three
   weights — **primary** (the hero, full-bleed or dominant column),
   **secondary** (1–2 supporting panels at ~60% of hero area), **tertiary**
   (dense reference: tables, breakdowns, notes). A uniform grid of same-size
   cards is the single most "assembled-not-composed" tell in the product, and
   it recurs on Risk, Dividends, Quality, and the theta pages.

4. **Merge what's read together; split what's read apart.** Two panels the eye
   constantly ties together (a metric and its breakdown; a chart and its
   legend) should be one composition. One panel carrying two unrelated jobs
   (Risk's "vitals" card holds gauges *and* a stat grid) should split so each
   has a job.

5. **The reading path is a Z, then an F.** The hero sits top (full width or
   dominant-left). The eye then sweeps into the secondary row, then descends
   the F-pattern of tables. Controls, filters, and assumptions belong in a
   **right rail** or under the hero — never above it, never competing with it
   for the top-left anchor.

6. **Whitespace is a compositional device, not leftover.** The hero earns a
   full-width band with generous vertical air around it; density is *earned*
   further down where reference data lives. Uniform 20px gaps everywhere flatten
   the hierarchy — vary the rhythm so the page breathes at the top and tightens
   toward the bottom.

### The recurring anti-pattern

Roughly two-thirds of the analytics pages follow the same shape: a hero card,
then `grid gap-5 xl:grid-cols-2` of two equal cards, then another equal pair,
then another. It's tidy and it's inert. The four compositional moves that fix
it, used throughout below:

- **Promote** one panel to full-bleed hero (Monte Carlo's fan, Correlation's
  matrix, the Optimizer's frontier).
- **Demote** instrumentation to a supporting strip (Risk's gauges, Market's
  layer cards).
- **Merge** a metric with its evidence (Quality's composite ring with its
  category breakdown; a Stat with its bar).
- **Rail** the controls (Monte Carlo, Rebalance, Scenarios, Optimizer already
  do this — extend it to every page that has inputs).

---

## 2. alpha — page by page

### Overview — *already the best-composed page; tighten the middle*

**Now:** hero band (net value + all-time/today deltas | 4-stat capital-and-risk
strip) → `xl:grid-cols-[1.6fr_1fr]` treemap + donut → full holdings table.

**Read:** this page already obeys the philosophy — a genuine hero, a weighted
1.6/1 middle, a dense table foot. It's the reference. Two refinements:

- **The middle row is two focal points fighting.** The treemap (allocation ×
  performance) and the donut (allocation by weight) both answer "how is the
  book split," so they read as redundant rather than complementary. **Merge the
  question:** make the **treemap the clear primary** of the middle band
  (full-bleed within its row, ~2fr), and demote the donut to a **compact
  legend-style mix strip** — either a thin horizontal 100%-stacked bar beneath
  the hero stats, or a small donut that lives *inside* the hero band as the
  "shape of the book" glyph. The middle row then has one subject (the treemap),
  not two.
- **Insert a session ribbon** between hero and treemap: a single slim line —
  today's best/worst movers as chips + market session state. It gives the
  descent from hero → allocation a narrative beat ("here's what moved today")
  instead of a jump. One row tall, tertiary weight.

**Resulting hierarchy:** Net value (primary) → session ribbon (connective) →
treemap (secondary-dominant) → holdings table (tertiary-dense). The donut stops
being a co-hero and becomes instrumentation.

### Research — *the flagship: chart as hero, everything orbits it*

**Now:** header → search box → quick-pick chips → `ResearchView` where the
price chart, fundamentals blocks, analyst, and "in your book" all stack as
equal-weight sections down a single column.

**Problem:** the page users will screenshot has **no focal point** — the chart
is one section among many in a vertical stack, and the ticker you're studying
never becomes the subject of the composition. The search box occupies the
top-anchor that the *security* should own.

**Redesign — the three-zone terminal:**

```
┌─────────┬───────────────────────────────────┬───────────┐
│ RAIL    │  STICKY SYMBOL HEADER              │ IN YOUR   │
│ holdings│  logo · NVDA · $ live · day Δ      │ BOOK      │
│ + watch │  ┌─────────────────────────────┐   │ (or "add  │
│ list    │  │                             │   │ to watch")│
│ j/k nav │  │      PRICE CHART = HERO      │   │           │
│ live Δ  │  │   (baseline split, events)  │   │ ANALYST   │
│ per row │  └─────────────────────────────┘   │           │
│         │  range · return-since chips        │           │
│         ├───────────────────────────────────┴───────────┤
│         │  FUNDAMENTALS — one dense grid, full width     │
└─────────┴───────────────────────────────────────────────┘
```

- **Left rail** (replaces the quick-pick chips): your holdings + watchlist as a
  scannable list, each row with a live day-change spark of color, `j`/`k` to
  move between them. Search collapses into a field at the top of this rail
  (`/` to focus), so the security — not the search box — owns the page.
- **Center stage:** a sticky symbol header (logo, live price, day change) sits
  above the price chart, which becomes the unmistakable hero — the largest
  single object on any page in the app. Range toggle + a "return since period
  start" chip live directly beneath it.
- **Right column:** the two most decision-relevant blocks — "in your book"
  (your position, cost, weight) or the add-to-watchlist CTA if unheld, and the
  analyst snapshot.
- **Fundamentals** become one wide, dense grid spanning the full width *below*
  the fold — reference material, tertiary weight, no longer competing with the
  chart for attention.

This is the biggest single composition win available: a page currently read as
a report becomes a page read as an instrument.

### Market Analysis — *the regime dial is the hero; layers are its footnotes*

**Now:** regime dial + a row of stat tiles (score/confidence/health) → a grid
of eight equal layer cards → the AI market read.

**Problem:** the eight `LayerCard`s are a uniform grid that visually *outweighs*
the regime dial simply by occupying more area — the page's actual conclusion
(the composite regime) is smaller than its inputs. Backwards.

**Redesign — one verdict, then the decomposition:**

- **Hero band:** the regime dial gets a full-width hero band, enlarged, with
  the composite score, label ("Risk-On · moderating"), confidence, and health
  as **inline readouts beside the dial**, not as separate tiles below it. The
  dial and its numbers are one object. To its right, in the same band, the AI
  **headline + one-line read** (not the full brief) — so the page's top answers
  "what regime, and what does it mean" in a single glance.
- **The eight layers become a ranked strip, not a grid.** Order them by
  contribution to the composite (the engine ranks drivers already), and render
  them as a **single horizontal row of compact bars** — each layer a labeled
  bar showing its signed contribution and earned weight, worst/strongest
  first. The full per-layer detail expands on click/hover. Eight equal squares
  become one legible spectrum.
- **The AI read** (positioning, watch items, counter-signal) moves **below**
  as the closing argument — the reasoned expansion of the headline up top.

**Hierarchy:** regime verdict + AI headline (primary) → ranked layer spectrum
(secondary) → full AI synthesis (tertiary). The decomposition supports the
conclusion instead of burying it.

### Risk — *split the "vitals" wall; lead with a verdict*

**Now:** one "vitals" card crams three gauges (beta, vol, Sharpe) *and* a
2×2 stat grid (expected return, diversification, HHI, effective N) into a
single flex row → coverage banner → `grid-cols-2` (concentration | risk
contribution) → `grid-cols-2` (asset allocation | sector tilts).

**Problems:** (1) The vitals card is seven equal-weight metrics in a row — pure
instrumentation, no focal point, and the reader must synthesize the verdict.
(2) It does two jobs (gauges + stats) in one panel. (3) The rest is the
equal-pairs anti-pattern.

**Redesign — verdict header + a demoted instrument strip:**

- **Verdict header** (new, primary): one composed sentence assembled from the
  flags that already exist — *"Beta 1.24 and 22% vol: runs hotter than the
  index. Effective N of 6 across 14 names — concentration is the real story."*
  Set in the display scale. This is the page's thesis; everything below proves
  it.
- **Demote the gauges to a slim vitals strip** directly under the verdict:
  beta · vol · Sharpe · expected return as four compact readouts with their
  benchmark ticks, one row, tertiary weight. They're the dashboard behind the
  verdict, not the hero.
- **Promote concentration to the secondary hero.** Since concentration is
  usually *the* risk story, the "where the book is crowded" panel (top-1/3/5 +
  the per-name meters) gets the dominant column of the next band, paired with
  the risk-contribution panel at ~0.8 width — these two *are* read together
  (weight vs. risk share), so place them as a deliberate pair with a shared
  header ("Concentration → risk contribution"), not two isolated cards.
- **Asset-class + sector** allocation stay as the tertiary pair at the bottom,
  where reference breakdowns belong — but merge their headers into one "Exposure
  breakdown" band so they read as one section with two views, not two more
  equal cards.

**Hierarchy:** verdict (primary) → vitals strip (connective) → concentration &
contribution pair (secondary) → exposure breakdowns (tertiary).

### Monte Carlo — *the fan is the hero; controls are a rail*

**Now:** a full-width "assumptions" controls card on top (sliders for years,
contribution, target) → results: fan chart, probability ring, histogram,
percentile stats stacked below.

**Problem:** the **controls sit in the top-anchor position that the simulation
should own.** You open Monte Carlo to see the cone of outcomes, and instead the
first thing is a form. The fan — the most beautiful object the page can show —
is below the fold.

**Redesign — rail the form, promote the cone:**

```
┌───────────────────────────────────────────┬───────────┐
│  "In 2036, the median path reaches $X;     │ ASSUMPTIONS
│   68% chance of hitting your 4× target."   │ years  ▓▓ │
│  ┌─────────────────────────────────────┐   │ contrib ▓ │
│  │                                     │   │ target ▓▓ │
│  │        FAN CHART = HERO             │   │           │
│  │     (percentile chips at right)    │   │ ○ prob    │
│  └─────────────────────────────────────┘   │   ring    │
├───────────────────────────────────────────┴───────────┤
│  HISTOGRAM of terminal values + percentile table       │
└────────────────────────────────────────────────────────┘
```

- **Sentence-first hero:** lead with the plain-language outcome ("median path
  → $X; P(target) = 68%") in the display scale, with the **probability ring**
  inline beside it as the glanceable figure.
- **The fan chart is the hero object**, full-bleed in the main column, with
  P10/P50/P90 chips labeled at its right edge.
- **Controls become a right rail** — the sliders move out of the top-anchor
  into a sticky rail, so adjusting an assumption visibly reshapes the cone
  beside it (the cause-and-effect the page is *about*).
- **Histogram + percentile table** drop to a full-width tertiary band below —
  the distributional detail you study after the cone tells the story.

### Dividends — *lead with the income calendar, not a stats hero*

**Now:** hero (income stats) → `xl:grid-cols-[1.2fr_1fr]` pair → payments table
→ `grid-cols-2` pair → notes card.

**Problem:** three stacked equal-ish pairs; the page's most evocative asset —
the *rhythm of income over a year* — is never the focal point.

**Redesign:**

- **Hero = the income year.** A full-width 12-month payment strip (each month a
  dot/bar sized by expected income, next payment highlighted) with the headline
  annual income + yield as inline readouts to its left. Income becomes a
  *cadence you can see*, which is what makes dividends emotionally resonant.
- **Secondary:** a single band pairing "top payers" (ranked contribution to
  income) with the yield-vs-growth scatter or the reinvestment view —
  whichever is the stronger of the current pair — at a deliberate 1.4/1 weight.
- **Tertiary:** the full payments table and the methodology notes, bottom,
  dense.

Kill one of the current equal pairs by folding its weaker half into the notes
or the table; the page should descend hero → one supporting band → table, not
hero → pair → table → pair → notes.

### Quality — *the composite ring is the hero; merge it with its own breakdown*

**Now:** hero (`lg:grid-cols-[280px_1fr]` composite ring | summary) →
`grid-cols-2` metric detail → holdings-by-quality grid → category cards.

**Read:** the ring-as-hero instinct is right. The fix is **merging the ring
with the category breakdown it summarizes.** Right now the composite ring
(hero) and "share of the composite each category carries" (a later card) are
separated by the holdings grid — but they're the same story at two zoom levels.

**Redesign:**

- **Hero band merges ring + category contribution:** the composite ring on the
  left, and immediately beside it the category bars (profitability, growth,
  balance-sheet…) each showing score *and* its weight in the composite. One
  composition answers "what's the grade, and what drove it." This is the
  strongest single merge on the page.
- **Holdings-by-quality** becomes the secondary band — a ranked list/grid of
  names by score, the drill-down from the composite.
- **Per-category deep cards** drop to tertiary or collapse into the hero's
  category bars via click-to-expand, removing a whole redundant tier.

**Hierarchy:** grade + its drivers (primary, merged) → holdings ranked
(secondary) → detail on demand (tertiary).

### Correlation — *promote the matrix to full-bleed; give it a verdict + stats*

**Now:** essentially one card containing the heatmap, plus header copy.

**Problem:** the opposite failure from the equal-grid pages — a single object
floating with no framing, no focal composition, no takeaway. A correlation
matrix with no verdict is a puzzle handed to the reader.

**Redesign:**

- **Verdict line up top:** *"Your book is more correlated than it looks — the
  seven mega-cap tech names move as one cluster (avg ρ 0.71)."* Assembled from
  the matrix's own stats.
- **Hero = the matrix, full-bleed and larger,** with **cluster seriation** so
  correlated blocks physically group into visible squares along the diagonal
  (the single biggest perceptual upgrade the page can get — same data, ordered
  to reveal structure).
- **A slim right rail or top strip of stats:** average pairwise correlation,
  most/least correlated pair, effective independent bets. These frame the
  matrix so it has a thesis, not just a texture.

One object, but now *composed*: verdict → framed hero → supporting stats.

### Benchmark & Factors — *keep the 1.25/1; make the radar the signature*

**Now:** `xl:grid-cols-[1.25fr_1fr]` (head-to-head table | style radar) →
full-width valuation scatter.

**Read:** this page is close. The head-to-head table vs. index is the natural
primary and the radar its companion — the 1.25/1 split is right. Refinements:

- **Overlay the index on the radar** so the "style footprint" panel shows
  *portfolio vs. benchmark* as two shapes, not one — turning a lonely polygon
  into a comparison, which is the whole point of the page. This makes the radar
  a genuine secondary hero rather than decoration.
- **The scatter ("what you pay vs. what you get")** is a strong idea buried at
  the bottom; give it quadrant labels and an index reference point so it reads
  on its own, and consider promoting it to share the hero band with the table
  on wide viewports (table | scatter as the primary pair, radar demoted to a
  compact glyph) — the scatter is more of a "positioning" story than the radar.

### Rebalance & Optimizer — *already rail-composed; thin the results stack*

**Now (both):** a left controls rail (400px / 360px) + a results column. Good
bones — the rail pattern is exactly right and should be the model other input
pages copy.

**The problem is downstream:** the results column is a *long vertical stack* of
equal cards (Optimizer: metrics → frontier → weights → order ticket → AI
review; Rebalance: current→projected → order ticket → AI allocator). No focal
point within the results.

**Redesign — give the results column its own hero:**

- **Optimizer:** the **efficient frontier is the hero of the results column** —
  promote it to the top of that column, enlarged, with the current and optimal
  points marked and a one-line verdict ("Optimal sits up and to the left:
  same return, 18% less risk"). The before→after metrics become a compact strip
  *inside/atop* the frontier card, not a separate card above it. Weights table
  and order ticket drop to tertiary. The eight objectives become a **2×4 card
  grid** (icon + one-line philosophy) rather than a plain segmented control, so
  choosing an objective feels like choosing a strategy.
- **Rebalance:** the **current→projected allocation diff is the hero** — render
  trades as before/after weight bars with the movement shown, one composition,
  at the top of the results. The order ticket (tertiary table) and the AI
  allocator (closing argument) follow. Right now the diff and the ticket read
  as equal; the diff is the story, the ticket is the receipt.

### Scenarios — *rail is right; make the result a single dramatic readout*

**Now:** left rail (380px presets + custom shock) + results with an impact
waterfall per scenario.

**Redesign:** the rail stays. The **results column needs one hero moment**: the
selected scenario's **portfolio impact as a large, single figure** ("−18.4% ·
−$47,200") with the before/after value and a **severity-scaled visual** (the
waterfall of damage-by-holding) as its proof directly below. Order scenarios
worst-first. Each scenario card in any list gets a left severity spine scaled to
impact, so the list itself encodes magnitude. The page should feel like a
stress *verdict*, not a table of deltas.

### Discover — *the lens is the hero act; ideas are the payoff*

**Now:** lens picker (six options) + ETF toggle → ideas grid (`lg:grid-cols-2`).

**Read:** compositionally sound — a choice, then results. Refinements: make the
**lens selection a more deliberate composition** (six lenses as a 2×3 or 3×2
card grid with a one-line philosophy each and a distinct glyph, the selected
one lifting with the accent) so picking a lens feels like setting a research
intent. The **ideas grid** is fine as a pair-column, but each idea card should
have its own internal hierarchy (the name + one-line thesis as the focal point,
the "what it adds / how it complements / the risk" as supporting tiers) rather
than equal-weight fields. Add a quiet header state once ideas load ("6 names
through the *Diversify* lens") to frame the payoff.

### Intelligence — *the brief is the morning paper; compose it like one*

**Now:** brief card (AI) → news list.

**Redesign:** treat the brief as an **editorial front page**. The generated
**headline** sets in the display scale as the page's focal point; sections
numbered in tracked mono ("01 · Positioning · 02 · What moved · 03 · On the
radar"), the prose in a genuine reading measure. The **news list** becomes a
right rail or a tertiary strip beneath — supporting the brief, not competing as
an equal block. The AiMeta chip (model · cost · cached) closes the brief. The
page should feel like opening a paper written for your book, with one headline,
not two stacked cards.

---

## 3. theta — page by page

### Dashboard — *strong hero; thin the equal-pairs body*

**Now:** hero (net worth + sparkline + 4 stats) → `xl:grid-cols-[1.5fr_1fr]`
(cash-flow bars | spending donut) → `grid-cols-2` (budgets | goals) →
transactions table.

**Read:** the hero is excellent (net worth as the unmistakable focal point).
The body is the equal-pairs anti-pattern — cash-flow/spending, then
budgets/goals, then a table, four tiers of near-equal weight. Refinements:

- **Add the one number theta is missing from the hero: runway** ("X months at
  current burn") — the most emotionally important personal-finance figure,
  currently absent from the top. It belongs in the hero stat row.
- **The cash-flow + spending pair is the natural secondary** — keep the 1.5/1
  split, it's correct. But **demote budgets + goals** from a full equal band to
  a **single combined "this month's pacing" strip** (top budgets as thin bars +
  goal rings as small glyphs in one row) so the page doesn't present four
  co-equal bands. Net worth (primary) → cash-flow/spending (secondary) →
  pacing strip + recent transactions (tertiary).

### Net Worth — *lead with the trajectory, not the account list*

**Redesign:** the hero should be a **stacked composition-over-time area chart**
(liquid / invested / liabilities) with milestone flags (crossed $0, new high) —
net worth as a *trajectory*, which is what the page is for. The **account list**
becomes the tertiary breakdown beneath it. Right now the balance and list carry
equal weight; the *shape of the climb* is the story and should own the top.

### Financial Health — *ring + drivers as one hero (mirror Quality)*

**Now:** `lg:grid-cols-[280px_1fr]` (composite ring | attention) → metrics
breakdown → AI review.

**Redesign:** apply the same merge as alpha's Quality — the **composite ring
and the metric reference-band bars become one hero composition** ("here's your
score, and here's each metric against its healthy range as a band with your
position marked"). "What's dragging" (attention) folds in as the callout on the
worst two metrics rather than a separate co-hero panel. The AI review is the
closing argument below. One grade, its drivers visible, then the reasoning.

### Debt Payoff — *the decay curve is the hero; strategy is the lever*

**Now:** strategy toggle → payoff curve + "order of attack" → (AI).

**Redesign:** the **balance-decay curve is the hero** — full-bleed, with the
avalanche-vs-snowball comparison as a ghost overlay, and the headline outcome
as a sentence above it: *"Debt-free by March 2029 — and avalanche saves you
$4,310 vs. paying minimums."* The strategy toggle and budget slider become a
compact control strip (or right rail) feeding the curve. "Order of attack"
(which debt, in what sequence) is the tertiary list beneath. The page currently
under-sells its own math; the curve + the saved-interest headline is the
emotional payoff.

### Cash Flow — *lead with the annotated forecast and its low point*

**Redesign:** hero = the short-horizon **forecast line with its low point
flagged** and a sentence ("Lowest balance $1,240 on Jul 28, after rent — 22
days of runway"). The historical flow bars become the secondary. The page's
value is the *warning* — the moment you might run short — so annotate and lead
with it rather than showing undifferentiated in/out bars.

### Projection — *inherit Monte Carlo's composition exactly*

**Redesign:** theta's net-worth projection should adopt alpha's Monte Carlo
composition wholesale — sentence-first hero, fan chart as the hero object,
assumptions in a right rail, percentile detail below — so the two simulation
surfaces feel like one family. Today they diverge; parity is a composition win.

### Budgets / Goals / Recurring / Transactions — *tier the lists*

- **Budgets:** the page is a list; give it a **hero summary** (total budgeted vs.
  spent, over-pace count) then the budget bars as the tertiary detail, with a
  pace tick on each so over/under-pace reads before the limit is hit.
- **Goals:** hero = the **nearest / most-at-risk goal** as a large ring with its
  projected date, then the rest as a small ring grid. Not all goals equal — the
  one that needs attention leads.
- **Recurring:** hero = **total annual subscription cost** + count, then the
  detected-charges list sorted by annualized cost with price-creep flagged.
  Lead with the number that motivates action.
- **Transactions:** this one is legitimately a table-first page — its
  composition is the **table system** (sticky month-group headers with month
  totals, a category-color row rail, a filter strip as a compact toolbar rather
  than a card). The focal point is the ledger itself; the job is to make the
  table read as one engineered surface (see the table-system note below).

### Accounts / Import / Settings — *utility pages, but still tiered*

- **Accounts:** hero = **net worth split** (assets vs. liabilities as one bar or
  paired figure), then account cards as the tertiary grid — each with sync
  provenance and a balance spark. The list shouldn't open cold; frame it with
  the total it sums to.
- **Import (both apps):** compose as a **launch pad** — the dropzone as the
  clear primary (with a live example of the expected header), an "or start
  from" column (demo · sample · empty) as secondary, and the parse preview
  taking over as the primary once a file lands. First contact deserves a
  composed first screen, not a form.
- **Settings:** group assumptions into titled sections with clear primary
  inputs; not a composition challenge, but apply the same label hierarchy.

---

## 4. Cross-cutting composition systems

Patterns that, applied uniformly, make the whole product feel composed by one
hand:

1. **The verdict header.** Analytics pages (Risk, Correlation, Quality, Market,
   Monte Carlo, Debt) open with one composed sentence stating the takeaway,
   set in the display scale, before any chart. This single pattern does more
   for "intentional composition" than any layout change — it declares that each
   page has a point of view.

2. **The controls rail.** Every page with inputs (Monte Carlo, Scenarios,
   Rebalance, Optimizer, Debt, Projection) puts them in a consistent left/right
   rail, never in the top-anchor. Rebalance/Optimizer/Scenarios already prove
   the pattern; Monte Carlo and the theta simulators should adopt it.

3. **Hero object per page.** Each page nominates one visualization as its hero
   and gives it materially more area than anything else: Overview→treemap,
   Research→price chart, Market→regime dial, Monte Carlo/Projection→fan,
   Correlation→matrix, Debt→decay curve, Net Worth→trajectory, Dividends→income
   calendar. If two charts share a page, they are weighted, never equal.

4. **The table system.** Every dense table (Overview holdings, Dividends
   payments, Rebalance/Optimizer tickets, Quality holdings, theta Transactions)
   shares one composition: sticky blurred header, right-aligned tabular
   numerals, a footer aggregate row, a row-hover accent edge, an optional group
   header. Tables are tertiary weight but must feel like one engineered
   surface — this is the Stripe-grade "came off one lathe" quality.

5. **Kill the equal pair.** Wherever the current layout is `grid-cols-2` of two
   same-weight cards, ask: is one the subject and the other support? If yes,
   weight them (1.4/1, 1.6/1). If they're truly co-equal reference (asset-class
   vs. sector allocation), merge them under one section header so they read as
   one band with two views, not two more cards. The uniform two-up grid should
   nearly disappear from the product.

6. **Rhythm, not uniform gaps.** Open each page with an airy hero band, then
   tighten vertical rhythm as content descends into reference density. The
   constant 20px gap flattens hierarchy; varying it (generous around the hero,
   compact around tables) is itself a compositional signal of "this matters
   most."

---

## 5. Guardrails

- **Preserve the language.** Every redesign above is a *rearrangement* — same
  surfaces, same hairlines, same mono numerals, same accents, same charts. No
  page loses its identity; each gains a focal point.
- **Never fabricate a hero.** If a page genuinely has no single subject (pure
  utility pages), don't invent theatrical emphasis — tier it honestly and move
  on. The verdict header must state a *real* computed takeaway, never a
  manufactured one.
- **Merges must be read-together, splits must be read-apart.** Don't merge for
  density or split for symmetry; the test is always whether the eye ties the
  two panels together in use.
- **The hero earns its area; the rest earns its density.** Whitespace at the top
  is a statement of priority, not wasted space — but reference data lower down
  should be genuinely dense. Both are composition.
