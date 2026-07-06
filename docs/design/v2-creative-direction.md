# V2 Creative Direction — alpha / theta

*The second design horizon. The first roadmap (`premium-roadmap.md`) took the
frontend from "good MVP" to "engineered object" — and it shipped: the elevation
ladder, the ⌘K palette, the chart-tooltip grammar, directional tick flashes,
motion economy, page auras, toasts, the owned Select, per-shell accents. This
document assumes all of that as the floor. V2 is about what separates an
engineered object from an **instrument with a soul** — the difference between a
product that is impeccably built and one that people screenshot, gift to
friends, and remember.*

*No code ships with this document.*

---

## 1. Where V1 landed — the honest read

What the design language now is, verified in the code:

- **A real light model.** Four surface steps (`--surface-1..3` + void), one
  implied light source (`--edge-hi` top highlights, shared overlay shadows),
  the `panel-rim` lit hairline for hero cards. Depth is now *lit*, not drawn.
- **A real motion system.** One named easing (`[0.22,1,0.36,1]`), first-view
  choreography that plays once per route per session (`lib/firstView`), layout
  springs for re-sorting, directional price-tick flashes scoped to the cell,
  `MotionConfig reducedMotion="user"` plus CSS fallbacks.
- **A keyboard-first shell.** ⌘K palette with live ticker search, `/` sidebar
  find, resizable sidebar with keyboard support, per-route titles, top progress.
- **One chart interaction dialect.** `ChartTooltip` shared across the SVG
  family; PriceChart is genuinely instrument-grade (baseline split fill, live
  endpoint pulse, high/low ticks).
- **Honesty as brand.** Provenance dots, coverage banners, "models, not
  advice," the degraded-mode ribbon, `AiMeta` cost chips. Unchanged and sacred.

**What did *not* ship from V1** (inherited into V2): the Research terminal
layout, the market pulse strip, the elevated portfolio switcher, the
first-import moment, the report cover page, per-shape skeletons.

**The five things keeping it at "excellent" instead of "unforgettable":**

1. **The typography is engineered, not composed.** Everything is set in two
   Geist families at 10–22px. It's disciplined — and slightly mute. The one
   distinctive typographic asset in the product (the Georgia-italic α/θ) is
   quarantined to a 24px sidebar mark and the lock screen. Page titles at 22px
   are smaller than the numerals beneath them; card titles at 14px barely
   outrank body text. The system never *raises its voice*.
2. **Charts render data; they don't yet narrate it.** The treemap shows sizes,
   the fan shows percentiles — but nothing points at the *story* (the earnings
   date that explains the spike, the low point in the cash-flow forecast, the
   month the net worth crossed zero). Premium data products annotate.
3. **The shell reports status; it doesn't yet feel like a cockpit.** The LIVE
   dot is binary. There's no market tape, no per-provider health, no sense that
   the instrument is connected to a living market beyond one green dot.
4. **The two-app portal identity is under-performed inside the apps.** The
   lock screen is a jewel; once inside, alpha/theta cross-navigation is a
   dimmed word in the corner. The "α | θ" duality — the product's most original
   idea — is nearly invisible during actual use.
5. **Theater exists only at the door.** The entrance choreography and the
   AiThinking field promise a product of conducted moments — then the first CSV
   import, a finished AI brief, a completed goal, and a green day all land
   without ceremony.

---

## 2. The V2 thesis

**Same product, five ambitions:**

> **"From a terminal you respect to an instrument you feel."**

1. **Typography becomes the voice.** A confident display scale, the serif
   signature released from the sidebar, and numeral typography (dimmed symbols,
   digit rolls) that makes figures feel *minted* rather than printed.
2. **One light, one physics — finished.** The light model extends into the last
   corners: charts, hovers, focus, scroll. Nothing in the app should look lit
   from a different sky.
3. **Data that narrates.** An annotation layer across the chart family: event
   markers, reference bands, callout chips. Every chart answers "so what?"
   without a paragraph next to it.
4. **The shell becomes a cockpit.** A market tape, a status center, a keyboard
   map, a portfolio switcher worthy of the data behind it. The chrome should
   feel connected to the market, not just to the router.
5. **Earned theater.** A small set of conducted, once-only moments at the
   points of highest emotional value: first import, brief arrival, goal
   completion, the daily open. Never looping, never repeated, always earned.

---

## 3. The eight biggest opportunities

Ranked by (perceived-quality lift × fidelity to identity) ÷ effort:

1. **A display type scale + the serif signature** (§A) — the single cheapest
   transformation left. Ten files, no new dependencies, and every page reads as
   composed rather than assembled.
2. **The market pulse strip + status center** (§D) — turns the top bar from
   labels into a cockpit; the data endpoints already exist (`/api/cma`,
   `/api/quotes`, `useLiveStatus`).
3. **The annotation layer for charts** (§E) — earnings dates on PriceChart,
   low-point flags on forecasts, threshold bands on gauges. The engines already
   compute these facts; the charts just don't show them.
