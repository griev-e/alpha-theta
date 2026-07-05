"use client";

import { AnimatePresence, m } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * A 2px progress bar pinned to the very top of the viewport — the Vercel/GitHub
 * navigation cue. App Router client transitions are fast and fire no loading
 * event, so this runs a short perceived-progress sweep keyed to the pathname
 * (a quick trickle to ~90% then a snap to 100% and fade). It also shows an
 * indeterminate shimmer whenever `loading` is true (a live-data refresh), so
 * the same bar covers both "navigating" and "fetching".
 *
 * `accent` is the app's brand color so alpha and theta read distinctly.
 */
export function TopProgress({
  accent,
  loading = false,
}: {
  accent: string;
  loading?: boolean;
}) {
  const pathname = usePathname();
  const [value, setValue] = useState(0);
  const [visible, setVisible] = useState(false);
  const firstRender = useRef(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Route-change sweep. Skip the very first render so the bar doesn't flash on
  // initial load.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setVisible(true);
    setValue(0.08);
    timers.current.push(setTimeout(() => setValue(0.65), 60));
    timers.current.push(setTimeout(() => setValue(0.9), 220));
    timers.current.push(setTimeout(() => setValue(1), 420));
    timers.current.push(setTimeout(() => setVisible(false), 600));
    return () => timers.current.forEach(clearTimeout);
  }, [pathname]);

  const show = visible || loading;

  return (
    <AnimatePresence>
      {show && (
        <m.div
          className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {loading && !visible ? (
            // Indeterminate: a light glides across while data refreshes.
            <m.div
              className="h-full w-1/3 rounded-full"
              style={{
                background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              }}
              animate={{ x: ["-100%", "400%"] }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : (
            <m.div
              className="h-full rounded-r-full"
              style={{
                background: accent,
                boxShadow: `0 0 8px ${accent}`,
              }}
              animate={{ width: `${value * 100}%` }}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
            />
          )}
        </m.div>
      )}
    </AnimatePresence>
  );
}
