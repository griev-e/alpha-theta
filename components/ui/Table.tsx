"use client";

import {
  Fragment,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { m } from "framer-motion";

/**
 * The one table lathe (§65). The Overview holdings table is the reference
 * grammar — sortable header with a rotating chevron, right-aligned numeric
 * cells, a footer aggregate row, a sticky-glass header, a row-link chevron —
 * and this primitive turns that grammar into a column-def-driven component so
 * Dividends, Transactions, and every other list page inherit it instead of
 * re-spelling the markup (the single biggest structural inconsistency the
 * catalogue called out).
 *
 * Cells stay bespoke on purpose: each column supplies a `cell(row)` render, so
 * a page keeps its bars / chips / sparklines while the primitive owns only the
 * chrome — sort, sticky (§66), density (§67), footer, row-link, dividers.
 */

export type TableAlign = "left" | "right" | "center";
export type TableDensity = "comfortable" | "compact";

export type TableColumn<Row> = {
  /** Stable id — also the sort key when `sortable`. */
  key: string;
  header: ReactNode;
  align?: TableAlign;
  sortable?: boolean;
  /** Comparable value pulled from a row when this column is the active sort. */
  sortValue?: (row: Row) => number | string;
  /** The cell body. `sorted` is true while this column is the active sort, so
   *  a cell can brighten its figures one step (§117) without reading the head. */
  cell: (row: Row, ctx: { density: TableDensity; sorted: boolean }) => ReactNode;
  /** Extra classes on the `<th>` (beyond alignment). */
  headerClass?: string;
  /** Extra classes on every `<td>` in this column (beyond alignment/padding). */
  cellClass?: string;
  /** Fixed width utility, e.g. `"w-[92px]"`, applied to both head and cells. */
  width?: string;
};

const alignClass: Record<TableAlign, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

const justifyClass: Record<TableAlign, string> = {
  left: "justify-start",
  right: "justify-end",
  center: "justify-center",
};

/** Row padding per density — comfortable matches the Overview spec (py-3). */
export function densityPadY(density: TableDensity): string {
  return density === "compact" ? "py-1.5" : "py-3";
}

// ── Density: persisted per app ──────────────────────────────────────────────
// alpha and theta keep separate preferences, since a dense transaction ledger
// and a spacious holdings book want different defaults from the same person.

type DensityApp = "alpha" | "theta";
const DENSITY_KEY: Record<DensityApp, string> = {
  alpha: "alpha.table.density.v1",
  theta: "theta.table.density.v1",
};

// Module cache is the source of truth once seeded — so the toggle still works
// when localStorage is unavailable, and getSnapshot returns a stable value.
const densityCache: Partial<Record<DensityApp, TableDensity>> = {};

function readDensity(app: DensityApp): TableDensity {
  const cached = densityCache[app];
  if (cached) return cached;
  if (typeof window === "undefined") return "comfortable";
  const stored =
    window.localStorage.getItem(DENSITY_KEY[app]) === "compact"
      ? "compact"
      : "comfortable";
  densityCache[app] = stored;
  return stored;
}

// A tiny external store so density reads are hydration-safe (server always
// "comfortable") without a setState-in-effect, and a change in one table
// (or another tab) re-renders every table sharing the preference.
const densityListeners = new Set<() => void>();
function subscribeDensity(cb: () => void): () => void {
  densityListeners.add(cb);
  // Another tab writing a density key: drop the cache so getSnapshot re-reads.
  const onStorage = (e: StorageEvent) => {
    if (e.key === DENSITY_KEY.alpha || e.key === DENSITY_KEY.theta) {
      delete densityCache.alpha;
      delete densityCache.theta;
      cb();
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    densityListeners.delete(cb);
    if (typeof window !== "undefined")
      window.removeEventListener("storage", onStorage);
  };
}

/**
 * Density state for a page's tables, persisted per app. Hydration-safe via
 * `useSyncExternalStore`: the server snapshot is always "comfortable", so the
 * first client paint matches the SSR markup, then the stored preference takes
 * over — no hydration mismatch and no effect.
 */
export function useTableDensity(
  app: DensityApp
): [TableDensity, (next: TableDensity) => void] {
  const density = useSyncExternalStore(
    subscribeDensity,
    () => readDensity(app),
    () => "comfortable" as TableDensity
  );
  const update = useCallback(
    (next: TableDensity) => {
      densityCache[app] = next;
      try {
        window.localStorage.setItem(DENSITY_KEY[app], next);
      } catch {
        // Private-mode / quota — the cache above still drives the session.
      }
      densityListeners.forEach((l) => l());
    },
    [app]
  );
  return [density, update];
}

/** The comfortable/compact toggle — drop into a CardHeader's `right` slot. */
export function TableDensityToggle({
  value,
  onChange,
  className = "",
}: {
  value: TableDensity;
  onChange: (next: TableDensity) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Row density"
      className={`flex gap-0.5 rounded-md border border-edge p-0.5 ${className}`}
    >
      {(
        [
          ["comfortable", "Comfortable", ROWS_COMFORTABLE],
          ["compact", "Compact", ROWS_COMPACT],
        ] as [TableDensity, string, string][]
      ).map(([val, label, path]) => {
        const active = value === val;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            aria-pressed={active}
            title={label}
            aria-label={label}
            className={`relative rounded px-1.5 py-1 transition-colors ${
              active ? "text-ink" : "text-faint hover:text-ink"
            }`}
          >
            {active && (
              <m.span
                layoutId="table-density-thumb"
                className="absolute inset-0 rounded bg-white/[0.08]"
                style={{ boxShadow: "var(--edge-hi)" }}
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              />
            )}
            <svg
              viewBox="0 0 14 12"
              aria-hidden
              className="relative z-10 h-[11px] w-[13px]"
            >
              <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
// Two rows (comfortable) vs four rows (compact) — a density glyph, not text.
const ROWS_COMFORTABLE = "M1 3.5h12M1 8.5h12";
const ROWS_COMPACT = "M1 1.5h12M1 4.5h12M1 7.5h12M1 10.5h12";

// ── Sort header ─────────────────────────────────────────────────────────────

function SortHeader({
  label,
  align,
  active,
  asc,
  onClick,
}: {
  label: ReactNode;
  align: TableAlign;
  active: boolean;
  asc: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group/th w-full select-none px-6 py-3 transition-colors hover:text-ink ${alignClass[align]}`}
    >
      <span className={`inline-flex items-center gap-1 ${justifyClass[align]}`}>
        <span>{label}</span>
        <svg
          viewBox="0 0 10 6"
          aria-hidden
          className={`h-[6px] w-[10px] transition-all duration-200 ${
            asc ? "rotate-180" : ""
          } ${active ? "opacity-100" : "opacity-30 group-hover/th:opacity-60"}`}
        >
          <path
            d="M1 1l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );
}

// ── The table ───────────────────────────────────────────────────────────────

export type TableProps<Row> = {
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Initial sort. Omit for the rows' natural (as-supplied) order. */
  defaultSort?: { key: string; asc: boolean };
  /** Rows become links: whole-row click + keyboard + a hover chevron. */
  onRowClick?: (row: Row) => void;
  /** Per-row accent (the 2px edge that lights on hover), e.g. a symbol color. */
  rowAccent?: (row: Row) => string;
  /** A caller-built footer aggregate `<tr>` (use `densityPadY` to match). */
  footer?: (ctx: { density: TableDensity }) => ReactNode;
  /** Sticky-glass header that pins as the page scrolls under it (§66). */
  sticky?: boolean;
  /** Controlled density; defaults to comfortable when unset. */
  density?: TableDensity;
  /** Horizontal-scroll floor, e.g. `"min-w-[880px]"`. */
  minWidth?: string;
  emptyLabel?: string;
  /** Extra classes on the `<table>`. */
  className?: string;
};

export function Table<Row>({
  columns,
  rows,
  rowKey,
  defaultSort,
  onRowClick,
  rowAccent,
  footer,
  sticky = false,
  density = "comfortable",
  minWidth,
  emptyLabel = "Nothing to show.",
  className = "",
}: TableProps<Row>) {
  const [sortKey, setSortKey] = useState<string | null>(
    defaultSort?.key ?? null
  );
  const [asc, setAsc] = useState<boolean>(defaultSort?.asc ?? false);

  const colMap = useMemo(
    () => new Map(columns.map((c) => [c.key, c])),
    [columns]
  );

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = colMap.get(sortKey);
    if (!col?.sortValue) return rows;
    const pick = col.sortValue;
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = pick(a);
      const bv = pick(b);
      const cmp =
        typeof av === "string" || typeof bv === "string"
          ? String(av).localeCompare(String(bv))
          : (av as number) - (bv as number);
      return asc ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, asc, colMap]);

  const toggleSort = (key: string) => {
    const col = colMap.get(key);
    if (!col?.sortable) return;
    if (key === sortKey) {
      setAsc((v) => !v);
    } else {
      setSortKey(key);
      // Text columns read most naturally A→Z; figures big→small.
      const sample = rows.length ? col.sortValue?.(rows[0]) : undefined;
      setAsc(typeof sample === "string");
    }
  };

  const padY = densityPadY(density);
  const linkable = !!onRowClick;
  const totalCols = columns.length + (linkable ? 1 : 0);

  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${minWidth ?? ""} text-[13px] ${className}`}>
        <thead>
          {/* Sticky lives on the cells, not <thead>/<tr> — Chromium only honors
              position:sticky on table cells, so §66 pins reliably this way. */}
          <tr className="text-left">
            {columns.map((c) => {
              const align = c.align ?? "left";
              const isActive = sortKey === c.key;
              return (
                <th
                  key={c.key}
                  aria-sort={
                    c.sortable
                      ? isActive
                        ? asc
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                  className={`border-b border-edge px-0 py-0 text-[11.5px] font-medium uppercase tracking-[0.04em] ${
                    alignClass[align]
                  } ${isActive ? "text-mint" : "text-faint"} ${
                    sticky ? "sticky top-0 z-10 bg-[var(--color-panel)]" : ""
                  } ${c.width ?? ""} ${c.headerClass ?? ""}`}
                >
                  {c.sortable ? (
                    <SortHeader
                      label={c.header}
                      align={align}
                      active={isActive}
                      asc={asc}
                      onClick={() => toggleSort(c.key)}
                    />
                  ) : (
                    <div className={`px-6 py-3 ${alignClass[align]}`}>
                      {c.header}
                    </div>
                  )}
                </th>
              );
            })}
            {linkable && (
              <th
                className={`w-8 border-b border-edge px-0 py-0 ${
                  sticky ? "sticky top-0 z-10 bg-[var(--color-panel)]" : ""
                }`}
                aria-hidden
              />
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={totalCols}
                className="px-6 py-10 text-center text-[13px] text-faint"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            sorted.map((row) => {
              const accent = rowAccent?.(row);
              const open = onRowClick ? () => onRowClick(row) : undefined;
              return (
                <tr
                  key={rowKey(row)}
                  onClick={open}
                  onKeyDown={
                    open
                      ? (e) => {
                          if (e.key === "Enter") open();
                        }
                      : undefined
                  }
                  role={linkable ? "link" : undefined}
                  tabIndex={linkable ? 0 : undefined}
                  className={`group relative border-b border-edge/60 transition-colors ${
                    linkable ? "cursor-pointer hover:bg-white/[0.03]" : ""
                  }`}
                >
                  {columns.map((c, ci) => {
                    const align = c.align ?? "left";
                    return (
                      <td
                        key={c.key}
                        className={`relative px-6 ${padY} ${alignClass[align]} ${
                          c.width ?? ""
                        } ${c.cellClass ?? ""}`}
                      >
                        {/* Accent edge on the first cell — lights on row hover. */}
                        {ci === 0 && accent && (
                          <span
                            aria-hidden
                            className="absolute inset-y-[6px] left-0 w-[2px] rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                            style={{ background: accent }}
                          />
                        )}
                        {c.cell(row, { density, sorted: sortKey === c.key })}
                      </td>
                    );
                  })}
                  {linkable && (
                    <td className="w-8 pr-4 text-right align-middle">
                      <svg
                        viewBox="0 0 6 10"
                        aria-hidden
                        className="ml-auto h-[10px] w-[6px] text-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                      >
                        <path
                          d="M1 1l4 4-4 4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
        {footer && <tfoot>{footer({ density })}</tfoot>}
      </table>
    </div>
  );
}

/**
 * A sticky section header for grouped tables (§70) — pins while its group
 * scrolls, carrying a right-aligned running total. Rendered as a full-width
 * `<tr>` inside a `<tbody>`; pass the table's column count as `span`. The
 * sticky lives on the `<td>` (Chromium ignores it on `<tr>`), so the caller's
 * `<tr>` needs no styling of its own.
 */
export function TableGroupHeader({
  label,
  total,
  span,
  sticky = true,
  top = "top-0",
  tint = true,
}: {
  label: ReactNode;
  total?: ReactNode;
  span: number;
  sticky?: boolean;
  /** Offset below the column header when both are sticky, e.g. `"top-[41px]"`. */
  top?: string;
  /** Faint fill so the band reads as a divider even when not pinned. */
  tint?: boolean;
}) {
  return (
    <tr>
      <td
        colSpan={span}
        className={`border-b border-edge/60 px-6 py-2 ${
          sticky
            ? `sticky ${top} z-[5] bg-[var(--color-panel)]`
            : tint
              ? "bg-white/[0.015]"
              : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-faint">
            {label}
          </span>
          {total != null && (
            <span className="font-mono tnum text-[11px] text-mute">{total}</span>
          )}
        </div>
      </td>
    </tr>
  );
}

export { Fragment as TableFragment };
