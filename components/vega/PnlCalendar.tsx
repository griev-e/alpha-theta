"use client";

import { m, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { fmtUSD } from "@/lib/format";

/**
 * The trading calendar — a GitHub-style heat grid of daily realized P&L over
 * the trailing weeks (weekdays only; the market is closed on weekends).
 * Intensity scales against the ledger's own biggest day, matching the house
 * rule of ranking a signal against its own history rather than a fixed
 * dollar threshold.
 */
export function PnlCalendar({
  daily,
  weeks = 14,
}: {
  daily: Map<string, number>;
  weeks?: number;
}) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<string | null>(null);

  const grid = useMemo(() => {
    // Columns of Mon–Fri, ending with the current week.
    const today = new Date();
    const dow = today.getDay();
    // Jump to this week's Friday (or today if mid-week — future cells render empty).
    const friday = new Date(today);
    friday.setDate(today.getDate() + (5 - (dow === 0 ? 7 : dow)));
    const cols: { key: string; pnl: number | null; future: boolean }[][] = [];
    for (let w = weeks - 1; w >= 0; w--) {
      const col: { key: string; pnl: number | null; future: boolean }[] = [];
      for (let d = 4; d >= 0; d--) {
        const day = new Date(friday);
        day.setDate(friday.getDate() - w * 7 - d);
        const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
        col.push({
          key,
          pnl: daily.has(key) ? (daily.get(key) as number) : null,
          future: day.getTime() > today.getTime(),
        });
      }
      cols.push(col);
    }
    let maxAbs = 0;
    for (const v of daily.values()) maxAbs = Math.max(maxAbs, Math.abs(v));
    return { cols, maxAbs };
  }, [daily, weeks]);

  const fill = (pnl: number | null): string => {
    if (pnl === null) return "rgba(255,255,255,0.04)";
    if (pnl === 0) return "rgba(255,255,255,0.10)";
    const heat = grid.maxAbs > 0 ? Math.max(0.25, Math.abs(pnl) / grid.maxAbs) : 0.5;
    const base = pnl > 0 ? "52,211,153" : "251,113,133";
    return `rgba(${base},${(0.15 + heat * 0.65).toFixed(2)})`;
  };

  return (
    <div className="flex gap-[3px] overflow-x-auto pb-1">
      {grid.cols.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-[3px]">
          {col.map((cell) =>
            cell.future ? (
              <div key={cell.key} className="h-[13px] w-[13px] rounded-[3px]" />
            ) : (
              <Tooltip
                key={cell.key}
                content={
                  <span className="font-mono tnum text-[11px]">
                    {cell.key}
                    {cell.pnl !== null ? (
                      <span className={cell.pnl >= 0 ? "text-pos" : "text-neg"}>
                        {" "}
                        {fmtUSD(cell.pnl)}
                      </span>
                    ) : (
                      <span className="text-faint"> no trades</span>
                    )}
                  </span>
                }
              >
                <m.div
                  initial={reduce ? false : { opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: ci * 0.015 }}
                  onMouseEnter={() => setHover(cell.key)}
                  onMouseLeave={() => setHover(null)}
                  className="h-[13px] w-[13px] rounded-[3px]"
                  style={{
                    background: fill(cell.pnl),
                    boxShadow:
                      hover === cell.key
                        ? "inset 0 0 0 1px rgba(255,255,255,0.5)"
                        : cell.pnl !== null
                          ? "inset 0 0 0 1px rgba(255,255,255,0.06)"
                          : "none",
                  }}
                />
              </Tooltip>
            )
          )}
        </div>
      ))}
    </div>
  );
}
