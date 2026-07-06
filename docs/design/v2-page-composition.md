# V2 Page Composition — one focal point per page

*A layout-and-hierarchy redesign of the pages that still need one. This
document is deliberately silent on tokens, CSS, and components — its only
subject is **composition**: what the eye lands on first, what each panel is
worth relative to its neighbors, and which panels should merge, split,
resize, move, or disappear. The design language (near-black surfaces,
hairline panels, mono numerals, mint/iris accents, the lit-from-above light
model) is the given.*

**Shipped and removed from this doc:** Research (the three-zone terminal),
Market Analysis (regime dial + inline AI headline, ranked layer strip),
Quality (composite ring merged with its category breakdown), Rebalance &
Optimizer (results-column hero: the diff view and the frontier), Monte Carlo
(sentence-first hero + rail), Debt Payoff (decay curve + verdict as hero),
theta Budgets/Goals/Recurring (pace spines, status chips, price-creep
sparks — each page already leads with its motivating number or state). Risk
and Correlation shipped their verdict headers; the layout refinements below
are what's left on each.

---

## 1. The compositional philosophy

Six rules, applied to every page below.

1. **One focal point.** Before anything else, each page must answer: *what is
   the one thing this page exists to show?* That thing gets the most area, the
   top-left-to-center anchor, and the largest type. Everything else is
   demonstrably secondary. A page with three equal heroes has none.

2. **Verdict, then evidence, then detail.** The strongest analytics pages state
   a conclusion first, then the chart that proves it, then the tables you drill
   into. Risk, Correlation, Quality, and Market Analysis already do this now —
   apply the same move to Cash Flow and the remaining pages below.

3. **Panels are tiered, not tiled.** Every page should resolve into three
   weights — **primary** (the hero), **secondary** (1–2 supporting panels at
   ~60% of hero area), **tertiary** (dense reference: tables, breakdowns,
   notes). A uniform grid of same-size cards is the "assembled-not-composed"
   tell — it still recurs on Risk's vitals card and theta Health's hero.

4. **Merge what's read together; split what's read apart.** Two panels the eye
   constantly ties together (a metric and its breakdown) should be one
   composition — Quality proved this pattern; theta Health hasn't adopted it
   yet.

5. **The reading path is a Z, then an F.** The hero sits top (full width or
   dominant-left). The eye then sweeps into the secondary row, then descends
   the F-pattern of tables. Controls belong in a **right rail** — Monte Carlo,
   Rebalance, Scenarios, Optimizer, and Debt Payoff already do this.

6. **Whitespace is a compositional device, not leftover.** The hero earns a
   full-width band with generous vertical air; density is *earned* further
   down where reference data lives.

---

## 2. alpha — pages with remaining composition work

### Overview — *the middle row still has two panels answering the same question*

