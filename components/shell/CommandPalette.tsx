"use client";

import { AnimatePresence, m } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { TickerLogo } from "@/components/ui/TickerLogo";
import type { SearchResponse, SymbolHit } from "@/lib/research/types";

export interface Command {
  id: string;
  label: string;
  /** Section heading the command is grouped under. */
  group: string;
  /** Extra searchable text (aliases, the route group, …). */
  keywords?: string;
  /** Small right-aligned note — a shortcut hint or the destination. */
  hint?: string;
  icon?: ReactNode;
  /** Runs when chosen; the palette closes immediately after. */
  run: () => void;
}

type Row =
  | { kind: "command"; cmd: Command }
  | { kind: "ticker"; hit: SymbolHit };

/**
 * ⌘K command palette — the keyboard-first surface a terminal is expected to
 * have. Opens on ⌘K / Ctrl+K, filters navigation + actions live, and (for
 * alpha) folds in live ticker search so a symbol is one keystroke from its
 * Research page. Floats on the shared `.overlay` elevation; fully keyboard
 * driven (↑/↓ move, Enter runs, Esc closes).
 *
 * Generic by design: each shell passes its own `commands` and `accent`, so the
 * two apps share one palette without sharing a nav list.
 */
export function CommandPalette({
  commands,
  accent,
  enableTickerSearch = false,
  chordHints = [],
}: {
  commands: Command[];
  accent: string;
  enableTickerSearch?: boolean;
  /** A few `g`-chord shortcuts (§39) surfaced in the no-match state (§109). */
  chordHints?: { keys: string[]; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [hits, setHits] = useState<SymbolHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  // Global open shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset transient state each time it opens; focus the input.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    setHits([]);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Debounced ticker search (alpha only).
  useEffect(() => {
    if (!enableTickerSearch) return;
    const term = query.trim();
    if (term.length === 0) {
      setHits([]);
      return;
    }
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        const data = (await res.json()) as SearchResponse;
        if (reqId.current === id) setHits((data.results ?? []).slice(0, 6));
      } catch {
        if (reqId.current === id) setHits([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, enableTickerSearch]);

  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase().includes(q),
    );
  }, [commands, query]);

  // Flat, ordered row list for keyboard traversal: commands first, then any
  // live ticker matches.
  const rows: Row[] = useMemo(() => {
    const cmdRows: Row[] = filteredCommands.map((cmd) => ({
      kind: "command",
      cmd,
    }));
    const tickerRows: Row[] = hits.map((hit) => ({ kind: "ticker", hit }));
    return [...cmdRows, ...tickerRows];
  }, [filteredCommands, hits]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  const close = useCallback(() => setOpen(false), []);

  const runRow = useCallback(
    (row: Row | undefined) => {
      if (!row) return;
      close();
      if (row.kind === "command") row.cmd.run();
      else router.push(`/research?symbol=${encodeURIComponent(row.hit.symbol)}`);
    },
    [close, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(rows.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runRow(rows[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  // Keep the active row scrolled into view.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Group headings for rendering while preserving the flat index for keyboarding.
  let idx = -1;
  const groups = new Map<string, { row: Row; i: number }[]>();
  filteredCommands.forEach((cmd) => {
    idx += 1;
    const arr = groups.get(cmd.group) ?? [];
    arr.push({ row: { kind: "command", cmd }, i: idx });
    groups.set(cmd.group, arr);
  });
  const tickerStart = idx + 1;

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-[14vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="overlay relative z-10 w-full max-w-lg overflow-hidden"
          >
            <div className="flex items-center gap-2.5 border-b border-edge px-4">
              <svg
                width="15"
                height="15"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                className="shrink-0 text-faint"
              >
                <circle cx="8.6" cy="8.6" r="5.4" />
                <path d="M12.6 12.6 L17 17" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={
                  enableTickerSearch
                    ? "Search pages, actions, or any ticker…"
                    : "Search pages and actions…"
                }
                spellCheck={false}
                autoComplete="off"
                className="h-12 w-full bg-transparent text-[14px] text-ink placeholder:text-faint outline-none"
              />
              <span className="kbd shrink-0">esc</span>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
              {rows.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <div className="text-[12.5px] text-mute">No matches</div>
                  <div className="mt-1.5 text-[11.5px] leading-relaxed text-faint">
                    {enableTickerSearch
                      ? "Try a ticker or company name to jump to its research page."
                      : "Try a page or action name."}
                  </div>
                  {chordHints.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                      {chordHints.map((h) => (
                        <span
                          key={h.label}
                          className="flex items-center gap-1.5 text-[11px] text-faint"
                        >
                          <span className="flex items-center gap-1">
                            {h.keys.map((k, i) => (
                              <kbd key={i} className="kbd">
                                {k}
                              </kbd>
                            ))}
                          </span>
                          {h.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {[...groups.entries()].map(([group, entries]) => (
                <div key={group}>
                  <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint">
                    {group}
                  </div>
                  {entries.map(({ row, i }) =>
                    row.kind === "command" ? (
                      <PaletteRow
                        key={row.cmd.id}
                        idx={i}
                        active={i === active}
                        accent={accent}
                        onHover={() => setActive(i)}
                        onClick={() => runRow(row)}
                        icon={row.cmd.icon}
                        label={row.cmd.label}
                        hint={row.cmd.hint}
                      />
                    ) : null,
                  )}
                </div>
              ))}

              {hits.length > 0 && (
                <div>
                  <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint">
                    Tickers
                  </div>
                  {hits.map((hit, k) => {
                    const i = tickerStart + k;
                    return (
                      <PaletteRow
                        key={`${hit.symbol}-${k}`}
                        idx={i}
                        active={i === active}
                        accent={accent}
                        onHover={() => setActive(i)}
                        onClick={() =>
                          runRow({ kind: "ticker", hit })
                        }
                        icon={
                          <TickerLogo
                            symbol={hit.symbol}
                            accent={accent}
                            size={20}
                          />
                        }
                        label={hit.symbol}
                        sub={hit.name}
                        hint={hit.exchange || hit.type}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function PaletteRow({
  idx,
  active,
  accent,
  onHover,
  onClick,
  icon,
  label,
  sub,
  hint,
}: {
  idx: number;
  active: boolean;
  accent: string;
  onHover: () => void;
  onClick: () => void;
  icon?: ReactNode;
  label: string;
  sub?: string;
  hint?: string;
}) {
  return (
    <button
      data-idx={idx}
      type="button"
      onMouseEnter={onHover}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors ${
        active ? "bg-white/[0.06]" : ""
      }`}
    >
      {icon && (
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center opacity-80 [&>svg]:h-4 [&>svg]:w-4"
          style={active ? { color: accent } : { color: "var(--color-mute)" }}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-ink">{label}</span>
        {sub && <span className="block truncate text-[11px] text-faint">{sub}</span>}
      </span>
      {hint && (
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-faint">
          {hint}
        </span>
      )}
    </button>
  );
}
