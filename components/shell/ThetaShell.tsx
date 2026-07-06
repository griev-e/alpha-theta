"use client";

import { SyncBanner } from "@/components/ui/SyncBanner";
import { m } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import { TopProgress } from "@/components/ui/TopProgress";
import { PageAura } from "@/components/ui/PageAura";
import { CommandPalette, type Command } from "./CommandPalette";
import { KeyboardMap } from "./KeyboardMap";
import { FirstViewProvider, useRouteFirstView } from "@/lib/firstView";
import { useTheta } from "@/lib/theta/store";
import { detectRecurring, newSubscriptions, normalizeMerchant } from "@/lib/theta/detect";
import { useSimplefinAutoSync } from "@/lib/theta/useSimplefinAutoSync";
import { useSidebarWidth } from "@/lib/useSidebarWidth";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { AppTitle, Mark, SignOutButton } from "./brand";
import { IconImport, IconIntelligence } from "./icons";
import { MobileNavStrip, SidebarNav, SidebarCollapseButton } from "./SidebarNav";
import {
  IconAccounts,
  IconBudgets,
  IconCashFlow,
  IconDashboard,
  IconDebt,
  IconGoals,
  IconHealth,
  IconNetWorth,
  IconProjection,
  IconRecurring,
  IconSettings,
  IconTransactions,
} from "./thetaIcons";

const NAV = [
  { href: "/theta", label: "Dashboard", icon: IconDashboard, group: "Overview" },
  { href: "/theta/networth", label: "Net Worth", icon: IconNetWorth, group: "Overview" },
  { href: "/theta/health", label: "Health", icon: IconHealth, group: "Overview" },
  { href: "/theta/intelligence", label: "Intelligence", icon: IconIntelligence, group: "Overview" },
  { href: "/theta/accounts", label: "Accounts", icon: IconAccounts, group: "Money" },
  { href: "/theta/transactions", label: "Transactions", icon: IconTransactions, group: "Money" },
  { href: "/theta/cashflow", label: "Cash Flow", icon: IconCashFlow, group: "Money" },
  { href: "/theta/debt", label: "Debt Payoff", icon: IconDebt, group: "Money" },
  { href: "/theta/budgets", label: "Budgets", icon: IconBudgets, group: "Planning" },
  { href: "/theta/goals", label: "Goals", icon: IconGoals, group: "Planning" },
  { href: "/theta/recurring", label: "Recurring", icon: IconRecurring, group: "Planning" },
  { href: "/theta/projection", label: "Projection", icon: IconProjection, group: "Planning" },
  { href: "/theta/import", label: "Import & Data", icon: IconImport, group: "System" },
  { href: "/theta/settings", label: "Settings", icon: IconSettings, group: "System" },
];

const GROUPS = ["Overview", "Money", "Planning", "System"];

/** Honest tag: theta ships with illustrative sample data, no real accounts. */
function DemoTag({ className = "" }: { className?: string }) {
  return (
    <SampleDataTag accent="var(--color-vio)" label="SAMPLE DATA" className={className} />
  );
}

export function ThetaShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isSample, ready, ledger } = useTheta();
  useSimplefinAutoSync();
  const current = NAV.find((n) => n.href === pathname);

  // A quiet dot on the Recurring nav row when the ledger has auto-detected a
  // subscription it doesn't yet track (§37), mirroring alpha's patch-notes dot.
  // Suppressed while you're on the page — you're already looking at it.
  const hasNewSubs = useMemo(() => {
    if (!ledger) return false;
    const dismissed = new Set(ledger.dismissedRecurring ?? []);
    return newSubscriptions(
      detectRecurring(ledger.transactions),
      ledger.recurring
    ).some((d) => !dismissed.has(normalizeMerchant(d.merchant)));
  }, [ledger]);
  const navItems = useMemo(
    () =>
      NAV.map((n) =>
        n.href === "/theta/recurring"
          ? { ...n, dot: hasNewSubs && pathname !== "/theta/recurring" }
          : n
      ),
    [hasNewSubs, pathname]
  );
  const showSample = ready && isSample;
  const sidebar = useSidebarWidth("theta.sidebarWidth.v1");
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
    ];
    return [...nav, ...actions];
  }, [router]);

  // Per-route tab title for theta's routes, parallel to AppShell's.
  useEffect(() => {
    const item = NAV.find((n) => n.href === pathname);
    document.title = item ? `${item.label} · theta` : "theta";
  }, [pathname]);

  return (
    <div className="theta-scope min-h-screen lg:flex">
      <TopProgress accent="var(--color-vio)" />
      <CommandPalette commands={commands} accent="var(--color-vio)" />
      <KeyboardMap accent="var(--color-vio)" />
      <PageAura color="rgba(167,139,250,0.05)" />
      {/* Desktop sidebar */}
      <aside
        className="relative z-10 hidden shrink-0 lg:flex sticky top-0 h-screen flex-col border-r border-edge bg-[#050505]"
        style={{ width: sidebar.width }}
      >
        <div className="px-3 pb-3 pt-4">
          {sidebar.collapsed ? (
            <div className="flex flex-col items-center gap-3">
              <Link href="/theta" aria-label="theta home">
                <Mark kind="theta" size={24} />
              </Link>
              <SidebarCollapseButton collapsed onClick={sidebar.toggleCollapsed} />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-1">
              <Link href="/theta" className="flex items-center gap-2.5">
                <Mark kind="theta" size={24} />
                <AppTitle active="theta" />
              </Link>
              <div className="ml-auto flex items-center gap-0.5">
                <SignOutButton />
                <SidebarCollapseButton collapsed={false} onClick={sidebar.toggleCollapsed} />
              </div>
            </div>
          )}
        </div>

        <SidebarNav
          items={navItems}
          groups={GROUPS}
          accent="var(--color-vio)"
          layoutId="theta-nav-active"
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
            key={current?.group ?? "theta"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="text-[13px] text-faint"
          >
            {current?.group ?? "theta"}
          </m.span>
          <span className="absolute left-1/2 -translate-x-1/2 text-[13px] font-medium text-mute">
            {current?.label ?? ""}
          </span>
          {showSample && <DemoTag className="ml-auto" />}
        </header>

        {/* Mobile top bar */}
        <header className="glass lg:hidden sticky top-0 z-40 border-b border-edge">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/theta" className="flex items-center gap-2.5">
              <Mark kind="theta" size={22} />
              <AppTitle active="theta" />
            </Link>
            <div className="flex items-center gap-2.5">
              {showSample && <DemoTag />}
              <SignOutButton />
            </div>
          </div>
          <MobileNavStrip items={navItems} />
        </header>

        <main className="mx-auto w-full max-w-[1380px] min-w-0 px-4 py-6 sm:px-8 sm:py-8">
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
