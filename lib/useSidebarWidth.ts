"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_WIDTH = 180;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 240;
const KEY_STEP = 16;

/**
 * Persisted, drag-to-resize sidebar width. Reads/writes localStorage under
 * `storageKey` so each app (alpha/theta) remembers its own width across
 * reloads. `onMouseDown` + `onDoubleClick` + `onKeyDown` all go on the same
 * thin handle at the sidebar's right edge, so the resize affordance works for
 * mouse, dblclick-to-reset, and keyboard (arrow keys nudge, Home resets) alike.
 */
export function useSidebarWidth(storageKey: string) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (saved && saved >= MIN_WIDTH && saved <= MAX_WIDTH) setWidth(saved);
    } catch {
      /* private mode — fall back to the default width */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!dragging) return;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (e: MouseEvent) => {
      const next = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, startWidth.current + (e.clientX - startX.current))
      );
      setWidth(next);
    };
    const onUp = () => {
      setDragging(false);
      setWidth((w) => {
        try {
          localStorage.setItem(storageKey, String(w));
        } catch {
          /* private mode — width just won't persist */
        }
        return w;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging, storageKey]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startX.current = e.clientX;
      startWidth.current = width;
      setDragging(true);
    },
    [width]
  );

  const persist = useCallback(
    (w: number) => {
      setWidth(w);
      try {
        localStorage.setItem(storageKey, String(w));
      } catch {
        /* private mode — width just won't persist */
      }
    },
    [storageKey]
  );

  const onDoubleClick = useCallback(() => persist(DEFAULT_WIDTH), [persist]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        persist(Math.max(MIN_WIDTH, width - KEY_STEP));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        persist(Math.min(MAX_WIDTH, width + KEY_STEP));
      } else if (e.key === "Home") {
        e.preventDefault();
        persist(DEFAULT_WIDTH);
      }
    },
    [width, persist]
  );

  return {
    width,
    dragging,
    onMouseDown,
    onDoubleClick,
    onKeyDown,
    min: MIN_WIDTH,
    max: MAX_WIDTH,
  };
}
