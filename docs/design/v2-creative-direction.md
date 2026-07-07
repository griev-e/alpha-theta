# V2 Creative Direction — alpha / theta

*The second design horizon. The first roadmap (`premium-roadmap.md`) took the
frontend from "good MVP" to "engineered object." V2 is about what separates an
engineered object from an **instrument with a soul**:*

> **"From a terminal you respect to an instrument you feel."**

Five ambitions: a confident typographic voice, one light model finished into
every corner, charts that narrate instead of just render, a shell that feels
like a cockpit, and a small set of earned, once-only theatrical moments.

*No code ships with this document.*

---

## Shipped

Four PRs have landed against this catalogue, merged to `main`:

- **#127 — Foundation.** Display type scale, the serif signature (watermark
  glyphs, eyebrow ligature), motion tokens (`--ease-signature`, `--dur-*`),
  accent ramps, `.panel-tinted`, wash tokens, AI prose editorial type, and a
  first wave of chart polish (Sparkline 2.0, Histogram target line, Scatter
  quadrant labels, Donut day-change, click-to-copy, sigil breath, goal
  shimmer, nav dot).
- **#128 — Flagships.** Collapsible icon-rail sidebar (both shells), the
  Research terminal rail + watchlist (§73/74/120), the market pulse strip.
- **#129 — Medium tier.** Fan chart percentile chips, scenario severity
  spines, theta Health reference-band bars, Recurring price-creep sparks,
  the `?` keyboard map.
- **#130 — Hard tier.** The `ChartFlag` annotation primitive, PriceChart
  event markers (ex-dividends), Overview hover-sync (donut↔treemap↔table),
  the status center popover, and the `Legend`/`Axis` chart primitives
  (adopted in two consumers each; broader sweep still open — see §62/65
  below).
- **Correlation heatmap seriation** (§55). Average-linkage (UPGMA)
  hierarchical clustering on `1 − ρ`, reordering the matrix so correlated
  blocks sit adjacent instead of scattered across book order — a
  "Clustered / Book order" toggle on the Correlation page, clustered by
  default. Pure math, no new dependency. `lib/analytics/correlation.ts`
  (`seriationOrder`, `seriate`), `app/correlation/page.tsx`.
- **#133 — Quick-win sweep (two parts, ~38 items).** A broad pass across the
  low-effort tier. Part 1 (foundation/charts/pages/interactions): the eyebrow
  dialect rule, figures-dictionary note, `motion.md` doctrine, `.glass` sticky
  headers, palette open/empty-state polish, route group-label crossfade,
  data-aware cross-app palette, treemap hover-lift, histogram loss region,
  Sparkline hover readout, heatmap tooltip logos, Donut legend spring, alpha-red
  accents (sigil hover, switcher spine), Intelligence numbered sections, Patch
  Notes timeline, dashboard runway, sort affordance, what's-new toast. Part 2
  (shared primitives + polish): `AiDisabledCard`/`EnvKey`, `DegradedNotice`, and
  `SampleDataTag` converge the AI-off / degraded / sample-data surfaces each page
  had re-spelled; `.panel-link` on Discover cards; a `TableSkeleton` variant for
  table-first pages; a `RangeSlider` value-bubble primitive (Monte Carlo,
  Scenarios, Optimizer); report scroll-reveals (print-safe) + a "composing
  dossier" export sequence; theta Settings preset provenance mirroring the
  Benchmark page; and accessibility audits — reduced-motion gating of the theta
  hero glow, text-balance/pretty on shared headings, one stat-stack rhythm, and
  a `--color-faint` bump to clear WCAG AA on raised surfaces. Several audited
  items (gridlines, chart focus rings, benchmark scatter points, `tnum` coverage,
  the no-data hatch) were verified already-compliant or honestly not-applicable
  rather than re-built.

- **Medium-tier close-out.** The remaining eight 1–3-day items, finishing the
  tier. The **status-hue family** documented as one vocabulary + a shared
  `StatusDot`, swept across the shell/status-center/session-ribbon and the
  sample/provenance dots (§20); the **chart entry-grammar audit** — PriceChart's
  line now draws instead of popping, and the mark grammar written next to
  `--dur-draw` (§25); the **Axis sweep** finished by moving ProjectionFan onto
  the shared `AxisX/AxisY` (+ a right-side label option) (§62); **sticky
  sub-headers** — a condensed identity bar on Research and pinned `h2` sections
  in the report (§43); **page-specific ghost previews** — a faint fan on Monte
  Carlo, a heatmap on Correlation, from a tiny `ghostData` feeding the real
  charts (§104); the **ticker-logo peek** — a portal mini-card (name · price ·
  day change) on long-hover that never clips in a scroll container (§115); the
  dev-only **/design gallery** rendering every primitive, chart, and state
  (§124); and the **α/θ duality in-shell**, restrained — an accent underline +
  entrance aura rather than a third serif next to the Sigil (§41).

