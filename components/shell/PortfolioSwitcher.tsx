"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { usePortfolio, usePortfolioActions } from "@/lib/store";

/**
 * Compact portfolio picker for the sidebar. Lists every portfolio in the set
 * (individual account, Roth IRA, …), switches the active one, and creates new
 * ones. Rename/delete live on the Import & Data page to keep this menu quick.
 */
export function PortfolioSwitcher() {
  const { portfolios, activeId, ready } = usePortfolio();
  const { selectPortfolio, createPortfolio } = usePortfolioActions();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setCreating(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  // Nothing to switch between until data has loaded and a portfolio exists.
  if (!ready || portfolios.length === 0) return null;

  const active = portfolios.find((p) => p.id === activeId) ?? portfolios[0];

  const submitCreate = () => {
    const n = name.trim();
    if (!n) return;
    createPortfolio(n);
    setName("");
    setCreating(false);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative px-3 pb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md border border-edge bg-white/[0.02] px-2.5 py-1.5 text-left transition-colors hover:border-edge2 hover:bg-white/[0.04]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-faint">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5.5 h14 M3 10 h14 M3 14.5 h9" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium text-ink">
            {active.name}
          </span>
          <span className="block text-[10.5px] text-faint">
            {portfolios.length} {portfolios.length === 1 ? "portfolio" : "portfolios"}
          </span>
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M5 8 L10 13 L15 8" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute left-3 right-3 z-50 mt-1 overflow-hidden rounded-lg border border-edge2 bg-[#0a0a0a] shadow-xl shadow-black/40"
            role="listbox"
          >
            <div className="max-h-64 overflow-y-auto py-1">
              {portfolios.map((p) => {
                const isActive = p.id === active.id;
                return (
                  <button
                    key={p.id}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      selectPortfolio(p.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] transition-colors ${
                      isActive ? "bg-white/[0.06] text-ink" : "text-mute hover:bg-white/[0.04] hover:text-ink"
                    }`}
                  >
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-accent">
                      {isActive && (
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 10.5 L8 14.5 L16 5.5" />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {p.isDemo && (
                      <span className="shrink-0 rounded border border-warn/30 bg-warn/10 px-1 py-px text-[10px] font-medium text-warn">
                        Demo
                      </span>
                    )}
                    <span className="shrink-0 font-mono text-[10px] text-faint">
                      {p.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-edge">
              {creating ? (
                <div className="flex items-center gap-1.5 p-1.5">
                  <input
                    ref={inputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitCreate();
                      if (e.key === "Escape") {
                        setCreating(false);
                        setName("");
                      }
                    }}
                    placeholder="Portfolio name"
                    className="h-7 min-w-0 flex-1 rounded-md border border-edge bg-white/[0.03] px-2 text-[12px] text-ink placeholder:text-faint outline-none focus:border-edge2"
                  />
                  <button
                    onClick={submitCreate}
                    disabled={!name.trim()}
                    className="h-7 rounded-md bg-accent px-2.5 text-[11.5px] font-semibold text-void transition disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-mute transition-colors hover:bg-white/[0.04] hover:text-ink"
                >
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 4 V16 M4 10 H16" />
                  </svg>
                  New portfolio
                </button>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
