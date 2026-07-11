"use client";

import { SyncBanner } from "@/components/ui/SyncBanner";
import { m } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TopProgress } from "@/components/ui/TopProgress";
import { PageAura } from "@/components/ui/PageAura";
import { CommandPalette, type Command } from "./CommandPalette";
import { KeyboardMap } from "./KeyboardMap";
import { NAV_CHORDS } from "./navChords";
import { MarketPulse } from "./MarketPulse";
import { StatusCenter } from "./StatusCenter";
import { StatusDot } from "@/components/ui/StatusDot";
import { FirstViewProvider, useRouteFirstView } from "@/lib/firstView";
import { fmtUSD, fmtUSDCompact } from "@/lib/format";
import { parseMoneyInput } from "@/lib/parseMoney";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { useToast } from "@/components/ui/Toast";
import { usePortfolio, useLiveStatus, usePortfolioActions } from "@/lib/store";
import { useSidebarWidth } from "@/lib/useSidebarWidth";
import { ThetaProvider } from "@/lib/theta/store";
import { ThetaAssumptionsProvider } from "@/lib/theta/assumptionsStore";
import { AppTitle, Sigil, SignOutButton } from "./brand";
import { PortfolioSwitcher } from "./PortfolioSwitcher";
import { MobileNavStrip, SidebarNav, SidebarCollapseButton } from "./SidebarNav";
import { PATCH_NOTES } from "@/lib/data/patchNotes";
import { ThetaShell } from "./ThetaShell";
import { VegaShell } from "./VegaShell";
import { VegaProvider } from "@/lib/vega/store";
import {
  IconBenchmark,
  IconDiscover,
  IconDividend,
  IconImport,
  IconIntelligence,
  IconMarket,
  IconMatrix,
  IconMonteCarlo,
  IconOptimizer,
  IconOverview,
  IconPatchNotes,
  IconQuality,
  IconRebalance,
  IconReport,
  IconResearch,
  IconRisk,
  IconScenario,
} from "./icons";

const NAV = [
  { href: "/", label: "Overview", icon: IconOverview, group: "Portfolio" },
  { href: "/intelligence", label: "Intelligence", icon: IconIntelligence, group: "Portfolio" },
  { href: "/risk", label: "Risk", icon: IconRisk, group: "Portfolio" },
  { href: "/research", label: "Research", icon: IconResearch, group: "Portfolio" },
  { href: "/dividends", label: "Dividends", icon: IconDividend, group: "Portfolio" },
  { href: "/rebalance", label: "Rebalance", icon: IconRebalance, group: "Portfolio" },
  { href: "/discover", label: "Discover", icon: IconDiscover, group: "Portfolio" },
  { href: "/optimizer", label: "Optimizer", icon: IconOptimizer, group: "Analysis" },
  { href: "/market", label: "Market Analysis", icon: IconMarket, group: "Analysis" },
  { href: "/quality", label: "Quality", icon: IconQuality, group: "Analysis" },
  { href: "/benchmark", label: "Benchmark & Factors", icon: IconBenchmark, group: "Analysis" },
  { href: "/correlation", label: "Correlation", icon: IconMatrix, group: "Analysis" },
  { href: "/scenarios", label: "Scenarios", icon: IconScenario, group: "Simulation" },
  { href: "/montecarlo", label: "Monte Carlo", icon: IconMonteCarlo, group: "Simulation" },
  { href: "/report", label: "Export Report", icon: IconReport, group: "Data" },
  { href: "/import", label: "Import & Data", icon: IconImport, group: "Data" },
  { href: "/patch-notes", label: "Patch Notes", icon: IconPatchNotes, group: "Data" },
];

const GROUPS = ["Portfolio", "Analysis", "Simulation", "Data"];

// Section-tinted ambient wash (see PageAura) — one hue per nav group so moving
// between areas of the app carries a faint, felt-not-seen sense of place.
const AURA: Record<string, string> = {
  Portfolio: "rgba(94,234,212,0.05)",
  Analysis: "rgba(125,211,252,0.05)",
  Simulation: "rgba(167,139,250,0.05)",
  Data: "rgba(255,255,255,0.02)",
};

