"use client";

import { AnimatePresence, m } from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

type Coords = { top: number; left: number; width: number; up: boolean };

/**
 * Owned dropdown — a styled listbox that replaces the native `<select>`, whose
 * option popover renders OS-white over the app's near-black theme (the one
 * unstyleable surface in the UI). The panel floats on the shared `.overlay`
 * elevation through a portal, so it never clips inside a scrolling modal, and
 * it's fully keyboard-driven (type-ahead aside): ↑/↓ move, Enter selects,
 * Esc closes.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
}: {
  value: T;
  onChange: (next: T) => void;
  options: SelectOption<T>[];
  ariaLabel?: string;
  className?: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];

  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const listH = Math.min(options.length * 32 + 8, 240);
    const spaceBelow = window.innerHeight - r.bottom;
    const up = spaceBelow < listH + 12 && r.top > spaceBelow;
    setCoords({
      top: up ? r.top - 6 : r.bottom + 6,
      left: r.left,
      width: r.width,
      up,
    });
  }, [options.length]);

  const openMenu = () => {
    place();
    setActive(selectedIndex);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => place();
    const onDown = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !listRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open, place]);

  const choose = (i: number) => {
    const opt = options[i];
    if (opt) onChange(opt.value);
    setOpen(false);
    btnRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      btnRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`field flex cursor-pointer items-center justify-between gap-2 text-left ${className}`}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? ""}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 8"
          className={`shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M1 1l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && coords && (
              <m.div
                ref={listRef}
                role="listbox"
                aria-label={ariaLabel}
                initial={{ opacity: 0, y: coords.up ? 4 : -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: coords.up ? 4 : -4 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "fixed",
                  top: coords.top,
                  left: coords.left,
                  width: coords.width,
                  transform: coords.up ? "translateY(-100%)" : undefined,
                  zIndex: 9999,
                }}
                className="overlay max-h-60 overflow-y-auto py-1"
              >
                {options.map((o, i) => {
                  const isSel = o.value === value;
                  const isActive = i === active;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={isSel}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(i)}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[12.5px] transition-colors ${
                        isActive ? "bg-white/[0.06] text-ink" : "text-mute"
                      }`}
                    >
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-mint">
                        {isSel && (
                          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 10.5 L8 14.5 L16 5.5" />
                          </svg>
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    </button>
                  );
                })}
              </m.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
