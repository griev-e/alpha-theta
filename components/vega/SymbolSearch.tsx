"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { SearchResponse, SymbolHit } from "@/lib/research/types";

/**
 * The "focus a symbol" affordance shared by the chart/engine headers and the
 * watchlist add-forms — a compact, debounced ticker/company typeahead over
 * /api/search (Yahoo-backed, CDN-cached, rate-limited server-side; failures
 * degrade to an empty list). Pressing Enter on a raw query that matches no
 * result still resolves it as a literal symbol, so exact tickers never need
 * the dropdown. One home, so symbol entry can't drift between pages.
 */
export function SymbolSearch({
  onSelect,
  buttonLabel,
  placeholder = "Symbol or name…",
  disabled = false,
}: {
  onSelect: (symbol: string) => void;
  /** Submit button text; omit for an input-only (dropdown/Enter) control. */
  buttonLabel?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length === 0) {
      setResults([]);
      return;
    }
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        const data = (await res.json()) as SearchResponse;
        if (reqId.current !== id) return;
        setResults((data.results ?? []).slice(0, 6));
        setActive(0);
      } catch {
        if (reqId.current === id) setResults([]);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  // Click-away closes the dropdown.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (symbol: string) => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    onSelect(sym);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && results[active]) choose(results[active].symbol);
      else choose(query);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Search for a symbol"
          spellCheck={false}
          autoComplete="off"
          disabled={disabled}
          className="field h-8 w-40 disabled:opacity-40"
        />
        {buttonLabel && (
          <button
            type="button"
            onClick={() => choose(open && results[active] ? results[active].symbol : query)}
            disabled={disabled || !query.trim()}
            className="btn-secondary h-8 disabled:opacity-40"
          >
            {buttonLabel}
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && query.trim().length > 0 && (
          <m.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 z-30 mt-1.5 w-72 overflow-hidden rounded-lg border border-edge bg-[#0a0a0a]/95 p-1 shadow-2xl backdrop-blur-md"
          >
            {results.length === 0 ? (
              <div className="px-2.5 py-2 text-[11.5px] text-faint">
                No matches — Enter looks up “{query.trim().toUpperCase()}” directly
              </div>
            ) : (
              results.map((r, i) => (
                <button
                  key={`${r.symbol}-${i}`}
                  type="button"
                  onClick={() => choose(r.symbol)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors ${
                    i === active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="w-14 shrink-0 font-mono text-[12px] font-medium text-ink">
                    {r.symbol}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-mute">
                    {r.name}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-faint">
                    {r.exchange || r.type}
                  </span>
                </button>
              ))
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
