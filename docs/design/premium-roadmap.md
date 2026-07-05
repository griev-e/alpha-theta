# Premium Frontend Roadmap — alpha / theta

*A product-design review and enhancement plan. No code ships with this document —
it is the map for taking the frontend from "good" to "exceptional" while
preserving the identity it already has.*

---

## 1. The read: what this design language is

Before recommending anything, the honest read of what the app is trying to be —
because every recommendation below is judged against it.

**The identity: an institutional trading terminal with web-native restraint.**
Bloomberg's discipline, Vercel's minimalism. The evidence:

- **A pure-black void** (`--color-void: #000`) with one flat panel surface
  (`--color-panel: #0a0a0a`) separated by hairline white borders at 8%/16%
  opacity (`--color-edge`/`--color-edge2`). No shadows on cards, no gradients on
  surfaces. Depth is drawn, not lit.
- **A strict accent economy.** Mint is the *data* accent (positive/neutral
  metrics), rose/amber are loss/warning, and each app carries exactly one
  *brand* accent — alpha's red `#c42b2b`, theta's iris — used only in the nav
  and the portal. The comment in `globals.css` distinguishing brand-red from
  data-green ("the brand can be red without those reading as losses") is
  world-class thinking already.
- **Typography as instrumentation.** Geist Sans for prose, Geist Mono +
  `tabular-nums` for every figure, a documented type scale (10–22px + hero
  34–44), tiny sentence-case eyebrows. The only serif in the system is the
  Georgia-italic α/θ sigil — a signature, currently underused.
- **Motion as physics, not decoration.** One shared easing curve
  `[0.22, 1, 0.36, 1]` everywhere, springs for layout (the nav pill), count-up
  springs for numbers (`AnimatedNumber`), `LazyMotion strict` +
  `reducedMotion="user"`. This is a real motion *system*, not sprinkled
  animation.
- **Honesty as aesthetic.** Provenance dots, coverage percentages, "models, not
  advice" methodology copy, the degraded-mode "offline · imported prices"
  status. Premium credibility here comes from truth-telling, and the UI already
  commits to it.

