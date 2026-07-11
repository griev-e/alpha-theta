"use client";

import { m } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { TopProgress } from "@/components/ui/TopProgress";
import { PageAura } from "@/components/ui/PageAura";
import { CommandPalette, type Command } from "./CommandPalette";
import { KeyboardMap } from "./KeyboardMap";
import { FirstViewProvider, useRouteFirstView } from "@/lib/firstView";
import { useVega } from "@/lib/vega/store";
import { SESSION_LABEL, usMarketSession } from "@/lib/marketSession";
import { useSidebarWidth } from "@/lib/useSidebarWidth";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { StatusDot } from "@/components/ui/StatusDot";
import { AppTitle, Mark, SignOutButton } from "./brand";
import { IconImport } from "./icons";
import { MobileNavStrip, SidebarNav, SidebarCollapseButton } from "./SidebarNav";
import {
  IconCandles,
  IconCockpit,
  IconEngine,
  IconJournal,
  IconPerformance,
  IconScanner,
  IconShield,
} from "./vegaIcons";
import { useAlertEngine } from "@/lib/vega/useAlertEngine";

const NAV = [
  { href: "/vega", label: "Cockpit", icon: IconCockpit, group: "Trade" },
  { href: "/vega/chart", label: "Chart", icon: IconCandles, group: "Trade" },
  { href: "/vega/engine", label: "Edge Engine", icon: IconEngine, group: "Trade" },
  { href: "/vega/scanner", label: "Scanner", icon: IconScanner, group: "Trade" },
  { href: "/vega/journal", label: "Journal", icon: IconJournal, group: "Performance" },
  { href: "/vega/analytics", label: "Analytics", icon: IconPerformance, group: "Performance" },
  { href: "/vega/risk", label: "Risk", icon: IconShield, group: "Performance" },
  { href: "/vega/import", label: "Import & Data", icon: IconImport, group: "System" },
];

const GROUPS = ["Trade", "Performance", "System"];

/** Honest tag: the sample journal is illustrative, not real trades. */
function SampleTag({ className = "" }: { className?: string }) {
  return (
    <SampleDataTag accent="var(--color-gold)" label="SAMPLE JOURNAL" className={className} />
  );
}

/** The live session readout — pre / open / post / closed, in status grammar.
 *  Re-derives once a minute so a session boundary flips it without a reload. */
function SessionBadge() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const session = usMarketSession(now);
  const tone =
    session === "open" ? "live" : session === "closed" ? "idle" : "info";
  return (
    <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
      <StatusDot tone={tone} />
      {SESSION_LABEL[session]}
    </span>
  );
}