4. **Research as the flagship terminal** (§G) — the page users screenshot,
   restructured into a three-zone terminal with j/k navigation and a watchlist.
5. **The Overview hover-sync system** (§J) — donut ↔ treemap ↔ table
   cross-highlighting makes the dashboard feel like one organism instead of
   three widgets.
6. **Numeral craft** (§A) — dimmed currency symbols/decimals, per-digit rolls,
   consistent compact notation. Finance products live and die on how numbers
   *feel*.
7. **theta's engines surfaced** (§H) — debt payoff curves, forecast low-point,
   health reference bands: theta's math is deeper than its pages show.
8. **The portal identity inside the shell** (§D, §K) — the α/θ duality
   performed during use, not just at the door.

---

## 4. The catalogue

Effort: **QW** = quick win (≤ half a day) · **M** = medium (1–3 days) ·
**A** = ambitious (a week or more, schedule deliberately).

### A. Typography & numerals — the voice

1. **Codify a display ramp.** Add to the `@theme` type reference: `xl 26–28px`
   (page titles, tracking −0.02em), promote hero numerals to 44–48px on
   Overview/theta dashboard. Today's 22px `PageHeader` title is outranked by
   the 40px figure below it — the page should introduce itself with the same
   confidence. `components/ui/PageHeader.tsx`, `app/globals.css`. **QW**
2. **Release the serif.** The Georgia-italic α/θ is the only distinctive glyph
   in the product. Give it three more sanctioned homes: a large watermark glyph
   behind empty states (replacing/augmenting `GhostChart`), the report cover,
   and a small italic-serif ligature in each page's eyebrow (e.g. "*α* ·
   Portfolio"). Nowhere else — scarcity is what makes it a signature.
   `components/ui/EmptyState.tsx`, `app/report/page.tsx`,
   `components/ui/PageHeader.tsx`. **QW**
3. **Unify the two eyebrow dialects.** `.eyebrow` (12px sentence-case gray) and
   the mono uppercase `tracking-[0.18em]` label (AiThinking, LIVE, theta's
   SAMPLE DATA) both mark metadata. Keep both, but write the rule: sentence-case
   for *labels of content*, tracked mono caps for *machine/status voice* — then
   audit every call site against it. `app/globals.css` comment + sweep. **QW**
4. **Dim the furniture in numerals.** In hero and Stat figures, render the
   currency symbol and decimals at ~55% opacity ("$" and ".56" quiet, "12,304"
   loud) — the Stripe/Linear numeral move. One `<Money>` formatter component
   used by `Stat`, `AnimatedNumber` call sites, theta's `EditableMoney`. **M**
5. **Per-digit roll for the hero numbers.** Upgrade `AnimatedNumber` with a
   `variant="roll"` (odometer-style column roll on change, respecting reduced
   motion) used only by the two hero values (Overview net value, theta net
   worth). The current interpolation is good; the roll makes live ticks feel
   mechanical-precise. `components/ui/AnimatedNumber.tsx`. **M**
6. **Card title hierarchy.** `CardHeader` titles at 14px/500 barely outrank
   13px body text. Move to 15px/560 with −0.01em tracking, and drop the eyebrow
   where it duplicates the title ("Allocation / Portfolio Mix"). Audit all ~40
   CardHeader call sites for eyebrow redundancy. `components/ui/Card.tsx`. **QW**
7. **Tabular figures audit.** Sweep for stray non-`tnum` numerals (a few stat
   subs, badge counts, tooltip figures). Add a lint-style checklist item to the
   type-scale comment. **QW**
8. **`text-wrap: balance` on all headings**, `pretty` on descriptions —
   partially done; finish across both apps (empty states, AI headlines, modal
   titles). **QW**
9. **A "figures dictionary" note.** `lib/format.ts` is the single source of
   number style. Document the rules at the top (when compact vs full, sign
   conventions, the true-minus "−" vs hyphen) so new surfaces can't drift. **QW**
10. **Optical alignment pass on stat stacks.** Big numerals with `leading-none`
    sit optically low against their eyebrows; nudge baseline spacing so
    label→value→sub rhythm is identical in `Stat`, `StatTile` (market page),
    and theta's tiles — one shared spacing spec. **QW**
11. **AI prose as editorial type.** Brief/read/review bodies currently set in
    the UI's 13px. Give AI-generated prose a reading style: 14px/1.65, wider
    measure (65ch), first paragraph 15px, mint-tinted `::selection` already in
    place. The AI voice should *read* different from chrome.
    `app/intelligence/page.tsx`, `app/market/page.tsx`,
    `app/theta/health/page.tsx`, `app/theta/intelligence/page.tsx`. **M**
12. **Report typography, finished.** The print doc's h2 underline + KPI grid is
    strong; add the unshipped cover block (large serif α watermark, portfolio
    name, date range, "models not advice" colophon), running page numbers via
    `@page` margin boxes, and a mini table of contents. `app/report/page.tsx`,
    `globals.css` print styles. **M**