**What is already exceptional (protect these, don't touch):** the
`AiThinking` canvas neural field; the lock-screen portal and the
black-overlay entrance choreography; the Overview holdings table (per-symbol
accent edges, mirrored return bars, live price-flash); the sidebar Find with
`/`; the resizable sidebar with keyboard support; the print report as a light
"document"; the copy voice ("dry powder", "the morning read on your book").

**The five things keeping it at "good":**

1. **One flat elevation plane.** Panels, tiles, inputs, modals, and menus all
   sit at the same depth. Premium dark UIs (Linear, Vercel, Raycast) build 3–4
   surface steps and imply a light source; here `--color-elevated` exists but
   is used only by the tooltip, and the modal floats with *no shadow at all*.
2. **No keyboard command surface.** For a product that brands itself a
   *terminal*, the absence of ⌘K is the single loudest gap. The sidebar Find is
   80% of the model already.
3. **Charts speak different interaction dialects.** PriceChart has a crosshair
   + HTML tooltip; Donut morphs its center; Heatmap has its own crosshair
   vocabulary; **Treemap has no hover readout at all** — cells under 68×46px
   show nothing, so a 3% position is mute. Each chart is good; together they
   don't feel like one instrument.
4. **Motion replays instead of getting out of the way.** Cards, rows, and nav
   groups re-stagger on *every* route visit. The fifth time you open Overview,
   a 700ms choreography you've already seen stands between you and your
   numbers. Linear's rule: animate the first paint, be instant thereafter.
5. **Fit-and-finish tells.** Native `<select>` popovers (OS-white on the black
   theme), every alpha tab titled just "alpha", the live price flash is mint
   even when the tick is *down*, text `▲▼` glyphs instead of drawn arrows,
   one generic skeleton for every page shape.

---

## 2. Benchmark deltas

Where the named products feel more polished, and exactly what produces that
feeling:

| Product | What they do that alpha doesn't yet | The mechanism |
| --- | --- | --- |
| **Linear** | Surfaces feel stacked and lit | 3–4 surface tints + `inset 0 1px 0 rgba(255,255,255,.04)` top-edge highlight + gradient hairline borders; overlays get real shadow |
| **Linear / Raycast** | The keyboard is the primary instrument | ⌘K command menu, kbd chips on every action, single-key shortcuts |
| **Vercel** | The browser chrome participates | Per-route `<title>`, top progress bar on navigation/refresh, empty states that preview the product |
| **Vercel** | Typographic confidence | h1 at 28–32px with tight tracking; alpha's 22px title is timid relative to its 40px hero numerals |
| **Stripe** | Tables feel like one engineered system | Sticky blurred headers, footer aggregates, identical numeric alignment and header spec across every table |
| **Apple** | One light source, few glows | Depth from elevation first, glow second. alpha has glow drop-shadows on gauges/meters but zero elevation shadow on overlays — inverted priorities |
| **TradingView** | Charts read as instruments | Unified crosshair + axis readout chips, baseline split fills (green above / red below), live endpoint pulse, session state on the LIVE indicator |
| **Arc / Dia** | Signature theatrical moments | alpha already has the portal + entrance — the gap is that *AI results* and *first import* don't get the same payoff their loading states promise |
| **Notion / Perplexity** | Content arrives progressively | AI text reveals in a cascade instead of a block swap |

---

## 3. The roadmap

Each item: what, why it raises perceived quality, exactly where, and an
impact / effort grade. Ordered by leverage.

### Tier 1 — Foundation (highest impact, days not weeks)

#### 1. An elevation and light system · Impact ★★★★★ / Effort ★★
Formalize surface steps as tokens in `app/globals.css` `@theme`:
`surface-0` page (#000) → `surface-1` panel (#0a0a0a) → `surface-2` nested tile
(≈#0e0e0f) → `surface-3` overlay/popover (≈#111113 + shadow). Then add the "lit
from above" cue every premium dark UI shares:

- `.panel` gains `inset 0 1px 0 rgba(255,255,255,0.04)` (a one-line change that
  transforms every card in both apps).
- Overlays — `components/ui/Tooltip.tsx` (which currently hand-rolls its
  shadow), the theta `Modal` in `components/theta/ui.tsx` (currently
  shadowless), `PortfolioSwitcher`'s menu — share one shadow token
  (e.g. `0 16px 40px -12px rgba(0,0,0,0.9)` + the top highlight).
- Optional signature: a gradient hairline (border lighter at top, fading at
  bottom) on hero cards via a pseudo-element — the Linear/Stripe tell.

**Why:** this is the largest single gap between alpha and Linear/Vercel, and it
is nearly free. Depth is the difference between "wireframe with good taste" and
"engineered object."

#### 2. Command palette (⌘K) · Impact ★★★★★ / Effort ★★★
Promote the sidebar Find (`components/shell/SidebarNav.tsx`) into a full
overlay palette mounted in both shells: navigate (both apps' NAV arrays),
actions (Refresh live data · Switch portfolio · Load demo · Export CSV ·
Generate brief), and ticker search (reuse the `/api/search` flow behind
`components/research/TickerSearch.tsx` → jump to Research). Surface-3 panel,
kbd chips (`.kbd` exists), spring in at 150ms.

**Why:** for a self-described terminal this is table stakes at the benchmark
tier; it also makes the growing nav (17 alpha routes + 14 theta routes)
feel instant instead of long.

#### 3. One chart interaction grammar · Impact ★★★★☆ / Effort ★★★
Create a shared `ChartTooltip` primitive (same surface, type, and 140ms motion
as `components/ui/Tooltip.tsx`) plus a written convention: crosshair =
`rgba(255,255,255,0.22)` hairline; axis labels = 10px mono `--color-faint`;
hover readouts always show label · value · share. Apply across
`components/charts/*` (PriceChart, Treemap, Heatmap, Scatter, Histogram,
FanChart, ProjectionFan, Sankey).

The urgent one: **Treemap hover tooltip** (symbol · value · weight · return) —
today small cells have no readout at all (`Treemap.tsx` hides labels below
68×46px). That's a data-access gap wearing a polish costume.

#### 4. Directional live-tick feedback · Impact ★★★★☆ / Effort ★
`useFlashOnChange` in `app/page.tsx` flashes mint regardless of direction — a
red tick flashes green. Flash `--color-pos` on up-ticks and `--color-neg` on
down-ticks, scope the flash to the price cell rather than the whole row, and
give the hero Net value the same treatment (or a per-digit roll variant of
`AnimatedNumber`). **Why:** this is the moment the product proves it's live;
Robinhood/TradingView users read direction from the flash color instinctively.

#### 5. Per-route titles + top progress bar · Impact ★★★★☆ / Effort ★
Every alpha tab says "alpha" (`metadata` exists only in the root, theta, and
lock layouts). Add route-level metadata ("Risk · alpha", "Monte Carlo ·
alpha"…). Then a 2px top progress bar (brand accent at 60% opacity) during
route transitions and the manual refresh — `useLiveStatus().refreshing`
already exposes the state. **Why:** the browser chrome is part of the product;
Vercel treats it that way and it shows.

#### 6. Motion economy — animate once · Impact ★★★★☆ / Effort ★★
Session-scope the entrance choreography: first visit to a route gets the full
stagger (`Card` `i*0.06`, table rows `0.25 + i*0.035`, nav group cascade);
subsequent visits render with delays zeroed (a context flag or
per-route sessionStorage). Cap table stagger at ~10 rows. Keep all
*interaction* springs.
Files: `components/ui/Card.tsx`, `app/page.tsx` (HoldingRow),
`components/shell/SidebarNav.tsx`, `components/ui/PageHeader.tsx`.
**Why:** restraint over time is what separates choreography from friction;
this is the most Apple-flavored change on the list.

#### 7. Segmented thumb + owned Select · Impact ★★★☆☆ / Effort ★★
`components/ui/Segmented.tsx` swaps backgrounds instantly — give it a
`layoutId` sliding thumb (the nav pill already proves the spring). Replace
native `<select>` (`components/theta/ui.tsx` `Select`, plus call sites) with a
styled listbox on surface-3 — native option popovers render OS-white over the
black theme, the single most "MVP" pixel in the app today.

### Tier 2 — Signature moments (high impact, medium effort)

#### 8. Empty states that preview the page · Impact ★★★★☆ / Effort ★★★
`EmptyState` is the same sigil + copy + two buttons on every page. Instead,
each analytics page's empty state shows a ghosted, ~20%-opacity render of its
actual visualization with plausible placeholder shapes (a faint treemap on
Overview, a fan chart on Monte Carlo, a heatmap on Correlation) behind the CTA.
The charts are hand-built, so this is cheap — pass static demo arrays.
**Why:** an empty state that shows the destination converts and delights;
it's the Vercel/Notion move, executed with assets the app already owns.
Files: `components/ui/EmptyState.tsx` + a small `ghostData.ts`.

#### 9. AI reveal choreography + provenance chip · Impact ★★★★☆ / Effort ★★
The neural field is the best loading state in the app; the payoff is a plain
content swap. Reveal AI results as a cascade (each section opacity+y, 60–80ms
apart) and end every AI card with one consistent metadata chip: model ·
cached/fresh · cost · time (every AI route already returns `costUSD`;
`ModelBadge` exists). Files: `app/intelligence/page.tsx`, `app/market/page.tsx`,
`app/discover/page.tsx`, `app/rebalance/page.tsx`, `app/optimizer/page.tsx`,
`app/theta/health/page.tsx`, `app/theta/intelligence/page.tsx`.

#### 10. PriceChart to instrument grade · Impact ★★★★☆ / Effort ★★★
In `components/charts/PriceChart.tsx`: split the area fill at the dashed
first-close baseline (green above, rose below — the TradingView baseline
style); a pulsing endpoint dot when the quote feed is live; period high/low
tick annotations; and a hover-return chip (Δ from period start to the hovered
bar) next to the range `Segmented`. **Why:** Research is the page users will
screenshot; this is where chart craft is most visible.

#### 11. Page auras · Impact ★★★☆☆ / Effort ★
Overview's hero already tones an ambient glow by day-change direction — the
only page with atmosphere. Systematize: one fixed, barely-there radial tint
(≤4% opacity, top of viewport) per page family — rose for Risk, mint for
Dividends, violet for Simulation, sky for Research — rendered by `PageHeader`
or the shell. **Why:** cohesion plus subconscious wayfinding; it must be felt,
not seen. (Guardrail: if it's visible in a screenshot at a glance, it's too
strong.)

#### 12. The table system pass · Impact ★★★★☆ / Effort ★★★
Make the Overview holdings table the written spec (header type, cell padding,
numeric alignment, hover affordances), then add: sticky header with
backdrop-blur when the table scrolls; whole-row click → Research (a chevron
reveals on hover, the accent edge already exists); a footer aggregate row.
Propagate the spec to `app/rebalance`, `app/dividends`, `app/quality`, and
`app/theta/transactions`. **Why:** Stripe-grade products feel like every table
came off one lathe.

#### 13. Toast primitive · Impact ★★★☆☆ / Effort ★★
Imports route away silently; saves are invisible; `SyncBanner` covers only sync
failure. One minimal toast (bottom-right, surface-3, spring, status dot,
auto-dismiss): "Portfolio imported · 24 positions", "Copied", "Brief cached
from earlier today". Files: new `components/ui/Toast.tsx`, mounted in both
shells; call sites in `app/import/page.tsx` and the stores' save paths.

#### 14. Icon micro-motion · Impact ★★☆☆☆ / Effort ★★
The hand-drawn stroke icons are an asset. On nav-row hover, draw the icon's
stroke (`pathLength` 0→1, ~200ms) or nudge it 1px; on becoming active, a
single draw-in. Raycast/Arc use exactly this to make chrome feel alive without
moving layout. Files: `components/shell/icons.tsx`, `thetaIcons.tsx`,
`SidebarNav.tsx`.

### Tier 3 — The detail batch (each <1 hour; ship as one polish PR)

These are the "dozens of small details" that separate premium from average.
Individually invisible, collectively unmistakable:

1. Replace text `▲▼` with drawn SVG deltas (consistent rasterization across
   platforms) — `HeroDelta` and `HoldingRow` in `app/page.tsx`, theta `bits.tsx`.
2. Give the theta `Modal` the shared overlay shadow + top highlight (today it
   relies entirely on the backdrop).
3. LIVE indicator hover → tooltip with last-tick time and market session
   (pre/post-market state — the quotes proxy is already extended-hours aware).
   `AppShell.tsx` LiveDot.
4. Refresh button success micro-state: spinner → checkmark morph for 600ms when
   fresh quotes land. `AppShell.tsx` RefreshButton.
5. Provenance dot pulses once when a symbol upgrades to live after a refresh.
   `components/ui/DataSourceBadge.tsx`.
6. `text-wrap: balance` on `PageHeader` descriptions; `pretty` on card prose.
7. Focus ring color per shell: mint is alpha's; theta's should be iris. Make
   the ring color a CSS var set by each shell (globals.css `:focus-visible`).
8. Same for `::selection` — iris on `/theta`.
9. Donut hover: animate radius +2px with a spring instead of the 26→31
   stroke-width jump (`components/charts/Donut.tsx`).
10. Research symbol swap uses `AnimatePresence mode="wait"` — a blank gap
    between tickers. Crossfade instead (`app/research/page.tsx`; the same
    reasoning already documented for route transitions in `AppShell.tsx`).
11. Per-shape skeletons: `PageSkeleton` takes a `variant` ("table" | "chart
    grid" | "split") so the ghost matches the page it precedes.
12. Sidebar drag handle: faint visible grip on hover (currently invisible until
    hit). `AppShell.tsx` / `ThetaShell.tsx`.
13. Unify the demo vocabulary: alpha's amber "Demo" pill vs theta's violet
    "SAMPLE DATA" mono tag are two languages for one concept.
14. `.btn-primary` gains a loading-spinner slot — every AI CTA currently
    hand-rolls its busy state.
15. Copy-to-clipboard ghost icon on the hero net value and report figures.
16. Inner scrollers (Donut legend) show their scrollbar only on hover.
17. Audit stray non-`tnum` numerals (a few stat subs and badges).
18. Table headers: hovered sortable column gets a whisper of column highlight.
19. Print report: cover block (sigil watermark, portfolio name, date range) and
    `@page` numbers — `app/report/page.tsx`, `globals.css` print styles.
20. kbd chips in icon-button tooltips once the palette ships shortcuts
    ("R" refresh, "/" find, "⌘K" palette).

### Tier 4 — Bigger swings (schedule deliberately)

- **Research as a true terminal**: holdings/watchlist rail on the left, j/k
  ticker navigation, chart center-stage. The page is already the app's best
  candidate for a flagship layout. (`app/research/page.tsx`)
- **Market pulse strip**: SPX / NDX / risk-free tick row under the top bar —
  the CMA endpoint already fetches the data. (`AppShell.tsx`, `/api/cma`)
- **Portfolio switcher, elevated**: menu on surface-3 with per-portfolio value
  + sparkline (the store has the blobs; only the active one is live-priced —
  show last-known honestly, consistent with the provenance ethos).
- **First-import moment**: the one-time reveal after a user's first CSV — the
  existing count-ups and staggers, deliberately conducted once. This is the
  Arc-style signature moment the product has earned but never performs.

---

## 4. Guardrails — what *not* to do

- **No chart library, no light app theme, no glassmorphism spree.** Blur stays
  where it is (sticky bars, overlays). The report page is the light theme.
- **Never trade honesty for looks**: no fake sparkline data, no imputed
  metrics to fill a chart, no hiding the degraded state. The provenance system
  *is* the brand.
- **Add depth before adding glow.** The app currently has glow (gauges, meters,
  weight bars) without elevation; the fix is elevation, not more glow.
- **Subtract motion over time, never add.** Every new animation must pass:
  does it still feel right on the 50th viewing?
- **Keep the voice.** "Dry powder", "the morning read on your book" — the copy
  is part of the premium feel; new surfaces should be written, not templated.

## 5. Suggested sequencing

1. **PR "light & depth"** — Tier 1 items 1, 4, 5, 7 (tokens + flash + titles +
   controls). Small diff, app-wide lift.
2. **PR "motion economy"** — Tier 1 item 6 (animate-once) + Tier 3 items 9, 10.
3. **PR "command palette"** — Tier 1 item 2.
4. **PR "one chart grammar"** — Tier 1 item 3 + Tier 2 item 10.
5. **PR "signature moments"** — Tier 2 items 8, 9, 11.
6. **PR "tables & toasts"** — Tier 2 items 12, 13.
7. **PR "the detail batch"** — Tier 3, one sweep.
8. Tier 4 as individual efforts, Research terminal first.
