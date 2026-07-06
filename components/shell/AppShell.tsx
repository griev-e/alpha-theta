"use client";

import { SyncBanner } from "@/components/ui/SyncBanner";
import { m } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TopProgress } from "@/components/ui/TopProgress";
import { PageAura } from "@/components/ui/PageAura";
import { CommandPalette, type Command } from "./CommandPalette";
import { MarketPulse } from "./MarketPulse";
import { FirstViewProvider, useRouteFirstView } from "@/lib/firstView";
import { fmtUSDCompact, relativeTime } from "@/lib/format";
import { Tooltip } from "@/components/ui/Tooltip";
import { usePortfolio, useLiveStatus, usePortfolioActions } from "@/lib/store";
import { useSidebarWidth } from "@/lib/useSidebarWidth";
import { ThetaProvider } from "@/lib/theta/store";
import { ThetaAssumptionsProvider } from "@/lib/theta/assumptionsStore";
import { AppTitle, Sigil, SignOutButton } from "./brand";
import { PortfolioSwitcher } from "./PortfolioSwitcher";
import { MobileNavStrip, SidebarNav, SidebarCollapseButton } from "./SidebarNav";
import { PATCH_NOTES } from "@/lib/data/patchNotes";
import { ThetaShell } from "./ThetaShell";
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
  return (
    <span className="relative flex h-2 w-2">
      {!degraded && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full"
          style={{ backgroundColor: "color-mix(in srgb, var(--color-live) 38%, transparent)" }}
        />
      )}
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ backgroundColor: degraded ? "var(--color-warn)" : "var(--color-live)" }}
      />
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { portfolio, isDemo, ready, portfolios, activeId } = usePortfolio();
  const live = useLiveStatus();
  const { refreshLive, loadDemo, selectPortfolio } = usePortfolioActions();
  const sidebar = useSidebarWidth("alpha.sidebarWidth.v1");
  const firstView = useRouteFirstView(pathname);

  // A quiet dot on the Patch Notes row until the newest entry has been seen.
  const [unseenPatch, setUnseenPatch] = useState(false);
  useEffect(() => {
    try {
      setUnseenPatch(localStorage.getItem("alpha.patchSeen.v1") !== PATCH_NOTES[0]?.version);
    } catch {
      /* private mode — just don't badge */
    }
  }, []);
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
        label: "Switch to theta",
        group: "Actions",
        keywords: "personal finance money",
        run: () => router.push("/theta"),
      },
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
  }, [router, refreshLive, loadDemo, selectPortfolio, portfolios, activeId]);

  // Per-route document title, driven centrally off the nav list so every alpha
  // route reads "<Page> · alpha" in the browser tab without a metadata export
  // in each client page. theta owns its own title (ThetaShell), so bail there.
  useEffect(() => {
    if (pathname === "/theta" || pathname.startsWith("/theta/")) return;
    const item = NAV.find((n) => n.href === pathname);
    const label =
      pathname === "/report"
        ? "Export Report"
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

  const current = NAV.find((n) => n.href === pathname);

  const liveLabel = live.degraded
    ? live.livePriceCount > 0
      ? "offline · last good prices"
      : "offline · imported prices"
    : live.quotesAt
      ? "live"
      : "connecting";

  return (
    <div className="min-h-screen lg:flex">
      <TopProgress accent="var(--color-accent)" loading={live.refreshing} />
      <CommandPalette commands={commands} accent="var(--color-accent)" enableTickerSearch />
      <PageAura color={AURA[current?.group ?? ""] ?? "rgba(255,255,255,0.02)"} />
        {/* Desktop sidebar */}
      <aside
        className="relative z-10 hidden shrink-0 lg:flex sticky top-0 h-screen flex-col border-r border-edge bg-[#050505]"
        style={{ width: sidebar.width }}
      >
        <div className="px-3 pb-3 pt-4">
          {sidebar.collapsed ? (
            <div className="flex flex-col items-center gap-3">
              <Link href="/" aria-label="alpha home">
                <Sigil size={24} />
              </Link>
              <SidebarCollapseButton collapsed onClick={sidebar.toggleCollapsed} />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-1">
              <Link href="/" className="flex items-center gap-2.5">
                {/* A gentle breath on the mark each time the live feed ticks —
                    the brand acknowledging the heartbeat. */}
                <m.span
                  key={live.quotesAt ?? "idle"}
                  initial={{ opacity: 0.55 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                >
                  <Sigil size={24} />
                </m.span>
                <AppTitle active="alpha" />
              </Link>
              {isDemo && (
                <span className="rounded-full border border-warn/30 bg-warn/10 px-2 py-0.5 text-[10px] font-medium text-warn">
                  Demo
                </span>
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
        <header className="sticky top-0 z-40 hidden h-12 items-center border-b border-edge bg-black/80 px-6 backdrop-blur-md lg:flex">
          <span className="text-[13px] text-faint">{current?.group ?? "alpha"}</span>
          <span className="absolute left-1/2 -translate-x-1/2 text-[13px] font-medium text-mute">
            {current?.label ?? ""}
          </span>
          {ready && portfolio && (
            <div className="ml-auto flex items-center gap-2">
              <MarketPulse />
              <RefreshButton refreshing={live.refreshing} onRefresh={refreshLive} />
              <Tooltip
                underline={false}
                content={
                  <div className="space-y-0.5">
                    <div className="font-medium text-mute">
                      {live.degraded
                        ? "Live feed unreachable"
                        : live.quotesAt
                          ? "Live market data"
                          : "Connecting to the feed"}
                    </div>
                    {live.quotesAt && (
                      <div>Last quote {relativeTime(live.quotesAt)}</div>
                    )}
                    <div className="text-faint">
                      {live.livePriceCount} of {portfolio.positions.length} priced live
                    </div>
                  </div>
                }
              >
                <span className="flex items-center gap-2">
                  <LiveDot degraded={live.degraded || !live.quotesAt} />
                  <span
                    className={`font-mono text-[11px] tracking-[0.08em] ${
                      live.degraded || !live.quotesAt ? "text-warn/90" : "text-mute"
                    }`}
                  >
                    {(live.degraded || !live.quotesAt) ? liveLabel.toUpperCase() : "LIVE"}
                  </span>
                </span>
              </Tooltip>
            </div>
          )}
        </header>

        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-40 border-b border-edge bg-black/85 backdrop-blur-md">
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