### B. Color, light & surface — one sky

13. **Accent ramps as tokens.** The code mixes accents ad hoc
    (`color-mix(... 45%, transparent)` scattered per file). Define 3-step ramps
    (`--mint-dim/base/bright`, same for vio/sky/pos/neg) in `@theme` and sweep
    chart/bar/glow call sites onto them. Consistency of *intensity* is what
    reads as engineered. `app/globals.css` + sweep. **M**
14. **Give alpha's red a third moment.** Brand red currently lives in the nav
    pill glow and top progress. Add exactly two more: the α sigil hover state,
    and the active portfolio row marker in the switcher. It should whisper
    "alpha" without touching data semantics. `components/shell/brand.tsx`,
    `PortfolioSwitcher.tsx`. **QW**
15. **Tinted semantic panels.** The risk coverage banner, sync banner, and
    theta's warnings each hand-roll warn styling. One `.panel-tinted`
    (pos/neg/warn/info) recipe: 4% tint fill, 20% tint border, matching icon
    dot. `app/globals.css`, `components/ui/SyncBanner.tsx`, `app/risk/page.tsx`,
    theta call sites. **QW**
16. **Tokenize the ambient washes.** Hero glow blobs restate rgba tuples
    (Overview hero, theta dashboard, lock screen). Name them
    (`--wash-pos/neg/vio`) and give theta's dashboard blobs a static-with-slow-
    drift treatment instead of two infinite loops (motion economy applies to
    atmosphere too). `app/page.tsx`, `app/theta/page.tsx`. **QW**
17. **A `.glass` recipe.** Sticky bars use `bg-black/80 backdrop-blur-md`,
    palette uses its own mix. One named recipe so every translucent surface has
    the same opacity/blur/hairline. **QW**
18. **Interactive-card hover elevation.** `panel-hover` brightens the border
    and adds `shadow-pop`; also step the fill to `--surface-2` on hover for
    cards that are *links* (Discover ideas, theta account cards) so clickable
    panels physically rise. `app/globals.css`. **QW**
19. **Chart gridline/track discipline.** `--color-track` exists; audit every
    chart for hand-rolled rgba slate and converge (Radar rings, Scatter grid,
    Histogram baselines, theta bars). `components/charts/*`. **QW**
20. **Status hue family.** `--color-live` was minted for the feed dot; extend
    the idea into a documented family — live (green-dark), stale (amber),
    degraded (warn), synthetic/sample (violet) — and use it for the LIVE
    indicator, provenance dots, theta's SAMPLE DATA tag, and the new status
    center (§D). One vocabulary for "how alive is this number." **M**
21. **Contrast audit on tinted text.** `--color-faint` cleared AA on pure
    panel; verify it still clears on `--surface-2/3` tiles and tinted panels,
    nudge if not. **QW**
22. **Focus ring on dark charts.** Keyboard focus for interactive SVG elements
    (donut legend buttons, treemap cells if made focusable) needs the same
    `--accent-focus` ring; today only HTML elements get it. **QW**

### C. Motion — the physics, named

23. **Name the motion tokens.** `--ease-signature: cubic-bezier(0.22,1,0.36,1)`,
    `--dur-fast: 150ms`, `--dur-base: 220ms`, `--dur-slow: 350ms`,
    `--dur-draw: 700ms` in `@theme`, with a globals.css comment mapping each to
    its use (interaction / entrance / chart draw). Code references become
    self-documenting. **QW**
24. **Write the motion doctrine.** A 20-line `docs/design/motion.md`: entrances
    play once (firstView), interactions always spring, live data flashes
    directionally, atmosphere never loops faster than 6s, everything respects
    reduced motion. V1 built the system; V2 writes its constitution so future
    features can't drift. **QW**
25. **Chart entry grammar.** Codify per-mark entrances: lines *draw*
    (pathLength), bars *rise*, arcs *sweep*, cells *scale from center* —
    already mostly true; audit Histogram/Radar/Sankey/theta bars for
    conformance so every first paint feels like one hand. **M**
26. **The tick wave.** When a 60s poll reprices many rows at once, stagger the
    cell flashes top-down by ~30ms instead of firing simultaneously — the
    table ripples like a tape. Scoped to the price column, capped at ~15 rows.
    `app/page.tsx` HoldingRow + `useLiveData` timestamp. **M**
27. **Treemap hover lift.** Active cell: +1.5px translate, stroke brighten
    (exists), and a faint cast shadow via SVG filter — cells become tiles under
    a light, matching the panel physics. `components/charts/Treemap.tsx`. **QW**
28. **Springy legend/list reorders.** Donut legend and theta budget list
    re-sort with layout springs like the holdings table does — any list that
    can reorder, springs. `components/charts/Donut.tsx`,
    `app/theta/page.tsx`. **QW**
29. **Scroll-linked report reveals.** On the screen version of `/report`,
    sections fade+rise 12px as they enter the viewport (whileInView, once).
    Print unaffected. `app/report/page.tsx`. **QW**
