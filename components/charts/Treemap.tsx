"use client";

import { AnimatePresence, m } from "framer-motion";
import { memo, useMemo, useState } from "react";
import { fmtPct, fmtUSDCompact } from "@/lib/format";
import { useElementWidth } from "@/lib/useElementWidth";
import { ChartTooltip } from "./ChartTooltip";

export interface TreemapItem {
  id: string;
  label: string;
  value: number;
  /** Drives cell color, e.g. return % (clamped ±25%). */
  intensity: number;
  /** Optional total for a weight readout in the hover tooltip. */
  total?: number;
  /** Grouping key for sector mode (§59) — e.g. the holding's dominant sector. */
  group?: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  item: TreemapItem;
}

/** A positioned holding cell (absolute pixel coords). */
interface Cell {
  id: string;
  label: string;
  value: number;
  intensity: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A faint sector container drawn behind its holdings in sector mode. */
interface Container {
  key: string;
  value: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Squarified treemap layout (Bruls, Huizing & van Wijk). */
function squarify(items: TreemapItem[], x: number, y: number, w: number, h: number): Rect[] {
  const total = items.reduce((s, d) => s + d.value, 0);
  if (total <= 0 || items.length === 0 || w <= 0 || h <= 0) return [];
  const scaled = items
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((item) => ({ item, area: (item.value / total) * w * h }));

  const rects: Rect[] = [];
  let row: typeof scaled = [];
  let rx = x;
  let ry = y;
  let rw = w;
  let rh = h;

  const worst = (r: typeof scaled, side: number): number => {
    const sum = r.reduce((s, d) => s + d.area, 0);
    const max = Math.max(...r.map((d) => d.area));
    const min = Math.min(...r.map((d) => d.area));
    const s2 = sum * sum;
    return Math.max((side * side * max) / s2, s2 / (side * side * min));
  };

  const layoutRow = (r: typeof scaled) => {
    const sum = r.reduce((s, d) => s + d.area, 0);
    const horizontal = rw >= rh;
    const side = horizontal ? rh : rw;
    const thickness = sum / side;
    let offset = 0;
    for (const d of r) {
      const len = d.area / thickness;
      rects.push(
        horizontal
          ? { x: rx, y: ry + offset, w: thickness, h: len, item: d.item }
          : { x: rx + offset, y: ry, w: len, h: thickness, item: d.item }
      );
      offset += len;
    }
    if (horizontal) {
      rx += thickness;
      rw -= thickness;
    } else {
      ry += thickness;
      rh -= thickness;
    }
  };

  for (const d of scaled) {
    const side = Math.min(rw, rh);
    if (row.length === 0 || worst([...row, d], side) <= worst(row, side)) {
      row.push(d);
    } else {
      layoutRow(row);
      row = [d];
    }
  }
  if (row.length) layoutRow(row);
  return rects;
}

const SECTOR_HEADER = 21; // room for the container's label row
const SECTOR_GAP = 4;

/**
 * Lay the items out flat (holdings mode) or nested under sector containers
 * (§59): squarify the sector totals into the frame, then squarify each
 * sector's holdings inside its container, below a label header. Cells keep a
 * stable id across both modes so the toggle can morph them between positions.
 */
function layout(
  items: TreemapItem[],
  grouped: boolean,
  W: number,
  H: number
): { cells: Cell[]; containers: Container[] } {
  const toCell = (r: Rect): Cell => ({
    id: r.item.id,
    label: r.item.label,
    value: r.item.value,
    intensity: r.item.intensity,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
  });

  if (!grouped) {
    return { cells: squarify(items, 0, 0, W, H).map(toCell), containers: [] };
  }

  const groups = new Map<string, TreemapItem[]>();
  for (const it of items) {
    if (it.value <= 0) continue;
    const key = it.group ?? "Other";
    const arr = groups.get(key);
    if (arr) arr.push(it);
    else groups.set(key, [it]);
  }

  const groupItems: TreemapItem[] = [...groups.entries()].map(([key, its]) => ({
    id: `__grp_${key}`,
    label: key,
    value: its.reduce((s, d) => s + Math.max(0, d.value), 0),
    intensity: 0,
  }));

  const containers: Container[] = [];
  const cells: Cell[] = [];
  for (const cr of squarify(groupItems, 0, 0, W, H)) {
    containers.push({ key: cr.item.label, value: cr.item.value, x: cr.x, y: cr.y, w: cr.w, h: cr.h });
    const ix = cr.x + SECTOR_GAP;
    const iy = cr.y + SECTOR_HEADER;
    const iw = Math.max(0, cr.w - SECTOR_GAP * 2);
    const ih = Math.max(0, cr.h - SECTOR_HEADER - SECTOR_GAP);
    for (const r of squarify(groups.get(cr.item.label)!, ix, iy, iw, ih)) cells.push(toCell(r));
  }
  return { cells, containers };
}

function cellColor(intensity: number): { bg: string; border: string } {
  // intensity: return fraction, clamped to ±0.25 → rose..slate..mint
  const t = Math.max(-1, Math.min(1, intensity / 0.25));
  if (t >= 0) {
    const a = 0.06 + t * 0.22;
    return {
      bg: `rgba(52, 211, 153, ${a})`,
      border: `rgba(52, 211, 153, ${0.18 + t * 0.4})`,
    };
  }
  const a = 0.06 + -t * 0.22;
  return {
    bg: `rgba(251, 113, 133, ${a})`,
    border: `rgba(251, 113, 133, ${0.18 + -t * 0.4})`,
  };
}

export const Treemap = memo(function Treemap({
  items,
  height = 360,
  activeId,
  onActiveChange,
  grouped = false,
}: {
  items: TreemapItem[];
  height?: number;
  /** Controlled highlight — a cell lights up in sync with a sibling chart or
   *  table. Uncontrolled (no `onActiveChange`) it manages its own hover. */
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  /** Sector mode (§59): group cells under faint sector containers. */
  grouped?: boolean;
}) {
  // Real pixel coordinates: cells and labels never stretch with the viewport.
  const [wrapRef, W] = useElementWidth<HTMLDivElement>();
  const { cells, containers } = useMemo(
    () => (W > 0 ? layout(items, grouped, W, height) : { cells: [], containers: [] }),
    [items, grouped, W, height]
  );
  const [internalActive, setInternalActive] = useState<string | null>(null);
  const controlled = onActiveChange !== undefined;
  const active = controlled ? activeId ?? null : internalActive;
  const setActive = (id: string | null) => {
    if (!controlled) setInternalActive(id);
    onActiveChange?.(id);
  };
  const total = useMemo(
    () => items.reduce((s, d) => s + Math.max(0, d.value), 0),
    [items]
  );
  const activeCell = active ? cells.find((c) => c.id === active) : null;
  // Cells morph on regroup; only stagger their first appearance.
  const cellTransition = { type: "spring" as const, stiffness: 240, damping: 28 };

  return (
    <div ref={wrapRef} style={{ height }} className="relative w-full">
      {W > 0 && (
        <svg
          width={W}
          height={height}
          role="img"
          aria-label={
            grouped
              ? `Treemap of ${cells.length} holdings grouped into ${containers.length} sectors, each sized by market value and shaded by return.`
              : `Treemap of ${cells.length} holdings, each sized by market value and shaded by return.`
          }
        >
          <defs>
            {/* Soft cast shadow for the hovered cell — a tile lifting under the
                app's light, matching the panel physics. */}
            <filter id="tm-lift" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.55" />
            </filter>
          </defs>

          {/* Faint sector containers behind the cells (sector mode only). */}
          <AnimatePresence>
            {containers.map((c) => (
              <m.g
                key={`grp-${c.key}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <rect
                  x={c.x + 1.5}
                  y={c.y + 1.5}
                  width={Math.max(0, c.w - 3)}
                  height={Math.max(0, c.h - 3)}
                  rx={11}
                  fill="rgba(255,255,255,0.015)"
                  stroke="rgba(255,255,255,0.09)"
                  strokeWidth={1}
                />
                {c.w > 80 && (
                  <text
                    x={c.x + 11}
                    y={c.y + 15}
                    className="font-mono uppercase"
                    style={{ fontSize: 10.5, letterSpacing: "0.05em" }}
                    fill="var(--color-faint)"
                  >
                    {c.key}
                    <tspan dx={7} fill="var(--color-faint)" style={{ opacity: 0.7 }}>
                      {fmtUSDCompact(c.value)}
                    </tspan>
                  </text>
                )}
              </m.g>
            ))}
          </AnimatePresence>

          {cells.map((c, i) => {
            const { bg, border } = cellColor(c.intensity);
            const isActive = active === c.id;
            const pad = 3;
            const showLabel = c.w > 68 && c.h > 46;
            const showSub = c.w > 92 && c.h > 74;
            return (
              <m.g
                key={c.id}
                initial={{ opacity: 0, x: c.x, y: c.y }}
                animate={{ opacity: 1, x: c.x, y: c.y }}
                transition={{
                  ...cellTransition,
                  opacity: { duration: 0.5, delay: Math.min(i * 0.03, 0.45) },
                }}
                onMouseEnter={() => setActive(c.id)}
                onMouseLeave={() => setActive(null)}
                className="cursor-default"
              >
                <m.rect
                  x={pad}
                  y={pad}
                  animate={{ width: Math.max(0, c.w - pad * 2), height: Math.max(0, c.h - pad * 2) }}
                  transition={cellTransition}
                  rx={9}
                  fill={bg}
                  stroke={isActive ? "rgba(231,236,244,0.55)" : border}
                  strokeWidth={isActive ? 2 : 1.2}
                  style={{
                    transform: isActive ? "translateY(-1.5px)" : undefined,
                    transition: "transform 150ms ease",
                    filter: isActive ? "url(#tm-lift)" : undefined,
                  }}
                />
                {showLabel && (
                  <>
                    <text
                      x={12}
                      y={28}
                      fill="var(--color-ink)"
                      style={{ fontSize: 18, fontWeight: 600 }}
                      className="font-display"
                    >
                      {c.label}
                    </text>
                    <text
                      x={12}
                      y={49}
                      fill="var(--color-mute)"
                      style={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}
                      className="font-mono"
                    >
                      {fmtUSDCompact(c.value)}
                    </text>
                    {showSub && (
                      <text
                        x={12}
                        y={68}
                        fill={c.intensity >= 0 ? "var(--color-pos)" : "var(--color-neg)"}
                        style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}
                        className="font-mono"
                      >
                        {fmtPct(c.intensity, 1, true)}
                      </text>
                    )}
                  </>
                )}
              </m.g>
            );
          })}
        </svg>
      )}
      {activeCell && (
        <ChartTooltip
          left={Math.min(Math.max(activeCell.x + activeCell.w / 2, 70), W - 70)}
          top={activeCell.y + 4}
          place={activeCell.y < 56 ? "bottom" : "top"}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-medium text-ink">
              {activeCell.label}
            </span>
            <span
              className={`font-mono tnum text-[11px] ${
                activeCell.intensity >= 0 ? "text-pos" : "text-neg"
              }`}
            >
              {fmtPct(activeCell.intensity, 1, true)}
            </span>
          </div>
          <div className="mt-0.5 font-mono tnum text-[11px] text-mute">
            {fmtUSDCompact(activeCell.value)}
            {total > 0 && (
              <span className="text-faint">
                {" · "}
                {fmtPct(activeCell.value / total, 1)} of book
              </span>
            )}
          </div>
        </ChartTooltip>
      )}
    </div>
  );
});