**Now:** hero band → `xl:grid-cols-[1.6fr_1fr]` treemap + donut → holdings
table. Hover-sync (shipped in #130) ties the treemap, donut, and table
together so hovering a symbol lights it everywhere — that resolves the "two
focal points fighting for attention" problem through cross-highlight rather
than a merge, which is a reasonable alternative to the original ask.

**Still open:**
- **A session ribbon** between hero and treemap: today's best/worst movers as
  3 chips (logo + %) and session state (pre/post-market). Gives the descent
  from hero → allocation a narrative beat instead of a jump. One row tall,
  tertiary weight. **M**

### Risk — *the vitals card still does two jobs*

**Now:** verdict header (shipped) → one "vitals" card cramming three gauges
*and* a 2×2 stat grid into a single flex row → coverage banner →
concentration and risk-contribution as two separate cards → asset/sector
allocation as two more separate cards.

**Still open:**
- **Split the vitals card.** Demote the gauges to a slim strip directly under
  the verdict — beta · vol · Sharpe · expected return as four compact
  readouts with benchmark ticks, one row. They're the dashboard behind the
  verdict, not a second hero.
- **Pair concentration with contribution under one shared header**
  ("Concentration → risk contribution") since weight vs. risk share is
  genuinely read together — right now they're two isolated cards that happen
  to sit side by side.
- **Merge the asset/sector allocation headers** into one "Exposure breakdown"
  band so they read as one section with two views. **M**

### Dividends — *the income calendar exists but isn't the hero yet*

**Now:** hero = composite score + income stats → a `1.2fr/1fr` pair (payment
calendar | forecast table) → holdings table → concentration/risk pair.

**Still open:**
- **Promote the payment calendar to the hero**, full-width, with the
  headline annual income + yield as inline readouts to its left — income as
  a *cadence you can see* is the page's most evocative asset and it's
  currently secondary to a stats-and-ring card. **M**

### Correlation — *the verdict shipped; the matrix itself doesn't reveal structure yet*

**Now:** a verdict sentence sits above the heatmap (shipped).

**Still open:**
- **Cluster seriation.** Order symbols by hierarchical-cluster similarity
  instead of book order so correlated blocks physically group into visible
  squares along the diagonal — same data, ordered to reveal structure. The
  single biggest perceptual upgrade still available on this page. **A**
  (tracked as §55 in the catalogue doc)

### Benchmark & Factors — *the radar overlay shipped; the hero weighting hasn't changed*

**Now:** `xl:grid-cols-[1.25fr_1fr]` (head-to-head table | style radar, now
with the benchmark overlay) → full-width valuation scatter (now with quadrant
labels).

**Still open:**
- **Consider promoting the scatter to share the hero band with the table**
  on wide viewports (table | scatter as the primary pair, radar demoted to a
  compact glyph) — the scatter is more of a "positioning" story than the
  radar and is currently buried at the bottom. **M**

### Discover — *the lens picker composes well; the idea cards don't have internal hierarchy yet*

**Now:** a responsive lens grid (2/3/6 columns) already gives lens selection
its own composed moment.

**Still open:**
- **Give each idea card internal hierarchy** — the name + one-line thesis as
  the focal point, "what it adds / how it complements / the risk" as
  supporting tiers — rather than equal-weight fields. **QW**

---

## 3. theta — pages with remaining composition work

### Net Worth — *still leads with the account list, not the trajectory*

**Redesign:** the hero should be a **stacked composition-over-time area
chart** (liquid / invested / liabilities) with milestone flags (crossed $0,
new high) — net worth as a *trajectory*, which is what the page is for. The
account list becomes the tertiary breakdown beneath it. **A** (tracked as
§90 in the catalogue doc)

### Financial Health — *ring and "what's dragging" are adjacent, not merged*

**Now:** `lg:grid-cols-[280px_1fr]` puts the composite ring and the
"Attention" callout in two separate Cards side by side — reference-band bars
(shipped in #129) live in a *third* card below.

**Still open:**
- **Merge into one hero Card**, mirroring Quality exactly: the ring on the
  left, the reference-band bars immediately beside it, with "what's
  dragging" folded in as a callout on the worst two metrics rather than a
  co-equal panel. One grade, its drivers visible in the same frame. **M**

### Cash Flow — *needs the same verdict-then-evidence move as Risk/Correlation*

**Redesign:** hero = the short-horizon forecast line with its low point
flagged (once §50's `ChartFlag` annotation ships) and a sentence ("Lowest
balance $1,240 on Jul 28, after rent — 22 days of runway"). The historical
flow bars become secondary. **M**

### Projection — *hasn't adopted Monte Carlo's shipped composition*

**Redesign:** theta's net-worth projection should adopt alpha's now-shipped
Monte Carlo composition wholesale — sentence-first hero, fan chart as the
hero object, assumptions in a right rail — so the two simulation surfaces
feel like one family. Today they diverge. **M**

### Dashboard — *the pacing merge shipped; runway is still missing from the hero*

**Now:** hero (net worth + sparkline + stats) → cash-flow/spending pair →
a merged "this month's pacing" strip (shipped) → transactions.

**Still open:**
- **Add runway to the hero stat row** ("X months at current burn") — the
  forecast engine already exposes it; it's the single most emotionally
  important personal-finance figure and it's still buried in Cash Flow.
  **QW**

### Transactions — *still waiting on the table system*

This page is legitimately table-first; its composition *is* the table
system (sticky month-group headers with month totals, a category-color row
rail — shipped — and a filter strip as a compact toolbar). Blocked on the
shared `Table.tsx` extraction (§65 in the catalogue doc), not on anything
page-specific. **A**

---

## 4. Cross-cutting composition systems

1. **The verdict header** — adopted on Risk, Correlation, Quality, Market
   Analysis, Monte Carlo, and Debt Payoff. Still needed: **Cash Flow**.

2. **The controls rail** — adopted on Monte Carlo, Scenarios, Rebalance,
   Optimizer, Debt Payoff. Still needed: **theta Projection** (once it
   adopts Monte Carlo's composition).

3. **Hero object per page** — mostly achieved. Still needed: **Overview**
   (session ribbon as connective tissue), **theta Net Worth** (trajectory
   chart replacing the account list).

4. **The table system** — still fully open. Every dense table (Overview
   holdings, Dividends payments, Rebalance/Optimizer tickets, Quality
   holdings, theta Transactions) should share one composition: sticky
   blurred header, right-aligned tabular numerals, a footer aggregate row, a
   row-hover accent edge, an optional group header. The single largest
   remaining structural inconsistency in the product. **A**

5. **Kill the equal pair** — mostly resolved. Two instances remain: **Risk's**
   vitals-card (gauges + stat grid crammed together) and **theta Health's**
   ring + "Attention" (two adjacent Cards instead of one merged
   composition).

6. **Rhythm, not uniform gaps** — apply as new compositions ship; no
   outstanding audit item.

---

## 5. Guardrails

- **Preserve the language.** Every redesign above is a *rearrangement* — same
  surfaces, same hairlines, same mono numerals, same accents, same charts. No
  page loses its identity; each gains a focal point.
- **Never fabricate a hero.** If a page genuinely has no single subject, tier
  it honestly and move on. The verdict header must state a *real* computed
  takeaway, never a manufactured one.
- **Merges must be read-together, splits must be read-apart.** The test is
  always whether the eye ties the two panels together in use.
- **The hero earns its area; the rest earns its density.**
