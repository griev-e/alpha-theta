"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { relativeTime } from "@/lib/format";
import { StatusDot } from "@/components/ui/StatusDot";
import type { LiveStatus } from "@/lib/store";

/**
 * The status center — the LIVE indicator promoted from a tooltip to a click
 * popover. Lists the data providers the client genuinely tracks (quotes +
 * fundamentals) with a status-hue dot and last-success time, the live-price
 * coverage, and the refresh control relocated inside. Honest about what it
 * knows: providers without a tracked timestamp aren't invented as rows.
 */
export function StatusCenter({
  live,
  positionCount,
  onRefresh,
}: {
  live: LiveStatus;
  positionCount: number;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const feedOk = !live.degraded && !!live.quotesAt;
  const headTone: "live" | "stale" | "idle" = feedOk
    ? "live"
    : live.quotesAt || live.degraded
      ? "stale"
      : "idle";
  const headLabel = live.degraded
    ? "OFFLINE"
    : live.quotesAt
      ? "LIVE"
      : "CONNECTING";

  const rows: { name: string; tone: "live" | "stale" | "idle"; at: string | null; detail: string }[] = [
    {
      name: "Quotes",
      tone: feedOk ? "live" : "stale",
      at: live.quotesAt,
      detail: `${live.livePriceCount} of ${positionCount} priced live`,
    },
    {
      name: "Fundamentals",
      tone: live.fundamentalsAt ? "live" : "idle",
      at: live.fundamentalsAt,
      detail: live.fundamentalsAt ? "overlay loaded" : "not loaded yet",
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Live data status"
        className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-white/[0.05]"
      >
        <StatusDot tone={headTone} />
        <span
          className={`font-mono text-[11px] tracking-[0.08em] ${
            headTone === "live" ? "text-mute" : "text-warn/90"
          }`}
        >
          {headLabel}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="overlay absolute right-0 top-[calc(100%+8px)] z-50 w-64 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink">Live market data</span>
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.08em] ${
                  headTone === "live" ? "text-pos" : "text-warn"
                }`}
              >
                {headLabel}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {rows.map((r) => (
                <div key={r.name} className="flex items-center gap-2.5">
                  <StatusDot tone={r.tone} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] text-mute">{r.name}</div>
                    <div className="font-mono text-[10.5px] text-faint">{r.detail}</div>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-faint">
                    {r.at ? relativeTime(r.at) : "—"}
                  </span>
                </div>
              ))}
            </div>

            {live.degraded && (
              <p className="mt-2.5 border-t border-edge pt-2 text-[11px] leading-snug text-faint">
                The feed is unreachable — analytics run on your imported prices.
              </p>
            )}

            <button
              onClick={onRefresh}
              disabled={live.refreshing}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-white/[0.03] py-1.5 text-[12px] text-mute transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-60"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={live.refreshing ? "animate-spin" : ""}
                style={live.refreshing ? { animationDuration: "0.8s" } : undefined}
              >
                <path d="M16.9 8.2 A 7.2 7.2 0 1 0 17.2 11.6" />
                <path d="M17.2 3.4 V8.2 H12.4" />
              </svg>
              {live.refreshing ? "Refreshing…" : "Refresh now"}
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
