"use client";

import { m } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType;
  group: string;
  /** A small status dot on the row — e.g. an unseen patch note. */
  dot?: boolean;
}

function NavRow({
  item,
  active,
  accent,
  layoutId,
  onNavigate,
  collapsed = false,
}: {
  item: NavItem;
  active: boolean;
  accent: string;
  layoutId: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={`nav-row relative flex h-8 items-center rounded-md text-[13px] ${
        collapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
      } ${active ? "text-ink" : "text-mute hover:text-ink hover:bg-white/[0.05]"}`}
    >
      {active && (
        <m.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-md bg-white/[0.07]"
          style={{
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 16%, transparent)`,
          }}
          transition={{ type: "spring", stiffness: 520, damping: 40 }}
        />
      )}
      <span
        className="relative z-10 opacity-80 [&>svg]:h-4 [&>svg]:w-4"
        style={active ? { color: accent } : undefined}
      >
        <Icon />
      </span>
      {!collapsed && <span className="relative z-10">{item.label}</span>}
      {item.dot && (
        <span
          aria-hidden
          className={`z-10 h-1.5 w-1.5 shrink-0 rounded-full ${
            collapsed ? "absolute right-1.5 top-1.5" : "relative ml-auto"
          }`}
          style={{ background: accent }}
        />
      )}
    </Link>
  );
}

/**
 * Sidebar nav with a Vercel-style Find filter ("/" to focus, Enter to go the
 * top match). Shared by alpha's and theta's shells (`AppShell`/`ThetaShell`)
 * so the two never drift from each other — only the item list, group order,
 * and accent color differ per app.
 */
export function SidebarNav({
  items,
  groups,
  accent,
  layoutId,
  collapsed = false,
}: {
  items: NavItem[];
  groups: string[];
  /** CSS color (var(...) or hex) for the active row's glow + icon. */
  accent: string;
  /** Distinct per shell so the active-pill spring never animates across shells. */
  layoutId: string;
  /** Icon-rail mode: no find, no group labels, tooltips on hover. */
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return items.filter(
      (n) => n.label.toLowerCase().includes(q) || n.group.toLowerCase().includes(q)
    );
  }, [query, items]);

  // Collapsed icon rail: a flat, centered list of icon-only rows with tooltips,
  // no find field or group headers — the analyst's give-me-the-pixels mode.
  if (collapsed) {
    return (
      <nav className="flex-1 overflow-y-auto px-2 pb-4 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-0.5">
          {items.map((item) => (
            <NavRow
              key={item.href}
              item={item}
              active={pathname === item.href}
              accent={accent}
              layoutId={layoutId}
              collapsed
            />
          ))}
        </div>
      </nav>
    );
  }

  return (
    <>
      <div className="px-3 pb-2">
        <div className="relative">
          <svg
            width="13"
            height="13"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
          >
            <circle cx="8.6" cy="8.6" r="5.4" />
            <path d="M12.6 12.6 L17 17" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered?.[0]) {
                router.push(filtered[0].href);
                setQuery("");
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                setQuery("");
                e.currentTarget.blur();
              }
            }}
            placeholder="Find..."
            className="h-8 w-full rounded-md border border-edge bg-white/[0.03] pl-8 pr-8 text-[13px] text-ink placeholder:text-faint outline-none transition-colors focus:border-edge2"
          />
          <span className="kbd absolute right-2 top-1/2 -translate-y-1/2">/</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {filtered ? (
          <div className="flex flex-col gap-0.5 pt-1">
            {filtered.length === 0 && (
              <div className="px-2.5 py-2 text-[12px] text-faint">No matches</div>
            )}
            {filtered.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                active={pathname === item.href}
                accent={accent}
                layoutId={layoutId}
                onNavigate={() => setQuery("")}
              />
            ))}
          </div>
        ) : (
          groups.map((group, gi) => (
            <m.div
              key={group}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: gi * 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="px-2.5 pb-1 pt-4 text-[11px] font-medium text-faint">
                {group}
              </div>
              <div className="flex flex-col gap-0.5">
                {items
                  .filter((n) => n.group === group)
                  .map((item) => (
                    <NavRow
                      key={item.href}
                      item={item}
                      active={pathname === item.href}
                      accent={accent}
                      layoutId={layoutId}
                    />
                  ))}
              </div>
            </m.div>
          ))
        )}
      </nav>
    </>
  );
}

/** The collapse/expand toggle — a panel-left glyph shared by both shells so the
 *  icon-rail control looks and behaves identically in alpha and theta. */
export function SidebarCollapseButton({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? "Expand sidebar  [" : "Collapse sidebar  ["}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="btn-ghost"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
        <line x1="7.75" y1="3.5" x2="7.75" y2="16.5" />
      </svg>
    </button>
  );
}

/** Horizontal scroll-strip nav for the mobile top bar — same item list, no icons. */
export function MobileNavStrip({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] transition-colors ${
              active ? "bg-white/[0.08] text-ink" : "text-mute hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
