"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useState } from "react";

export interface ShortcutSection {
  title: string;
  items: { keys: string[]; label: string }[];
}

/** Shortcuts every surface shares — the two apps extend this with their own. */
const BASE: ShortcutSection[] = [
  {
    title: "General",
    items: [
      { keys: ["⌘", "K"], label: "Command palette" },
      { keys: ["?"], label: "This shortcut map" },
      { keys: ["esc"], label: "Close any overlay" },
    ],
  },
  {
    title: "Navigation",
    items: [
      { keys: ["/"], label: "Focus the sidebar find" },
      { keys: ["↵"], label: "Go to the top find match" },
    ],
  },
  {
    title: "Layout",
    items: [{ keys: ["["], label: "Collapse or expand the sidebar" }],
  },
];

/**
 * The `?` keyboard map — every shortcut the shell offers, on one surface, in
 * kbd chips grouped by area. Opens on `?`, closes on `?` / Esc / backdrop.
 * Shared by both shells; each passes its own app-specific `extra` sections so
 * alpha's j/k rail and theta's don't leak across.
 */
export function KeyboardMap({
  accent,
  extra = [],
}: {
  accent: string;
  extra?: ShortcutSection[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sections = [...BASE, ...extra];

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-[16vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="overlay relative z-10 w-full max-w-md overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-edge px-4 py-3">
              <span className="text-[13px] font-medium text-ink">
                Keyboard shortcuts
              </span>
              <span
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: accent }}
              >
                press ? to close
              </span>
            </div>
            <div className="max-h-[62vh] overflow-y-auto p-2">
              {sections.map((sec) => (
                <div key={sec.title} className="px-1.5 pb-1.5">
                  <div className="px-1 pb-1 pt-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint">
                    {sec.title}
                  </div>
                  {sec.items.map((it) => (
                    <div
                      key={it.label}
                      className="flex items-center justify-between gap-3 rounded-md px-1 py-1.5"
                    >
                      <span className="text-[12.5px] text-mute">{it.label}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {it.keys.map((k, i) => (
                          <kbd key={i} className="kbd">
                            {k}
                          </kbd>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