30. **Palette open refinement.** Overlay scale 0.98→1 with 8px rise at
    `--dur-fast`; rows cascade 20ms. Micro, but ⌘K is the most-seen motion in a
    keyboard user's day. `components/shell/CommandPalette.tsx`. **QW**
31. **Reduced-motion sweep for ambient loops.** theta's hero blobs and any
    infinite `animate` arrays should check reduced motion (MotionConfig covers
    transforms, but verify opacity loops die too). **QW**
32. **Route aura crossfade timing.** PageAura's 0.7s drift is right; sync the
    top-bar group label change with a 150ms fade so section changes feel like
    one event, not two. `components/shell/AppShell.tsx`. **QW**

### D. Shell, navigation & wayfinding — the cockpit

33. **The market pulse strip** *(inherited V1 Tier 4)*. A right-aligned tape in
    the desktop top bar: SPX · NDX · 13-wk yield, each as symbol + compact
    change with directional tint, from `/api/cma` + `/api/quotes` (SPY/QQQ
    proxies), refreshed with the existing poll. Click → Market Analysis. The
    single highest "this thing is alive" feature remaining.
    `components/shell/AppShell.tsx`. **M**
34. **The status center.** Promote the LIVE tooltip to a click-popover on
    surface-3: per-provider rows (quotes / fundamentals / CMA / news — plus
    SimpleFIN in theta) with status-hue dots, last-success time, cache age, and
    the refresh button relocated inside. Honesty, given a control panel.
    `AppShell.tsx`, `ThetaShell.tsx`, `useLiveStatus`. **M**