/** Manual refresh: punches through every cache layer for fresh quotes. */
function RefreshButton({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  // Flash a checkmark for a beat when a refresh finishes, so a manual refresh
  // that lands instantly still reads as "done" rather than a no-op.
  const [justDone, setJustDone] = useState(false);
  const wasRefreshing = useRef(refreshing);
  useEffect(() => {
    if (wasRefreshing.current && !refreshing) {
      setJustDone(true);
      const id = setTimeout(() => setJustDone(false), 900);
      wasRefreshing.current = refreshing;
      return () => clearTimeout(id);
    }
    wasRefreshing.current = refreshing;
  }, [refreshing]);

  return (
    <button
      onClick={onRefresh}
      disabled={refreshing}
      title="Refresh live data"
      aria-label="Refresh live data"
      className="btn-ghost disabled:pointer-events-none"
    >
      {justDone ? (
        <svg
          width="13"
          height="13"
          viewBox="0 0 20 20"
          fill="none"
          stroke="var(--color-pos)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 10.5 L8.5 15 L16 5" />
        </svg>
      ) : (
        <svg
          width="13"
          height="13"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={refreshing ? "animate-spin" : ""}
          style={refreshing ? { animationDuration: "0.8s" } : undefined}
        >
          <path d="M16.9 8.2 A 7.2 7.2 0 1 0 17.2 11.6" />
          <path d="M17.2 3.4 V8.2 H12.4" />
        </svg>
      )}
    </button>
  );
}

function LiveDot({ degraded }: { degraded: boolean }) {
  return <StatusDot tone={degraded ? "stale" : "live"} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { portfolio, isDemo, ready, portfolios, activeId } = usePortfolio();
  const live = useLiveStatus();
  const { refreshLive, loadDemo, selectPortfolio, setCash } =
    usePortfolioActions();
  const sidebar = useSidebarWidth("alpha.sidebarWidth.v1");
  const firstView = useRouteFirstView(pathname);

  const toast = useToast();

  // Past the hero, the top bar's center label gains the live net value (§44):
  // the anchor number stays in view once you've scrolled the hero away.
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolledPastHero(window.scrollY > 180);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Single-key nav chords (§39): `g` then a letter jumps to a route, Linear-
  // style. Ignored inside inputs, with modifiers, or on the bare shells.
  const chordPending = useRef(false);
  const chordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        pathname === "/lock" ||
        pathname === "/report" ||
        pathname.startsWith("/theta") ||
        pathname.startsWith("/vega")
      )
        return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      )
        return;
      if (!chordPending.current) {
        if (e.key === "g") {
          chordPending.current = true;
          if (chordTimer.current) clearTimeout(chordTimer.current);
          chordTimer.current = setTimeout(() => {
            chordPending.current = false;
          }, 1300);
        }
        return;
      }
      chordPending.current = false;
      if (chordTimer.current) clearTimeout(chordTimer.current);
      const match = NAV_CHORDS.find((c) => c.key === e.key.toLowerCase());
      if (match) {
        e.preventDefault();
        router.push(match.href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (chordTimer.current) clearTimeout(chordTimer.current);
    };
  }, [pathname, router]);

  // A quiet dot on the Patch Notes row until the newest entry has been seen.
  const [unseenPatch, setUnseenPatch] = useState(false);
  useEffect(() => {
    try {
      setUnseenPatch(localStorage.getItem("alpha.patchSeen.v1") !== PATCH_NOTES[0]?.version);
    } catch {
      /* private mode — just don't badge */
    }
  }, []);

  // A one-time "what's new" nudge when a release has shipped since last visit —
  // the toast counterpart to the nav dot, links straight to Patch Notes.
  const patchToastFired = useRef(false);
  useEffect(() => {
    if (!unseenPatch || patchToastFired.current || pathname === "/patch-notes") return;
    patchToastFired.current = true;
    toast(`New in v${PATCH_NOTES[0]?.version} — see what changed`, {
      href: "/patch-notes",
      duration: 6000,
    });
  }, [unseenPatch, pathname, toast]);
  useEffect(() => {
    if (pathname !== "/patch-notes") return;
    try {
      localStorage.setItem("alpha.patchSeen.v1", PATCH_NOTES[0]?.version ?? "");
    } catch {
      /* private mode */
    }
    setUnseenPatch(false);
  }, [pathname]);

  const navItems = useMemo(
    () =>
      NAV.map((n) =>
        n.href === "/patch-notes" ? { ...n, dot: unseenPatch } : n
      ),
    [unseenPatch]
  );

  // Whether the sister app (theta) has a saved ledger, so the palette can offer
  // contextual theta destinations rather than a bare "Switch to theta".
  const [thetaHasData, setThetaHasData] = useState(false);
  useEffect(() => {
    try {
      setThetaHasData(!!localStorage.getItem("theta.ledger.v1"));
    } catch {
      /* private mode — just offer the plain switch */
    }
  }, []);

  // Commands for the ⌘K palette: every nav route, a few global actions, and one
  // switch row per saved portfolio.
  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = NAV.map((n) => {
      const Icon = n.icon;
      return {
        id: `nav:${n.href}`,
        label: n.label,
        group: "Navigate",
        keywords: n.group,
        hint: n.group,
        icon: <Icon />,
        run: () => router.push(n.href),
      };
    });
    const actions: Command[] = [
      {
        id: "act:refresh",
        label: "Refresh live data",
        group: "Actions",
        keywords: "reload quotes prices",
        run: () => refreshLive(),
      },
      {
        id: "act:demo",
        label: "Load demo portfolio",
        group: "Actions",
        keywords: "sample example",
        run: () => loadDemo(),
      },
      {
        id: "act:theta",
        label: thetaHasData ? "theta · Dashboard" : "Switch to theta",
        group: "Actions",
        keywords: "personal finance money theta",
        run: () => router.push("/theta"),
      },
      {
        id: "act:vega",
        label: "Switch to vega",
        group: "Actions",
        keywords: "day trading terminal chart scanner vega",
        run: () => router.push("/vega"),
      },
      // Deep-links into the sister app, but only when it actually has data —
      // the portal as one product, not a dead switch.
      ...(thetaHasData
        ? [
            {
              id: "act:theta-networth",
              label: "theta · Net Worth",
              group: "Actions",
              keywords: "theta net worth money",
              run: () => router.push("/theta/networth"),
            },
            {
              id: "act:theta-transactions",
              label: "theta · Transactions",
              group: "Actions",
              keywords: "theta transactions spending money",
              run: () => router.push("/theta/transactions"),
            },
          ]
        : []),
    ];
    const ports: Command[] = portfolios.map((p) => ({
      id: `port:${p.id}`,
      label: p.name,
      group: "Portfolios",
      keywords: "switch portfolio",
      hint: p.id === activeId ? "active" : undefined,
      run: () => selectPortfolio(p.id),
    }));
    return [...nav, ...actions, ...ports];
  }, [router, refreshLive, loadDemo, selectPortfolio, portfolios, activeId, thetaHasData]);

  // Command-line verbs (§123): typed lines that take an argument and act, not
  // just navigate. "cash 5000" sets the active portfolio's cash on the spot.
  const paletteVerbs = useCallback(
    (q: string): Command[] => {
      const out: Command[] = [];
      const cash = q.match(/^cash\s+(.+)$/i);
      if (cash) {
        const amt = parseMoneyInput(cash[1]);
        if (amt !== null && amt >= 0) {
          out.push({
            id: `verb:cash:${amt}`,
            transient: true,
            group: "Action",
            label: `Set cash to ${fmtUSD(amt)}`,
            hint: "set cash",
            icon: (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2.5" y="5" width="15" height="10" rx="2" />
                <circle cx="10" cy="10" r="2.2" />
              </svg>
            ),
            run: () => {
              setCash(amt);
              router.push("/");
            },
          });
        }
      }
      return out;
    },
    [setCash, router]
  );

  // Per-route document title, driven centrally off the nav list so every alpha
  // route reads "<Page> · alpha" in the browser tab without a metadata export
  // in each client page. theta owns its own title (ThetaShell), so bail there.
  useEffect(() => {
    if (pathname === "/theta" || pathname.startsWith("/theta/")) return;
    if (pathname === "/vega" || pathname.startsWith("/vega/")) return;
    const item = NAV.find((n) => n.href === pathname);
    const label =
      pathname === "/report"
        ? "Export Report"
        : pathname === "/household"
          ? "Household"
          : pathname === "/lock"
            ? null
            : item?.label;
    document.title = label ? `${label} · alpha` : "alpha";
  }, [pathname]);

  // The entrance reveal from the lock screen is handled outside React, by a
  // render-blocking script + CSS overlay in app/layout.tsx, so it covers the
  // very first painted frame after the reload (no flash of app behind it) and
  // fades with a GPU-composited opacity transition. See #alpha-entrance.

  // The lock screen and the print/export report render bare — no sidebar, no
  // nav, no top bar — so the report is a clean, self-contained document.
  if (pathname === "/lock" || pathname === "/report") {
    return <main className="min-h-screen">{children}</main>;
  }

  // theta — the sister personal-finance app — carries its own shell (nav,
  // branding, accent) and its own localStorage-backed store. Everything under
  // /theta renders inside both; the provider only mounts on these routes.
  if (pathname === "/theta" || pathname.startsWith("/theta/")) {
    return (
      <ThetaProvider>
        <ThetaAssumptionsProvider>
          <ThetaShell>{children}</ThetaShell>
        </ThetaAssumptionsProvider>
      </ThetaProvider>
    );
  }

  // vega — the day trading terminal — likewise carries its own shell, accent
  // and store; the provider only mounts on these routes.
  if (pathname === "/vega" || pathname.startsWith("/vega/")) {
    return (
      <VegaProvider>
        <VegaShell>{children}</VegaShell>
      </VegaProvider>
    );
  }

  const current = NAV.find((n) => n.href === pathname);

  return (
    <div className="min-h-screen lg:flex">
      <TopProgress accent="var(--color-accent)" loading={live.refreshing} />
      <CommandPalette
        commands={commands}
        accent="var(--color-accent)"
        enableTickerSearch
        verbs={paletteVerbs}
        verbHint="cash 5000"
        chordHints={NAV_CHORDS.slice(0, 4).map((c) => ({
          keys: ["G", c.key.toUpperCase()],
          label: c.label,
        }))}
      />
      <KeyboardMap
        accent="var(--color-accent)"
        extra={[
          {
            title: "Research",
            items: [
              { keys: ["J"], label: "Next security in the rail" },
              { keys: ["K"], label: "Previous security in the rail" },
            ],
          },
          {
            title: "Go to (press g, then…)",
            items: NAV_CHORDS.map((c) => ({
              keys: ["G", c.key.toUpperCase()],
              label: c.label,
            })),
          },
        ]}
      />
      <PageAura color={AURA[current?.group ?? ""] ?? "rgba(255,255,255,0.02)"} />
        {/* Desktop sidebar */}
      <aside
        className="relative z-10 hidden shrink-0 lg:flex sticky top-0 h-screen flex-col border-r border-edge bg-[#050505]"
        style={{ width: sidebar.width }}
      >
        <div className="px-3 pb-3 pt-4">
          {sidebar.collapsed ? (
            <div className="flex flex-col items-center gap-3">
              <Link href="/" aria-label="alpha home" className="group">
                <Sigil size={24} className="transition-colors group-hover:text-accent" />
              </Link>
              <SidebarCollapseButton collapsed onClick={sidebar.toggleCollapsed} />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-1">
              <Link href="/" className="group flex items-center gap-2.5">
                {/* A gentle breath on the mark each time the live feed ticks —
                    the brand acknowledging the heartbeat. Warms to brand red on
                    hover — one of alpha's sanctioned red moments. */}
                <m.span
                  key={live.quotesAt ?? "idle"}
                  initial={{ opacity: 0.55 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                >
                  <Sigil size={24} className="transition-colors group-hover:text-accent" />
                </m.span>
                <AppTitle active="alpha" />
              </Link>
              {isDemo && (
                <SampleDataTag accent="var(--color-warn)" label="DEMO DATA" />
              )}
              <div className="ml-auto flex items-center gap-0.5">
                <SignOutButton />
                <SidebarCollapseButton collapsed={false} onClick={sidebar.toggleCollapsed} />
              </div>
            </div>
          )}
        </div>

        {!sidebar.collapsed && <PortfolioSwitcher />}

        <SidebarNav
          items={navItems}
          groups={GROUPS}
          accent="var(--color-accent)"
          layoutId="nav-active"
          collapsed={sidebar.collapsed}
        />

        {/* Drag handle — adjusts sidebar width, persisted in localStorage.
            Also a keyboard/touch-friendly control: arrow keys nudge the width,
            Home or a double-click resets it, so resizing isn't mouse-only.
            Hidden while collapsed — the icon rail is a fixed width. */}
        {!sidebar.collapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            aria-valuenow={sidebar.width}
            aria-valuemin={sidebar.min}
            aria-valuemax={sidebar.max}
            tabIndex={0}
            onMouseDown={sidebar.onMouseDown}
            onDoubleClick={sidebar.onDoubleClick}
            onKeyDown={sidebar.onKeyDown}
            className={`group/handle absolute right-0 top-0 z-10 flex h-full w-1.5 -translate-x-1/2 cursor-col-resize items-center justify-center ${
              sidebar.dragging ? "bg-white/15" : "hover:bg-white/10"
            }`}
          >
            <span
              className={`h-8 w-[3px] rounded-full bg-white/25 transition-opacity ${
                sidebar.dragging ? "opacity-100" : "opacity-0 group-hover/handle:opacity-100"
              }`}
            />
          </div>
        )}
      </aside>

      <div className="relative z-10 min-w-0 flex-1">
        {/* Desktop top bar */}
        <header className="sticky top-0 z-40 hidden h-12 items-center glass border-b border-edge px-6 lg:flex">
          {/* Group label crossfades on a section change so it reads as one event
              with the PageAura hue drift, not two separate flickers. */}
          <m.span
            key={current?.group ?? "alpha"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="text-[13px] text-faint"
          >
            {current?.group ?? "alpha"}
          </m.span>
          <span className="absolute left-1/2 -translate-x-1/2 text-[13px]">
            <span className="font-medium text-mute">{current?.label ?? ""}</span>
            {ready && portfolio && (
              <m.span
                animate={{ opacity: scrolledPastHero ? 1 : 0 }}
                transition={{ duration: 0.2 }}
                aria-hidden={!scrolledPastHero}
                className="absolute left-full top-0 ml-2.5 whitespace-nowrap border-l border-edge pl-2.5 font-mono tnum text-ink"
              >
                {fmtUSDCompact(portfolio.totalValue)}
              </m.span>
            )}
          </span>
          {ready && portfolio && (
            <div className="ml-auto flex items-center gap-2">
              <MarketPulse />
              <StatusCenter
                live={live}
                positionCount={portfolio.positions.length}
                onRefresh={refreshLive}
              />
            </div>
          )}
        </header>

        {/* Mobile top bar */}
        <header className="glass lg:hidden sticky top-0 z-40 border-b border-edge">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <Sigil size={22} />
              <AppTitle active="alpha" />
            </Link>
            <div className="flex items-center gap-1.5">
              {ready && portfolio && (
                <>
                  <RefreshButton refreshing={live.refreshing} onRefresh={refreshLive} />
                  <LiveDot degraded={live.degraded || !live.quotesAt} />
                  <span className="font-mono tnum text-[12px] text-mute">
                    {fmtUSDCompact(portfolio.totalValue)}
                  </span>
                </>
              )}
              <SignOutButton />
            </div>
          </div>
          <div className="pb-1">
            <PortfolioSwitcher />
          </div>
          <MobileNavStrip items={NAV} />
        </header>

        <main className="mx-auto w-full max-w-[1380px] min-w-0 px-4 py-6 sm:px-8 sm:py-8">
          {/* Keyed enter animation only — no AnimatePresence/`mode="wait"` exit
              gating. The exit→enter handoff there raced on heavier data-driven
              pages (Overview, Risk, Research, …), leaving them blank until a
              re-render. A keyed m.div remounts per route and always runs
              its initial→animate, so the new page is mounted and visible at
              once. */}
          <SyncBanner />
          <FirstViewProvider value={firstView}>
            <m.div
              key={pathname}
              initial={firstView ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </m.div>
          </FirstViewProvider>
        </main>
      </div>
    </div>
  );
}
