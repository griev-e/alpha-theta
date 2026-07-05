"use client";

import { m } from "framer-motion";
import { Fragment, useState } from "react";
import type { SankeyLink, SankeyNode } from "@/lib/theta/sankey";
import { fmtUSDCompact } from "@/lib/format";

/**
 * A layered (column-based) Sankey, hand-built in SVG — no chart library. Every
 * column carries the same total value (the model is conserved), so one scale
 * makes node heights and ribbon widths comparable across the whole diagram.
 *
 * Ribbons animate their width in from the source; nodes grow from their center;
 * hovering a node highlights the flows it touches and dims the rest.
 */

const NODE_W = 13;
const GAP = 15;
const VBW = 760;
const PAD_X = 8;
const PAD_Y = 24;
const LABEL_DY = 8;

interface Placed extends SankeyNode {
  x: number;
  y: number;
  h: number;
  col: number;
}

/** Cubic-bezier ribbon between a source right edge and a target left edge. */
function ribbon(sx: number, sy0: number, sy1: number, tx: number, ty0: number, ty1: number): string {
  const mx = (sx + tx) / 2;
  return [
    `M ${sx} ${sy0}`,
    `C ${mx} ${sy0}, ${mx} ${ty0}, ${tx} ${ty0}`,
    `L ${tx} ${ty1}`,
    `C ${mx} ${ty1}, ${mx} ${sy1}, ${sx} ${sy1}`,
    "Z",
  ].join(" ");
}

export function Sankey({
  columns,
  links,
  total,
  height = 340,
}: {
  columns: SankeyNode[][];
  links: SankeyLink[];
  total: number;
  height?: number;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const nCols = columns.length;
  const usableH = height - 2 * PAD_Y;
  // One scale for the whole diagram: pick it so the tallest column (most nodes,
  // most gap) fits the usable height. Every column shares the same total value,
  // so node heights stay comparable left-to-right.
  const maxCount = Math.max(...columns.map((c) => c.length), 1);
  const scale = total > 0 ? Math.max(0, usableH - (maxCount - 1) * GAP) / total : 0;

  // Column x positions, evenly distributed across the usable width.
  const colX = (col: number): number => {
    if (nCols === 1) return (VBW - NODE_W) / 2;
    const span = VBW - 2 * PAD_X - NODE_W;
    return PAD_X + (span * col) / (nCols - 1);
  };

  // Place every node.
  const placed = new Map<string, Placed>();
  columns.forEach((nodes, col) => {
    const colTotal = nodes.reduce((s, n) => s + n.value, 0);
    const colH = colTotal * scale + Math.max(0, nodes.length - 1) * GAP;
    let y = PAD_Y + (usableH - colH) / 2;
    const x = colX(col);
    for (const n of nodes) {
      const h = n.value * scale;
      placed.set(n.id, { ...n, x, y, h, col });
      y += h + GAP;
    }
  });

  // Lay ribbons along each node's edges, stacking in link order (which the
  // model emits top-to-bottom to match the node stacks).
  const outOff = new Map<string, number>();
  const inOff = new Map<string, number>();
  const ribbons = links.map((link, i) => {
    const s = placed.get(link.source);
    const t = placed.get(link.target);
    const th = link.value * scale;
    const so = outOff.get(link.source) ?? 0;
    const to = inOff.get(link.target) ?? 0;
    outOff.set(link.source, so + th);
    inOff.set(link.target, to + th);
    if (!s || !t) return null;
    const sx = s.x + NODE_W;
    const sy0 = s.y + so;
    const tx = t.x;
    const ty0 = t.y + to;
    const active = hover === null || hover === link.source || hover === link.target;
    return (
      <m.path
        key={`${link.source}->${link.target}-${i}`}
        d={ribbon(sx, sy0, sy0 + th, tx, ty0, ty0 + th)}
        fill={link.color}
        initial={{ opacity: 0 }}
        animate={{ opacity: active ? 0.34 : 0.07 }}
        transition={{ duration: 0.5, delay: 0.15 + i * 0.03 }}
      />
    );
  });

  const allNodes = [...placed.values()];

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${VBW} ${height}`}
        width="100%"
        style={{ minWidth: 520, height }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Cash-flow Sankey: income sources flowing into spending categories and savings."
      >
        <g>{ribbons}</g>
        {allNodes.map((n, i) => {
          const dim = hover !== null && hover !== n.id;
          const isLeft = n.col === 0;
          const isRight = n.col === nCols - 1;
          // Left column labels sit left-aligned above the node; right column
          // right-aligned; interior (hub) centered on the node.
          const labelX = isLeft ? n.x : isRight ? n.x + NODE_W : n.x + NODE_W / 2;
          const anchor = isLeft ? "start" : isRight ? "end" : "middle";
          return (
            <Fragment key={n.id}>
              <m.rect
                x={n.x}
                width={NODE_W}
                rx={3}
                fill={n.color}
                initial={{ height: 0, y: n.y + n.h / 2, opacity: 0 }}
                animate={{
                  height: Math.max(n.h, 1.5),
                  y: n.y,
                  opacity: dim ? 0.4 : 1,
                }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.03 }}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "default" }}
              />
              <text
                x={labelX}
                y={n.y - LABEL_DY}
                textAnchor={anchor}
                style={{ fill: "var(--color-mute)", fontSize: 11, opacity: dim ? 0.4 : 1 }}
                className="font-medium"
              >
                {n.label}
                <tspan style={{ fill: "var(--color-faint)" }}> · {fmtUSDCompact(n.value)}</tspan>
              </text>
            </Fragment>
          );
        })}
      </svg>
    </div>
  );
}