- **#134 — Medium-tier sweep.** Working the 1–3-day tier. Shipped:
  the `<Money>` dimmed-symbol numeral hierarchy (§4, with `splitMoney`);
  the theta cash-flow forecast chart leading with the low-point story (§97) which
  also annotates the running-balance low (§50); theta Projection reworked to
  alpha's Monte Carlo composition — sentence-first hero, fan as hero, Settings
  provenance rail (§98); Gauge reference bands (§64); the Overview session ribbon
  — clock-derived session state paired with the live/imported truth, plus
  best/worst movers (§75); the first-import overture (§119); the first-run
  checklist on the empty Overview (§108); the report cover page + table of
  contents + `@page` page numbers (§12); the net value in the top bar on scroll
  (§44); the tick wave (§26); the Import launch pad (§87); single-key nav chords
  `g`+letter with a keyboard-map section and palette empty-state hints (§39/§109);
  the portfolio switcher's last-known values + provenance (§35); per-shape
  skeletons — chart-grid / split / terminal (§103); command-palette recents (§46);
  Figma-style scrub-to-edit on theta's assumption fields (§113); and a
  new-subscription dot on theta's Recurring nav row (§37, its client-computable
  half; the Intelligence fresh-brief dot needs a server signal). The rest of the
  tier landed in the close-out above.

- **The table system — one lathe (§65–67, 70, 72).** The Overview holdings
  table's grammar extracted into `components/ui/Table.tsx`: a column-def-driven
  component owning the sortable header (the rotating chevron + `aria-sort` +
  active-column brighten, §117), a **sticky-glass header** that pins as the page
  scrolls (§66, sticky on the cells since Chromium ignores it on `<thead>`), a
  **density toggle** persisted per app via `useSyncExternalStore` (§67), a
  footer aggregate slot, and a row-link chevron — cells stay bespoke through a
  `cell(row)` render so each page keeps its bars/chips/sparks. The
  **Dividends** per-holding table migrated onto it (now sortable on every
  column, sticky, dense-able); **theta Transactions** gained sticky **month
  group headers** with a running net (§70) via a shared `TableGroupHeader`
  wrapping the existing day sub-groups, plus row density. `TableSkeleton`
  already covered the skeleton-rows ask (§72). The Overview table stays the
  bespoke reference (its hover-sync + tick-flash specializations don't reduce to
  the generic primitive); Rebalance's trade list and the Quality scorecard are
  card/flex compositions, not semantic tables, so they stay as-is.

Several other catalogue items turned out to already exist from the earlier
`premium-roadmap.md` push (risk contribution list, rebalance diff bars, the
dividends payment calendar, optimizer objective cards, the market layer
earned-weight decomposition, theta's debt decay chart, budget pace spines,
goal status chips, accounts provenance/trend, θ empty-state watermarks) —
verified in the code rather than re-built.

**Everything below this line has not shipped.** This is the working list.

---

## Biggest remaining opportunities

The five ambitious structural bets that led this catalogue have all **shipped**:

- **The table system** (§65–67, 70, 72) — `components/ui/Table.tsx`, with
  Dividends and theta Transactions migrated.
- **theta's net worth as a trajectory** (§90) — a stacked
  liquid/invested/liability area chart with milestone flags.
- **Treemap sector mode** (§59) — a Holdings/Sector toggle nesting the
  allocation-map cells under faint sector containers, morphing on regroup.
- **Command palette verbs** (§123) — a shell-owned verb parser so "cash 5000"
  (alpha) and "spent 12 coffee" (theta) act instead of navigate.
- **Household view** (§121) — an aggregate read across the whole portfolio set
  (`lib/household.ts`, `/household`, a switcher entry), honest about non-active
  books being last-known.

The first-import moment (§119), the Overview session ribbon (§75), and the
`<Money>` numeral formatter (§4) landed earlier in the Medium tier. What remains
in the catalogue below is the long tail of QW/M polish, not another headline
structural bet.

---

## The remaining catalogue

Effort: **QW** = quick win (≤ half a day) · **M** = medium (1–3 days) ·
**A** = ambitious (a week or more, schedule deliberately).

