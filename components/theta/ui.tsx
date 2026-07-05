"use client";

import { AnimatePresence, m } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { Mark } from "@/components/shell/brand";
import { EmptyPanel } from "@/components/ui/EmptyState";
import { useTheta } from "@/lib/theta/store";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Centered modal dialog — backdrop click + Escape close it. Traps Tab inside
 * the dialog while open, focuses its first control on open, and returns focus
 * to whatever triggered it on close, so opening one from the keyboard doesn't
 * strand focus behind the overlay.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);

    const raf = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    });

    return () => {
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
      restoreFocusTo.current?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="panel relative z-10 w-full max-w-md p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-[15px] font-medium text-ink">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="btn-ghost">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>
            {children}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

/** Labeled text/number input wrapping the global `.field` style. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 block">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`field ${props.className ?? ""}`} />;
}

/** A compact accessible on/off switch, tuned for the dark theta surface. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-vio/70" : "bg-white/[0.08]"
      }`}
    >
      <span
        className="absolute h-[13px] w-[13px] rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? "translateX(16px)" : "translateX(3px)" }}
      />
    </button>
  );
}

export function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className="field cursor-pointer appearance-none pr-8"
      >
        {children}
      </select>
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 8"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M1 1l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** A small ghost icon button (trash, edit) revealed on row hover. */
export function IconButton({
  onClick,
  label,
  danger = false,
  children,
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`btn-ghost ${danger ? "danger" : ""}`}
    >
      {children}
    </button>
  );
}

export function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6M6.5 6l.6 9.5A1.5 1.5 0 0 0 8.6 17h2.8a1.5 1.5 0 0 0 1.5-1.5L13.5 6" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

/**
 * Small pill button used for header actions ("Add", "Mark paid") — same
 * height and radius as `.btn-primary`/`.btn-secondary` so it reads as the
 * same button system with room for a leading icon.
 */
export function ActionButton({
  onClick,
  children,
  variant = "secondary",
}: {
  onClick: () => void;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      onClick={onClick}
      className={`gap-1.5 ${variant === "primary" ? "btn-primary" : "btn-secondary"}`}
    >
      {children}
    </button>
  );
}

/** Shown on theta pages when the ledger is empty (after Clear). */
export function ThetaEmpty({ page }: { page: string }) {
  const { loadSample } = useTheta();
  return (
    <EmptyPanel
      icon={<Mark kind="theta" size={44} />}
      heading="No data yet"
      body={`${page} needs accounts and transactions. Load the sample ledger to explore, or import your own.`}
      primary={
        <button onClick={loadSample} className="btn-primary">
          Load sample
        </button>
      }
      secondary={
        <Link href="/theta/import" className="btn-secondary">
          Import
        </Link>
      }
    />
  );
}