35. **Portfolio switcher, elevated** *(inherited)*. Menu rows gain last-known
    value + a tiny sparkline where history exists, provenance-labelled ("as of
    last open") per the ethos; active row gets the red marker (§B14).
    `components/shell/PortfolioSwitcher.tsx`. **M**
36. **Collapsible icon-rail sidebar.** A toggle (and `[` shortcut) collapsing
    the sidebar to a 56px icon rail with tooltips — analysts want the pixels
    for charts. Width system already exists; add a collapsed state to
    `useSidebarWidth`. Both shells. **M**
37. **Nav rows carry state.** Right-aligned micro-meta on specific rows: a
    status-hue dot on Intelligence when a fresh brief is cached, on Patch Notes
    when an unseen entry ships (localStorage last-seen), on theta's Recurring
    when a new subscription was detected. The nav becomes a glanceable index.
    `components/shell/SidebarNav.tsx` (`meta` slot on NavItem). **M**
38. **A keyboard map (`?`).** Overlay listing every shortcut (⌘K, `/`, `[`,
    j/k where added, R refresh) in kbd chips, grouped by surface. Ships the
    unfinished V1 "kbd chips in tooltips" item as a single surface instead.
    New `components/shell/KeyboardMap.tsx`, mounted in both shells. **M**
39. **Single-key nav chords (g then o).** Linear-style: `g o` Overview, `g r`
    Research, `g m` Market… shown in the keyboard map and palette hints.
    `CommandPalette.tsx` infrastructure. **M**
40. **Mobile bottom tab bar.** Replace the scroll-strip-only mobile nav with a
    fixed bottom bar of the 4 pillar routes + a "More" sheet reusing the
    palette list. The scroll strip stays for the long tail.
    `components/shell/SidebarNav.tsx` MobileNavStrip. **A**
41. **Perform the α/θ duality in-shell.** Replace the dimmed-word app switcher
    with the two serif glyphs side by side (active one ink, sister faint), a
    layout-spring underline that slides between them, and a 250ms aura wash on
    switch. The portal's idea, performed at the top of every day.
    `components/shell/brand.tsx` AppTitle. **M**
42. **Cross-app palette actions.** ⌘K in alpha should offer "theta: Dashboard"
    (and vice versa) when the sister app has data — the portal as one product.
    `AppShell.tsx`/`ThetaShell.tsx` command lists. **QW**
43. **Sticky sub-headers in long pages.** Research fundamentals and the report
    get section headers that stick under the top bar with the `.glass` recipe —
    orientation during deep scrolls. **M**
44. **Breadcrumb value in the top bar.** When scrolled past the hero, the top
    bar's center label gains the live net value in mono (crossfade in) — the
    number follows you. `AppShell.tsx` + a scroll observer. **M**
45. **"What's new" moment.** When PATCH_NOTES gains an entry since last visit,
    a one-time toast links to Patch Notes; the nav dot (§37) persists until
    seen. `lib/data/patchNotes.ts` + shell. **QW**
46. **Command palette: recents + context.** Track last 5 executed commands
    (localStorage) shown first when empty; pages can contribute contextual
    commands ("Export this report", "Re-run simulation") via a provider.
    `CommandPalette.tsx`. **M**

### E. Charts & data storytelling — the narration layer

47. **An annotation primitive.** One `<ChartFlag>` (dot/line + 10px mono chip,
    ChartTooltip styling) usable by any SVG chart for point events and
    reference levels. Everything below builds on it.
    New `components/charts/ChartFlag.tsx`. **M**
48. **Earnings markers on PriceChart.** `fundamentals.earningsDate` exists —
    draw upcoming/past earnings as flags on the Research chart. The chart
    starts explaining its own spikes. `components/charts/PriceChart.tsx`,
    `app/research/page.tsx`. **M**
49. **Dividend ex-date ticks on PriceChart** where the dividends endpoint has
    them, toggleable in the range row. **M**
50. **Forecast low-point flag.** theta's cash-flow forecast engine already
    computes the running-balance low; annotate it on the chart with the date
    and the runway figure. `app/theta/cashflow/page.tsx`. **QW**
51. **Fan chart percentile chips.** Label P10/P50/P90 at the right edge with
    values; hover shows a vertical distribution readout at the hovered year
    (probability above target at t). `components/charts/FanChart.tsx`,
    `ProjectionFan.tsx`. **M**
52. **Histogram: shaded loss region + markers.** Tint the sub-zero (or
    sub-initial-value) region rose at 4%, flag median and target with
    ChartFlags. `components/charts/Histogram.tsx`. **QW**
53. **Sparkline 2.0.** Gradient area fill (accent→transparent), endpoint dot,
    optional min/max ticks — the hero net-worth trend inherits PriceChart's
    language at small scale. `components/charts/Sparkline.tsx`. **QW**
54. **Sparkline hover readout.** The theta hero trend is mute on hover; add the
    crosshair + month/value chip via ChartTooltip. **QW**
55. **Correlation heatmap seriation.** Order symbols by hierarchical-cluster
    similarity instead of book order so correlated blocks emerge visually —
    the single biggest "wow" available in Correlation, pure math, no deps.
    `lib/analytics/correlation.ts` ordering helper + `Heatmap.tsx`. **A**
56. **Heatmap cross-dim.** Hovering a cell dims other rows/columns and shows
    both tickers' logos in the tooltip. `components/charts/Heatmap.tsx`. **QW**
57. **Scatter quadrant labels + benchmark point.** Factor scatter gets faint
    corner labels ("high quality · cheap") and an SPX reference point — the
    chart becomes self-reading. `components/charts/Scatter.tsx`,
    `app/benchmark/page.tsx`. **QW**
58. **Radar benchmark overlay.** Dashed SPX profile behind the portfolio shape
    (data exists in benchmark profiles); fill gets a soft radial gradient.
    `components/charts/Radar.tsx`. **QW**
59. **Treemap sector mode.** A Holdings/Sector segmented toggle: cells group
    under faint sector containers with animated regrouping (layout springs on
    cell positions). Ambitious, spectacular, honest.
    `components/charts/Treemap.tsx`, `app/page.tsx`. **A**
60. **Donut center enrichment.** Hovered slice's center readout adds the
    day-change of that holding (data on hand) — glance value with zero new
    chrome. `components/charts/Donut.tsx`. **QW**
61. **A shared Legend primitive.** Swatch + label + value + optional
    percentage, used by Donut's list, Risk's asset classes, theta's spending —
    every legend currently hand-rolled. `components/charts/Legend.tsx`. **M**
62. **Axis primitives.** `<AxisX>/<AxisY>` (10px mono faint, track-color grid)
    so PriceChart/Histogram/Scatter/theta bars stop restating axis code and
    can't drift. **M**
63. **"No data" hatch.** One faint diagonal-hatch SVG pattern for chart regions
    with no coverage (region mix, sparse history) — honesty with a uniform
    texture instead of ad-hoc empty gaps. `components/charts/*`. **QW**
64. **Gauge reference bands.** Beyond the benchmark tick, allow a faint band
    (e.g. "typical equity book 12–20% vol") behind the arc — reads instantly
    against Risk's published bands. `components/ui/Gauge.tsx`. **M**

### F. Tables — one lathe

65. **Extract the table system.** The Overview table is the spec; extract
    `components/ui/Table.tsx` (header cell with sort affordance, numeric cell,
    footer aggregate row, sticky-glass header, row-link chevron) and migrate
    Dividends, Rebalance trades, Quality scorecard, theta Transactions onto it.
    The app's tables finally come off one lathe. **A**
66. **Sticky header inside scrolling cards** with the `.glass` recipe once
    tables exceed viewport — Stripe's move. Part of §65. **M**
67. **Density toggle.** Comfortable/compact row height (44→34px), persisted
    per-app in localStorage, offered in the table header right slot — terminal
    users want compact. **M**
68. **Row expansion on Overview.** Space/click-chevron expands a holding row
    inline: 6-month sparkline + 4 key fundamentals + "Open in Research". Enter
    still navigates. The dashboard answers one level of "why" without leaving.
    `app/page.tsx`. **A**
69. **Bulk selection in theta Transactions.** Checkbox column, floating
    action bar (recategorize / hide / delete N) on surface-3 — the highest
    -leverage workflow gap in theta. `app/theta/transactions/page.tsx`. **A**
70. **Month group headers in Transactions** that stick while their month
    scrolls, with month totals right-aligned. **M**
71. **Category color rail.** theta transaction rows carry a 2px category-color
    left edge (mirroring alpha's symbol accent edge) — instant scanability,
    shared grammar between the apps. `app/theta/transactions/TxRow.tsx`. **QW**
72. **Skeleton rows.** Table-shaped skeletons (header + N ghost rows) for
    table-first pages, part of the per-shape skeleton set (§89).
    `components/ui/Skeleton.tsx`. **QW**

### G. Page compositions — alpha

73. **Research: the terminal** *(inherited V1 Tier 4 — the flagship)*. Three
    zones: left rail (your holdings + watchlist, j/k to move, live day-change
    per row), center stage (sticky symbol header with live price + the chart),
    right/below panels (fundamentals, analyst, in-your-book). The rail replaces
    QuickPicks chips. This is the page that earns the screenshot.
    `app/research/page.tsx`. **A**
74. **A watchlist.** Symbols saved without positions (localStorage/user blob,
    `lib/watchlist.ts`), star toggle in Research header and palette action —
    feeds the rail (§73) and a compact Overview module. **M**
75. **Overview: session ribbon.** A slim strip above the holdings table:
    today's best/worst movers (3 chips each with logo + %), session state
    (pre/post-market from the quotes proxy). The daily story at a glance.
    `app/page.tsx`. **M**
76. **Risk: verdict header.** Lead with a one-line composed verdict ("Runs
    hotter than the index, diversification thin — concentration is the story")
    assembled from existing flags — the page states its thesis, then proves it.
    The concentration flag logic already exists. `app/risk/page.tsx`. **M**
77. **Risk: factor contribution waterfall.** Which names contribute most to
    portfolio beta/vol (weights × betas already computed) as a compact
    contribution bar list — from "what is my risk" to "where does it come
    from". `app/risk/page.tsx`, `lib/analytics/risk.ts` exposure. **M**
78. **Intelligence: the morning-paper read.** Brief sections numbered in
    tracked mono ("01 · Positioning"), the headline in the display scale with
    the serif eyebrow moment, news items with source + read-state dots. The AI
    prose style (§11) applies. `app/intelligence/page.tsx`. **M**
79. **Dividends: the income year.** A 12-month payment strip (dot = payment,
    size = amount, hover chip) above the projection — income as a calendar
    rhythm, from data the page already has. `app/dividends/page.tsx`. **M**
80. **Rebalance: diff view.** Trades rendered as before→after weight bars with
    an animated arrow between (current bar shrinks, target grows on reveal) —
    a rebalance is a diff; show it like one. `app/rebalance/page.tsx`. **M**
81. **Optimizer: objectives as cards.** The eight objectives as a 2×4 grid of
    mini-cards (icon + one-line philosophy), selected card lifts with the
    accent ring; frontier chart center-stage with the current/optimal points
    pulsing once on solve. `app/optimizer/page.tsx`. **M**
82. **Scenarios: severity spines.** Each scenario card carries a left color
    spine scaled to impact, ordered worst-first; a small contribution waterfall
    per scenario on expand. `app/scenarios/page.tsx`. **M**
83. **Monte Carlo: controls as a rail.** Sliders move into a right-hand sticky
    rail (desktop); headline becomes the probability ring + "in 2036: P50
    $X" sentence; percentile table under the fan. The simulation reads as an
    instrument, not a settings form. `app/montecarlo/page.tsx`. **M**
84. **Market: layer weights, explained.** Each LayerCard gets a micro "earned
    weight" meter with a tooltip decomposing it (coverage × agreement ×
    stability — the engine exposes these) — the no-hand-tuning philosophy made
    visible, which *is* the product's credibility. `components/market/LayerCard.tsx`. **M**
85. **Quality: letter-grade moments.** The scorecard's 0–100 scores gain
    compact letter chips (A–F, tinted) next to the bars — instantly legible
    hierarchy the way the report's KPI grid already is. `app/quality/page.tsx`. **QW**
86. **Benchmark: assumption provenance chips.** Each editable assumption shows
    its preset lineage ("10-yr avg · edited") and a reset-to-preset ghost
    button; presets carry as-of dates. `components/benchmark/AssumptionsPanel.tsx`. **M**
87. **Import: the launch pad.** Two-column: dropzone (with a live example of
    the expected header) + right column "or start from" (demo book · sample
    CSV · empty). Parse preview gets error rows tinted with row-level messages.
    First contact deserves first-class. `app/import/page.tsx`. **M**
88. **Patch Notes: the changelog as timeline.** Version chips on a hairline
    spine, category tags (Design/Analytics/Data), the serif α as period marks —
    a brag surface, Linear-style. `app/patch-notes/page.tsx`. **QW**

### H. theta

89. **Dashboard: add runway.** The hero stat row gains "Runway — Xmo at
    current burn" (forecast engine exposes it) — the single most emotionally
    important personal-finance number, currently buried in Cash Flow.
    `app/theta/page.tsx`. **QW**
90. **Net worth: composition area.** Stacked liquid/invested/liability area
    chart over time (history engine has the walk) above the account list, with
    milestone flags (crossed $0, new high). `app/theta/networth/page.tsx`. **A**
91. **Health: reference-band bars.** Each metric renders as a band bar (the
    published healthy range faint, your position a dot with the score chip) —
    the scorer's bands become visible, turning numbers into judgments.
    `app/theta/health/page.tsx`. **M**
92. **Debt: the decay chart.** Balance-decay curves per liability under the
    chosen strategy, avalanche vs snowball as a ghost-overlay comparison, and
    the headline "debt-free by Mar 2029 · $4,310 interest saved vs minimums".
    The engine computes all of it; none is charted today.
    `app/theta/debt/page.tsx`. **A**
93. **Budgets: pace spines.** Each budget bar gets a faint tick at
    "elapsed-month fraction" so over/under-pace is visible before the limit is
    hit; over-pace bars warm gradually rather than snapping red.
    `app/theta/budgets/page.tsx`, `components/theta/bits.tsx`. **QW**
94. **Goals: projected-date chips.** Ring grid rows add "on track · Jun 2027"
    / "at risk" chips from the feasibility engine; completing a goal triggers
    the one-time mint shimmer (§118). `app/theta/goals/page.tsx`. **QW**
95. **Recurring: price-creep sparks.** Each detected subscription row carries a
    tiny amount-over-time sparkline; creep flagged with a warm delta chip.
    Sort by annualized cost. `app/theta/recurring/page.tsx`. **M**
96. **Accounts: provenance + trend.** Account cards show sync provenance
    (SimpleFIN dot vs "manual"), last-sync age, and a balance spark where
    history exists; linked-portfolio accounts show the α glyph — the bridge
    made visible. `app/theta/accounts/page.tsx`. **M**
97. **Cash flow: the low-point story.** Lead with the annotated forecast
    (§50) and a sentence: "Lowest point $1,240 on Jul 28, after rent" — the
    engine knows; say it. `app/theta/cashflow/page.tsx`. **M**
98. **Projection: parity with alpha.** theta's fan adopts alpha's Monte Carlo
    grammar (percentile chips, probability ring, assumption provenance from
    Settings) so the sister analytics feel like one family.
    `app/theta/projection/page.tsx`. **M**
99. **Intelligence: ledger brief, editorial.** Same §78 treatment over the
    money brief — numbered sections, reading type, AiMeta chip.
    `app/theta/intelligence/page.tsx`. **QW**
100. **Settings: preset provenance.** Assumption presets labelled with their
     basis ("base · long-run US averages"), edited fields marked, reset ghosts
     — mirrors §86 so both apps treat assumptions identically.
     `app/theta/settings/page.tsx`. **QW**
101. **Sample-data vocabulary, unified.** alpha's amber "Demo" pill and theta's
     violet SAMPLE DATA mono tag become one component with per-app accent —
     one concept, one shape. `components/shell/*`. **QW**
102. **θ watermark empty states.** theta's empties get the serif θ treatment
     (§2) with per-page ghost charts (fan for Projection, bars for Cash Flow).
     `components/theta/ui.tsx`. **QW**

### I. States — every screen has a best self

103. **Per-shape skeletons** *(inherited)*. `PageSkeleton` variants —
     `table`, `chart-grid`, `split`, `terminal` — matched per page so the ghost
     predicts the real layout. `components/ui/Skeleton.tsx` + call sites. **M**
104. **Page-specific ghost previews.** Empty states preview their own chart
     (faint fan on Monte Carlo, heatmap on Correlation, treemap on Overview)
     via a tiny `ghostData.ts` feeding the real components at 20% opacity —
     the V1 idea, completed page-by-page. `components/ui/EmptyState.tsx`. **M**
105. **One DegradedNotice primitive.** The offline/coverage/provider-down
     messaging converges on a single tinted-panel component (§15) with
     status-hue dot and retry — currently three dialects across the apps. **QW**
106. **AI-disabled cards, unified.** The "set ANTHROPIC_API_KEY" note exists in
     several shapes; one `AiDisabledCard` with consistent copy and a docs
     link. **QW**
107. **Error boundary with retry.** `ErrorBoundary` gains a "Try again" that
     remounts its subtree, plus the ghost-chart texture behind the message —
     failures stay inside the design language. `components/ui/ErrorBoundary.tsx`. **QW**
108. **First-run checklist.** After first entering with no data, Overview hosts
     a dismissible 3-step card (Import → Explore → Tune assumptions) with
     progress ticks — onboarding without a tour. `app/page.tsx`. **M**
109. **Palette empty state.** No-match state in ⌘K suggests ticker search and
     shows the `g`-chord hints — dead ends teach. `CommandPalette.tsx`. **QW**
110. **Report generation state.** `/report` shows a brief "composing dossier"
     sequence (sections check in) before print — the document assembling
     itself. `app/report/page.tsx`. **QW**

### J. Micro-interactions — the details batch II

111. **Overview hover-sync.** One shared hover context on Overview: hovering a
     donut slice, treemap cell, or table row highlights the same symbol across
     all three (accent edge + slice lift + cell stroke). The dashboard becomes
     one organism. `app/page.tsx` + chart `activeId` props. **M**
112. **Click-to-copy figures.** Clicking any Stat/hero value copies the raw
     number with a "Copied" toast — analyst muscle memory. `components/ui/Stat.tsx`. **QW**
113. **Scrub-to-edit assumptions.** Drag horizontally on numeric assumption
     fields to scrub values (Figma-style), double-click to type. Benchmark +
     theta Settings. **M**
114. **Slider value bubbles.** Monte Carlo/Scenario range inputs show a small
     mono value chip above the thumb while dragging; detents at round values.
     `app/globals.css` range styling + pages. **QW**
115. **Ticker logo peek.** Long-hover on any TickerLogo pops a mini card (name
     · price · day change) via ChartTooltip — pre-answer before navigating.
     `components/ui/TickerLogo.tsx`. **M**
116. **Sigil breath.** The α mark pulses opacity once (2%) when a refresh
     lands fresh quotes — the brand acknowledging the heartbeat. Imperceptible
     until noticed; unforgettable after. `components/shell/brand.tsx`. **QW**
117. **Sort affordance polish.** Sorted column's figures brighten one step
     (mute→ink) so the active sort is legible without looking at the header. **QW**
118. **The goal shimmer.** Completing a theta goal (crossing 100%) plays a
     single 800ms mint radial shimmer across its ring — once per goal ever
     (persisted). Earned theater, not confetti. `app/theta/goals/page.tsx`. **QW**

### K. Flagship bets — schedule deliberately

119. **The first-import moment** *(inherited)*. The one performance the product
     owes its user: on the session of the first real CSV import, Overview
     conducts — hero counts up from 0, treemap tiles assemble, table rows
     cascade — a deliberate 2s overture, marked done in localStorage, never
     repeated. All the pieces exist; this is choreography, not construction.
     `app/page.tsx`, `lib/firstView.ts`. **M**
120. **Research terminal + watchlist** (§73–74) as one release — the flagship
     page, marketed in Patch Notes with screenshots. **A**
121. **Household view.** An aggregate read across the portfolio set (sum value,
     blended allocation, per-portfolio contribution) as a switcher option —
     honest about non-active books being last-known. The multi-portfolio store
     shipped; this is its payoff. `lib/store.tsx`, new `/household` or switcher
     mode. **A**
122. **The tape, complete.** Pulse strip (§33) + status center (§34) + tick
     wave (§26) + session ribbon (§75) shipped as one "alive" release — the
     shell's transformation into a cockpit, felt in a single update. **A**
123. **Command palette verbs.** Arguments and actions: "cash 5000" sets cash,
     "compare NVDA AMD" opens a research compare, "note AAPL earnings" → the
     palette graduates from navigation to command line. **A**
124. **A design gallery page.** `/design` (dev-only route or doc): every
     primitive, chart, and state rendered live — the system made inspectable,
     onboarding future contributors and preventing drift. The CLAUDE.md of the
     visual language. **M**

---

## 5. Sequencing — six release trains

1. **"The voice"** — §A items 1–10 + §B14–16 + §G85, 88. Typography ramp, serif
   signature, numeral craft, eyebrow doctrine. Small diffs, app-wide lift,
   zero risk.
2. **"The cockpit"** — §D33–35, 37, 45 + §J116. Pulse strip, status center,
   switcher, nav state. The shell starts feeling connected.
3. **"The narration"** — §E47–54, 57–58, 60 + §H50/97. Annotation primitive
   and its first eight consumers. Charts start telling stories.
4. **"One lathe"** — §F65–67, 71–72 + §I103–107. The table system and the
   state system, extracted and propagated.
5. **"theta's depth"** — §H89–102. The engines surfaced; theta reaches visual
   parity with alpha's analytics grammar.
6. **"The flagship"** — §K119, 120, 122 staged over successive releases;
   §K121/123 as appetite allows.

Quick wins (§ tagged QW) can ride along any train touching their files.

---

## 6. Guardrails — unchanged, plus three

All V1 guardrails stand: no chart library, no light app theme, no glass spree,
never trade honesty for looks, depth before glow, subtract motion over time,
keep the voice.

V2 adds:

- **The serif is a signature, not a font.** If the Georgia italic appears more
  than ~4 places per app, it stops being a signature. Resist.
- **Annotate facts, not opinions.** ChartFlags mark computed events (earnings
  dates, low points, thresholds) — never editorial judgments dressed as data.
  Judgments live in copy and AI sections, clearly voiced.
- **Theater must be earned and single-use.** Conducted moments fire on real
  achievements (first import, goal completion, fresh brief) exactly once. Any
  moment that could play twice a day is chrome, not theater — cut it.