### A. Typography & numerals

3. **Unify the two eyebrow dialects.** `.eyebrow` (12px sentence-case) vs.
   the mono uppercase `tracking-[0.18em]` label (LIVE, SAMPLE DATA) both mark
   metadata with no written rule. Write it, then audit call sites.
   `app/globals.css` + sweep. **QW**
4. **Dim the furniture in numerals.** A `<Money>` formatter rendering the
   currency symbol and decimals at ~55% opacity ("$" and ".56" quiet, "12,304"
   loud) — used by `Stat`, `AnimatedNumber` call sites, theta's
   `EditableMoney`. The one typography item from the original top-8 that
   never shipped. **M**
7. **Tabular figures audit.** Sweep for stray non-`tnum` numerals (stat subs,
   badge counts, tooltip figures). **QW**
8. **Finish the `text-wrap: balance`/`pretty` sweep** across empty states, AI
   headlines, and modal titles — `PageHeader` has it, not everything does.
   **QW**
9. **A figures-dictionary note** at the top of `lib/format.ts` — compact vs.
   full rules, sign conventions, the true-minus vs. hyphen — so new surfaces
   can't drift. **QW**
10. **Optical alignment pass on stat stacks.** `Stat`, market's `StatTile`,
    theta's tiles each hand-roll label→value→sub spacing; converge on one
    spec. **QW**
12. **Report typography, finished.** Unshipped: the cover block (serif α
    watermark, portfolio name, date range, colophon), running page numbers
    via `@page` margin boxes, a mini table of contents. `app/report/page.tsx`.
    **M**

### B. Color, light & surface

14. **Give alpha's red a third moment.** The α sigil hover state and the
    active-portfolio row marker in the switcher — brand red's only two
    unclaimed spots. `components/shell/brand.tsx`, `PortfolioSwitcher.tsx`.
    **QW**
17. **A `.glass` recipe.** Sticky bars and the palette each hand-roll their
    own blur/opacity mix; name one recipe. **QW**
18. **Interactive-card hover elevation.** Step clickable cards (Discover
    ideas, theta account cards) to `--surface-2` fill on hover, not just a
    brighter border. `app/globals.css`. **QW**
19. **Chart gridline/track discipline audit.** Converge any hand-rolled rgba
    slate in Radar/Scatter/Histogram/theta bars onto `--color-track`.
    **QW**
20. **Status hue family, documented.** `StatusCenter` now uses live/stale/
    idle dots; write the family up (+ synthetic/sample) and sweep it onto
    provenance dots and theta's SAMPLE DATA tag for one shared vocabulary.
    **M**
21. **Contrast audit on tinted text.** Verify `--color-faint` still clears AA
    on `--surface-2/3` and `.panel-tinted` fills. **QW**
22. **Focus ring on dark charts.** Keyboard focus on interactive SVG
    elements (donut legend, treemap cells if made focusable) needs the same
    `--accent-focus` ring HTML controls get. **QW**

### C. Motion

24. **Write the motion doctrine.** A 20-line `docs/design/motion.md`:
    entrances play once, interactions always spring, live-data flashes are
    directional, atmosphere never loops faster than 6s, everything respects
    reduced motion. **QW**
25. **Chart entry grammar audit.** Confirm every mark type (lines draw, bars
    rise, arcs sweep, cells scale-from-center) is consistent across
    Histogram/Radar/theta bars. **M**
26. **The tick wave.** Stagger cell flashes top-down by ~30ms on a 60s
    reprice instead of firing simultaneously, capped at ~15 rows. `app/
    page.tsx` HoldingRow. **M**
27. **Treemap hover lift.** Active cell: +1.5px translate + a faint cast
    shadow via SVG filter, on top of the existing stroke-brighten.
    `components/charts/Treemap.tsx`. **QW**
28. **Springy legend/list reorders.** Donut legend and theta's budget list
    should re-sort with layout springs like the holdings table does. **QW**
29. **Scroll-linked report reveals.** On-screen `/report` sections fade+rise
    12px on scroll-into-view (once); print unaffected. **QW**
30. **Palette open refinement.** Scale 0.98→1 + 8px rise at `--dur-fast`,
    rows cascading 20ms. `CommandPalette.tsx`. **QW**
31. **Reduced-motion sweep for ambient loops.** Verify theta's hero blobs
    and any infinite `animate` arrays die under reduced motion, not just
    transforms. **QW**
32. **Route aura crossfade timing.** Sync the top-bar group-label fade with
    PageAura's drift so a section change reads as one event. **QW**

