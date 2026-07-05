"use client";

import { AnimatePresence, m } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type Tone = "default" | "pos" | "warn" | "neg";

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastOptions {
  tone?: Tone;
  duration?: number;
}

const ToastContext = createContext<(message: string, opts?: ToastOptions) => void>(
  () => {},
);

const DOT: Record<Tone, string> = {
  default: "var(--color-mute)",
  pos: "var(--color-pos)",
  warn: "var(--color-warn)",
  neg: "var(--color-neg)",
};

/**
 * Lightweight transient confirmations — the "Portfolio imported · 24 positions"
 * / "Copied" acknowledgements the app used to perform silently. One stack,
 * bottom-right, on the shared `.overlay` elevation; each toast springs in, holds
 * briefly, and fades. Mounted once at the root so both apps share it; fire with
 * `const toast = useToast()`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, opts?: ToastOptions) => {
      const id = Date.now() + Math.random();
      setToasts((list) => [
        ...list,
        { id, message, tone: opts?.tone ?? "default" },
      ]);
      const ttl = opts?.duration ?? 3200;
      setTimeout(() => dismiss(id), ttl);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed bottom-4 right-4 z-[130] flex flex-col items-end gap-2">
            <AnimatePresence>
              {toasts.map((t) => (
                <m.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 480, damping: 34 }}
                  className="overlay pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5"
                  onClick={() => dismiss(t.id)}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: DOT[t.tone] }}
                  />
                  <span className="text-[12.5px] text-ink">{t.message}</span>
                </m.div>
              ))}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