export function VegaShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isSample, ready, state, setFocus, addToWatchlist } = useVega();
  // The live alert sweep — mounted once here so alerts ring on every page.
  useAlertEngine();
  const current = NAV.find((n) => n.href === pathname);
  const showSample = ready && isSample;
  const sidebar = useSidebarWidth("vega.sidebarWidth.v1");
  const firstView = useRouteFirstView(pathname);
  const router = useRouter();

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
        id: "act:alpha",
        label: "Switch to alpha",
        group: "Actions",
        keywords: "portfolio analytics investing",
        run: () => router.push("/"),
      },
      {
        id: "act:theta",
        label: "Switch to theta",
        group: "Actions",
        keywords: "personal finance money",
        run: () => router.push("/theta"),
      },
    ];
    const watch: Command[] = state.watchlist.map((s) => ({
      id: `watch:${s}`,
      label: `Chart ${s}`,
      group: "Watchlist",
      keywords: "symbol ticker chart focus",
      hint: s === state.focus ? "focused" : undefined,
      run: () => {
        setFocus(s);
        router.push("/vega/chart");
      },
    }));
    return [...nav, ...actions, ...watch];
  }, [router, state.watchlist, state.focus, setFocus]);

  // Command-line verbs (§123): "focus NVDA" charts a symbol on the spot,
  // "watch TSLA" adds it to the watchlist without opening the editor.
  const paletteVerbs = useCallback(
    (q: string): Command[] => {
      const out: Command[] = [];
      const icon = (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 15 L8 9.5 L11 12 L17 5" />
        </svg>
      );
      const focus = q.match(/^(?:focus|chart)\s+([a-zA-Z0-9.^=\-]{1,12})$/i);
      if (focus) {
        const sym = focus[1].toUpperCase();
        out.push({
          id: `verb:focus:${sym}`,
          transient: true,
          group: "Action",
          label: `Chart ${sym}`,
          hint: "focus symbol",
          icon,
          run: () => {
            setFocus(sym);
            router.push("/vega/chart");
          },
        });
      }
      const watch = q.match(/^watch\s+([a-zA-Z0-9.^=\-]{1,12})$/i);
      if (watch) {
        const sym = watch[1].toUpperCase();
        out.push({
          id: `verb:watch:${sym}`,
          transient: true,
          group: "Action",
          label: `Add ${sym} to watchlist`,
          hint: "watch",
          icon,
          run: () => {
            addToWatchlist(sym);
            router.push("/vega/scanner");
          },
        });
      }
      return out;
    },
    [setFocus, addToWatchlist, router]
  );

  // Per-route tab title for vega's routes, parallel to the other shells'.
  useEffect(() => {
    const item = NAV.find((n) => n.href === pathname);
    document.title = item ? `${item.label} · vega` : "vega";
  }, [pathname]);

  return (
    <div className="vega-scope min-h-screen lg:flex">
      <TopProgress accent="var(--color-gold)" />
      <CommandPalette
        commands={commands}
        accent="var(--color-gold)"
        verbs={paletteVerbs}
        verbHint="focus NVDA"
      />
      <KeyboardMap accent="var(--color-gold)" />
      <PageAura color="rgba(250,204,21,0.045)" />
      {/* Desktop sidebar */}
      <aside
        className="relative z-10 hidden shrink-0 lg:flex sticky top-0 h-screen flex-col border-r border-edge bg-[#050505]"
        style={{ width: sidebar.width }}
      >
        <div className="px-3 pb-3 pt-4">
          {sidebar.collapsed ? (
            <div className="flex flex-col items-center gap-3">
              <Link href="/vega" aria-label="vega home">
                <Mark kind="vega" size={24} />
              </Link>
              <SidebarCollapseButton collapsed onClick={sidebar.toggleCollapsed} />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-1">
              <Link href="/vega" className="flex items-center gap-2.5">
                <Mark kind="vega" size={24} />
                <AppTitle active="vega" accent="var(--color-gold)" />
              </Link>
              <div className="ml-auto flex items-center gap-0.5">
                <SignOutButton />
                <SidebarCollapseButton collapsed={false} onClick={sidebar.toggleCollapsed} />
              </div>
            </div>
          )}
        </div>

        <SidebarNav
          items={NAV}
          groups={GROUPS}
          accent="var(--color-gold)"
          layoutId="vega-nav-active"
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
          <m.span
            key={current?.group ?? "vega"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="text-[13px] text-faint"
          >
            {current?.group ?? "vega"}
          </m.span>
          <span className="absolute left-1/2 -translate-x-1/2 text-[13px] font-medium text-mute">
            {current?.label ?? ""}
          </span>
          <div className="ml-auto flex items-center gap-3">
            {showSample && <SampleTag />}
            <SessionBadge />
          </div>
        </header>

        {/* Mobile top bar */}
        <header className="glass lg:hidden sticky top-0 z-40 border-b border-edge">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/vega" className="flex items-center gap-2.5">
              <Mark kind="vega" size={22} />
              <AppTitle active="vega" accent="var(--color-gold)" />
            </Link>
            <div className="flex items-center gap-2.5">
              {showSample && <SampleTag />}
              <SessionBadge />
              <SignOutButton />
            </div>
          </div>
          <MobileNavStrip items={NAV} />
        </header>

        <main className="mx-auto w-full max-w-[1380px] min-w-0 px-4 py-6 sm:px-8 sm:py-8">
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