### D. Shell, navigation & wayfinding

35. **Portfolio switcher, elevated.** Menu rows gain last-known value + a
    tiny sparkline where history exists, "as of last open" provenance.
    `PortfolioSwitcher.tsx`. **M**
37. **Nav rows carry more state.** The patch-notes dot shipped; extend the
    pattern to Intelligence (fresh-brief-cached dot) and theta's Recurring
    (new-subscription-detected dot). `SidebarNav.tsx`. **M**
39. **Single-key nav chords (`g` then `o`).** Linear-style: `g o` Overview,
    `g r` Research… surfaced in the keyboard map and palette hints. **M**
40. **Mobile bottom tab bar.** Replace the scroll-strip-only mobile nav with
    a fixed bottom bar of the 4 pillar routes + a "More" sheet. **A**
41. **Perform the α/θ duality in-shell.** Two serif glyphs side by side
    (active ink, sister faint), a layout-spring underline, a brief aura wash
    on switch — the portal's idea, performed at the top of every day.
    `components/shell/brand.tsx`. **M**
42. **Cross-app palette actions, data-aware.** A generic "Switch to theta"
    action exists; extend it to contextual suggestions ("theta: Dashboard")
    when the sister app actually has data. **QW**
43. **Sticky sub-headers in long pages.** Research fundamentals and the
    report get section headers that stick under the top bar with `.glass`.
    **M**
44. **Breadcrumb value in the top bar on scroll.** Past the hero, the
    center label gains the live net value in mono (crossfade in).
    `AppShell.tsx` + a scroll observer. **M**
45. **A "what's new" toast.** The unseen-patch nav dot shipped; add the
    one-time toast on a fresh `PATCH_NOTES` entry that links to it. **QW**
46. **Command palette: recents + context.** Track last 5 executed commands
    (localStorage), shown first when empty; let pages contribute contextual
    commands ("Export this report"). **M**

### E. Charts & data storytelling

48. **Earnings markers, honestly scoped.** The fundamentals feed only
    exposes the *next* (future) earnings date — already shown in Research's
    Catalysts card. A historical earnings-date overlay on PriceChart would
    need a dated-earnings-history endpoint that doesn't exist yet; don't
    fake it with the single forward date.
50. **Forecast low-point flag.** theta's cash-flow forecast engine computes
    the running-balance low; annotate it on the chart with `ChartFlag` (date
    + runway figure). `app/theta/cashflow/page.tsx`. **QW**
52. **Histogram: shaded loss region.** The target-line chip shipped; add the
    sub-zero (or sub-initial-value) region tinted rose at ~4% opacity.
    `components/charts/Histogram.tsx`. **QW**
54. **Sparkline hover readout.** theta's hero trend sparkline is mute on
    hover; add a crosshair + month/value chip via `ChartTooltip`. **QW**
56. **Heatmap cross-dim.** Hovering a cell dims other rows/columns and shows
    both tickers' logos in the tooltip. **QW**
57. **Scatter benchmark reference point.** Quadrant labels shipped; add the
    SPX reference point to the factor scatter so it reads against the
    index, not just its own corners. `app/benchmark/page.tsx`. **QW**
59. **Treemap sector mode.** ✓ SHIPPED — a Holdings/Sector segmented toggle on
    the allocation map: `Treemap` gained a two-level nested layout (squarify
    sectors, then holdings within each) drawing faint sector containers with a
    label + total; cells carry a stable id and are positioned by an animated
    transform so the toggle springs them between layouts. Each holding files
    under its dominant sector (a fund by its largest look-through weight).
    `components/charts/Treemap.tsx`, `app/page.tsx`. **A**
62. **Finish the Axis sweep.** `AxisX`/`AxisY` shipped and are adopted in
    FanChart + the optimizer frontier; PriceChart, Scatter, and theta's bar
    charts still hand-roll their own tick code — bring them onto the shared
    primitive. **M**
63. **"No data" hatch.** One faint diagonal-hatch SVG pattern for chart
    regions with no coverage (region mix, sparse history). **QW**
64. **Gauge reference bands.** Beyond the benchmark tick, a faint band (e.g.
    "typical equity book 12–20% vol") behind the arc. `components/ui/
    Gauge.tsx`. **M**

### F. Tables — one lathe  ·  ✓ SHIPPED

