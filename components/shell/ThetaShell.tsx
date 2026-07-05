"use client";

import { SyncBanner } from "@/components/ui/SyncBanner";
import { m } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import { TopProgress } from "@/components/ui/TopProgress";
import { PageAura } from "@/components/ui/PageAura";
import { CommandPalette, type Command } from "./CommandPalette";
import { FirstViewProvider, useRouteFirstView } from "@/lib/firstView";
import { useTheta } from "@/lib/theta/store";
import { useSimplefinAutoSync } from "@/lib/theta/useSimplefinAutoSync";
import { useSidebarWidth } from "@/lib/useSidebarWidth";
import { AppTitle, Mark, SignOutButton } from "./brand";
import { IconImport, IconIntelligence } from "./icons";
import { MobileNavStrip, SidebarNav } from "./SidebarNav";
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
    <span
      className={`flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.08em] text-vio/80 ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-vio/70" />
      SAMPLE DATA
    </span>
  );
}

export function ThetaShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isSample, ready } = useTheta();
  useSimplefinAutoSync();
  const current = NAV.find((n) => n.href === pathname);
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
      <PageAura color="rgba(167,139,250,0.05)" />
      {/* Desktop sidebar */}
      <aside
        className="relative z-10 hidden shrink-0 lg:flex sticky top-0 h-screen flex-col border-r border-edge bg-[#050505]"
        style={{ width: sidebar.width }}
      >
        <div className="px-3 pb-3 pt-4">
          <div className="flex items-center gap-2.5 px-1">
            <Link href="/theta" className="flex items-center gap-2.5">
              <Mark kind="theta" size={24} />
              <AppTitle active="theta" />
            </Link>
            <SignOutButton className="ml-auto" />
          </div>
        </div>

        <SidebarNav items={NAV} groups={GROUPS} accent="var(--color-vio)" layoutId="theta-nav-active" />

        {/* Drag handle — adjusts sidebar width, persisted in localStorage.
            Also a keyboard/touch-friendly control: arrow keys nudge the width,
            Home or a double-click resets it, so resizing isn't mouse-only. */}
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
      </aside>

      <div className="relative z-10 min-w-0 flex-1">
        {/* Desktop top bar */}
        <header className="sticky top-0 z-40 hidden h-12 items-center border-b border-edge bg-black/80 px-6 backdrop-blur-md lg:flex">
          <span className="text-[13px] text-faint">{current?.group ?? "theta"}</span>
          <span className="absolute left-1/2 -translate-x-1/2 text-[13px] font-medium text-mute">
            {current?.label ?? ""}
          </span>
          {showSample && <DemoTag className="ml-auto" />}
        </header>

        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-40 border-b border-edge bg-black/85 backdrop-blur-md">
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
          <MobileNavStrip items={NAV} />
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