65. **Extract the table system.** ✓ `components/ui/Table.tsx` — column-def
    driven (sortable header, numeric cell, footer slot, sticky-glass header,
    row-link chevron). Dividends and theta Transactions migrated; Overview
    stays the bespoke reference (hover-sync/tick-flash), and Rebalance's trade
    list + the Quality scorecard are card/flex compositions, not tables. **A**
66. **Sticky header inside scrolling cards.** ✓ Pins on the cells (Chromium
    ignores sticky on `<thead>`), opt-in via the `sticky` prop. **M**
67. **Density toggle.** ✓ Comfortable/compact, persisted per app via
    `useSyncExternalStore`; `TableDensityToggle` for the header slot. **M**
70. **Month group headers in Transactions.** ✓ Sticky month band with a
    running net (`TableGroupHeader`) above the existing day sub-groups. **M**
72. **Skeleton rows** for table-first pages, part of the per-shape skeleton
    set (§103). ✓ `TableSkeleton` in `components/ui/Skeleton.tsx`. **QW**

### G. Page compositions — alpha

75. **Overview: session ribbon.** A slim strip above the treemap: today's
    best/worst movers (3 chips each, logo + %), session state (pre/post-
    market from the quotes proxy). `app/page.tsx`. **M**
78. **Intelligence: numbered morning-paper sections.** The AI-prose reading
    type shipped; add the tracked-mono section numbering ("01 · Positioning
    · 02 · What moved") the composition doc called for. `app/intelligence/
    page.tsx`. **QW**
86. **Benchmark: assumption provenance chips.** Each editable assumption
    shows its preset lineage ("10-yr avg · edited") and a reset-to-preset
    ghost button. `components/benchmark/AssumptionsPanel.tsx`. **M**
87. **Import: the launch pad.** Compose as two columns — the dropzone (with
    a live example of the expected header) + "or start from" (demo · sample
    · empty); the parse preview takes over once a file lands. Today's page
    has the demo/sample links but not the composed first screen. `app/
    import/page.tsx`. **M**
88. **Patch Notes: the changelog as timeline.** Version chips on a hairline
    spine, category tags (Design/Analytics/Data), the serif α as period
    marks. `app/patch-notes/page.tsx`. **QW**

### H. theta

89. **Dashboard: add runway.** The hero stat row is still missing "Runway —
    Xmo at current burn" (the forecast engine already exposes it) — the
    single most emotionally important personal-finance figure, currently
    buried in Cash Flow. `app/theta/page.tsx`. **QW**
90. **Net worth: composition area.** ✓ SHIPPED — `NetWorthArea` stacks the
    liquid/invested/liability bands over time from a new
    `netWorthComposition` walk, anchored to the headline net series so the
    total agrees (`alignCompositionToSeries`); the net line rides on top,
    `netWorthMilestones` flags the $0 crossing + new high, and a hover breaks
    any month into its three bands. `app/theta/networth/page.tsx`. **A**
97. **Cash flow: lead with the low-point story.** Put the annotated
    forecast (§50) and a sentence ("Lowest point $1,240 on Jul 28, after
    rent") at the top, ahead of the historical flow bars. `app/theta/
    cashflow/page.tsx`. **M**
98. **Projection: parity with alpha.** Adopt Monte Carlo's composition
    wholesale — sentence-first hero, fan as the hero object, assumption
    provenance from Settings — so the two simulation surfaces feel like one
    family. `app/theta/projection/page.tsx`. **M**
100. **Settings: preset provenance.** Assumption presets labelled with their
     basis, edited fields marked, reset ghosts — mirrors §86. `app/theta/
     settings/page.tsx`. **QW**
101. **Sample-data vocabulary, unified.** alpha's amber "Demo" pill and
     theta's violet SAMPLE DATA tag become one component with a per-app
     accent. `components/shell/*`. **QW**

### I. States — every screen has a best self

103. **Per-shape skeletons.** `PageSkeleton` variants — `table`,
     `chart-grid`, `split`, `terminal` — matched per page so the ghost
     predicts the real layout. `components/ui/Skeleton.tsx` + call sites.
     **M**
104. **Page-specific ghost previews.** Empty states preview their own chart
     (a faint fan on Monte Carlo, a heatmap on Correlation) via a tiny
     `ghostData.ts` feeding the real components at 20% opacity.
     `components/ui/EmptyState.tsx`. **M**
105. **One `DegradedNotice` primitive.** The offline/coverage/provider-down
     messaging still has three dialects across the apps; converge on a
     single tinted-panel component with a status-hue dot and retry. **QW**
106. **`AiDisabledCard`, unified.** The "set `ANTHROPIC_API_KEY`" note exists
     in several hand-rolled shapes; one component, consistent copy, a docs
     link. **QW**
108. **First-run checklist.** After first entering with no data, Overview
     hosts a dismissible 3-step card (Import → Explore → Tune assumptions)
     with progress ticks. `app/page.tsx`. **M**
109. **Palette empty state.** No-match state in ⌘K suggests ticker search
     and shows the `g`-chord hints once §39 ships. **QW**
110. **Report generation state.** `/report` shows a brief "composing
     dossier" sequence (sections check in) before print. **QW**

### J. Micro-interactions

113. **Scrub-to-edit assumptions.** Drag horizontally on numeric assumption
     fields to scrub values (Figma-style), double-click to type. Benchmark
     + theta Settings. **M**
114. **Slider value bubbles.** Monte Carlo/Scenario range inputs show a
     small mono value chip above the thumb while dragging, with detents at
     round values. `app/globals.css` range styling + pages. **QW**
115. **Ticker logo peek.** Long-hover on any `TickerLogo` pops a mini card
     (name · price · day change) via `ChartTooltip`. `components/ui/
     TickerLogo.tsx`. **M**
117. **Sort affordance polish.** The sorted column's figures brighten one
     step (mute→ink) so the active sort is legible without the header. **QW**

### K. Flagship bets — schedule deliberately

119. **The first-import moment.** On the session of the first real CSV
     import, Overview conducts — hero counts up from 0, treemap tiles
     assemble, table rows cascade — a deliberate ~2s overture, marked done
     in localStorage, never repeated. All the pieces exist; this is
     choreography, not construction. `app/page.tsx`, `lib/firstView.ts`.
     **M**
121. **Household view.** ✓ SHIPPED — `lib/household.ts` (`buildHousehold`,
     pure) blends every book: total value, per-portfolio contribution, and a
     merged holdings list (a name held in two accounts reads as one line),
     using the active book's live values and every other's last-known. The
     store exposes it as `household`; `/household` renders the hero + per-book
     bars + a blended donut + positions table, reached from a Household entry
     in the `PortfolioSwitcher`. Honest throughout: last-known books are
     flagged. **A**
122. **The tape, complete.** The pulse strip and status center shipped; the
     tick wave (§26) and the session ribbon (§75) are the two pieces left
     before this is one "alive" release. **A** (remaining scope only)
123. **Command palette verbs.** ✓ SHIPPED — `CommandPalette` gained a
     shell-owned `verbs(query)` parser whose results surface as action rows
     above the filtered nav (transient, kept out of recents), with a `verbHint`
     example in the no-match state. alpha parses `cash <amount>` → `setCash`;
     theta parses `spent <amount> [merchant]` / `income <amount> [source]` →
     `addTransaction` against the default account, shown in the row. Amounts go
     through a shared `parseMoneyInput` ($ / commas / k·m suffixes). The
     "compare"/"note" examples are deferred — they'd need a compare route and a
     notes model that don't exist yet; the framework makes them a drop-in when
     they do. **A**
124. **A design gallery page.** `/design` (dev-only route): every primitive,
     chart, and state rendered live — the system made inspectable. **M**

---

## Sequencing

1. **The table system** — the highest-leverage structural item left
   (§65–67, 70, 72).
2. **The first-import moment** (§119) — pure choreography over existing
   pieces, high emotional payoff, contained scope.
3. **theta's net worth trajectory** (§90) + the remaining theta polish
   (§89, 97–101).
4. **The tape, completed** (§26, 75, closing §122) + shell wayfinding
   (§35, 37, 39, 41–46).
5. **State system** (§103–110) + micro-interactions (§113–117).
6. **Ambitious bets as appetite allows** — treemap sector mode (§59),
   household view (§121), command palette verbs (§123), the design gallery
   (§124).

Quick wins (§ tagged QW) can ride along any train touching their files.

---

## Guardrails

All V1 guardrails stand: no chart library, no light app theme, no glass
spree, never trade honesty for looks, depth before glow, subtract motion
over time, keep the voice.

V2 guardrails:

- **The serif is a signature, not a font.** Resist if it appears more than
  ~4 places per app.
- **Annotate facts, not opinions.** `ChartFlag`s mark computed events —
  never editorial judgments dressed as data. This is why earnings markers
  (§48) stay out until a real dated-history source exists, rather than
  faking one off the single forward date.
- **Theater must be earned and single-use.** Conducted moments fire on real
  achievements exactly once. Any moment that could play twice a day is
  chrome, not theater — cut it.
