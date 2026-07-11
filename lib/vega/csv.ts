import { splitCsvLine } from "@/lib/csvCore";
import type { NewTrade, TradeSide } from "./types";

/**
 * Journal CSV round-trip. Export writes a canonical header; import is
 * forgiving in the house style — any column order, `$`/`,` formatting,
 * header-name aliases — and skips unusable rows instead of failing the file.
 */

const COLUMNS = [
  "symbol",
  "side",
  "qty",
  "entry",
  "exit",
  "stop",
  "target",
  "fees",
  "entryAt",
  "exitAt",
  "setup",
  "notes",
] as const;

const esc = (v: string): string =>
  /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

export function tradesToCsv(trades: NewTrade[]): string {
  const rows = trades.map((t) =>
    [
      t.symbol,
      t.side,
      String(t.qty),
      String(t.entry),
      t.exit === null || t.exit === undefined ? "" : String(t.exit),
      t.stop === undefined ? "" : String(t.stop),
      t.target === undefined ? "" : String(t.target),
      t.fees === undefined ? "" : String(t.fees),
      t.entryAt,
      t.exitAt ?? "",
      t.setup ?? "",
      t.notes ?? "",
    ]
      .map(esc)
      .join(",")
  );
  return [COLUMNS.join(","), ...rows].join("\n");
}

/** Header aliases → canonical column. */
const ALIASES: Record<string, (typeof COLUMNS)[number]> = {
  symbol: "symbol",
  ticker: "symbol",
  side: "side",
  direction: "side",
  qty: "qty",
  quantity: "qty",
  shares: "qty",
  size: "qty",
  entry: "entry",
  entryprice: "entry",
  exit: "exit",
  exitprice: "exit",
  stop: "stop",
  stoploss: "stop",
  target: "target",
  fees: "fees",
  commission: "fees",
  entryat: "entryAt",
  entrytime: "entryAt",
  entrydate: "entryAt",
  opened: "entryAt",
  exitat: "exitAt",
  exittime: "exitAt",
  exitdate: "exitAt",
  closed: "exitAt",
  setup: "setup",
  strategy: "setup",
  playbook: "setup",
  notes: "notes",
  note: "notes",
};

const parseNum = (raw: string): number | null => {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned.length === 0) return null;
  const neg = /^\(.*\)$/.test(cleaned);
  const v = Number(neg ? cleaned.slice(1, -1) : cleaned);
  return Number.isFinite(v) ? (neg ? -v : v) : null;
};

/** Accept "2026-07-10", "2026-07-10 09:41", or full ISO; normalize to ISO. */
const parseWhen = (raw: string): string | null => {
  const s = raw.trim();
  if (s.length === 0) return null;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  // A bare date stays a date (avoids timezone drift on day buckets).
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00.000Z` : new Date(t).toISOString();
};

export interface TradesCsvResult {
  trades: NewTrade[];
  skipped: number;
}

export function parseTradesCsv(text: string): TradesCsvResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return { trades: [], skipped: 0 };

  const header = splitCsvLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/[^a-z]/g, "")
  );
  const col: Partial<Record<(typeof COLUMNS)[number], number>> = {};
  header.forEach((h, i) => {
    const canon = ALIASES[h];
    if (canon && col[canon] === undefined) col[canon] = i;
  });
  if (col.symbol === undefined || col.qty === undefined || col.entry === undefined) {
    return { trades: [], skipped: lines.length - 1 };
  }

  const trades: NewTrade[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const at = (c?: number): string => (c !== undefined ? (cells[c] ?? "").trim() : "");
    const symbol = at(col.symbol).toUpperCase().replace(/[^A-Z0-9.\-^]/g, "");
    const qty = parseNum(at(col.qty));
    const entry = parseNum(at(col.entry));
    if (!symbol || qty === null || qty <= 0 || entry === null || entry <= 0) {
      skipped += 1;
      continue;
    }
    // "short"/"sh"/"s" mean short; anything else (long, buy, sell-to-close…)
    // defaults to long — the honest read of ambiguous broker exports.
    const sideRaw = at(col.side).toLowerCase();
    const side: TradeSide =
      sideRaw === "s" || sideRaw.startsWith("sh") ? "short" : "long";
    const exit = parseNum(at(col.exit));
    const stop = parseNum(at(col.stop));
    const target = parseNum(at(col.target));
    const fees = parseNum(at(col.fees));
    const entryAt = parseWhen(at(col.entryAt)) ?? new Date().toISOString();
    const exitAt = parseWhen(at(col.exitAt));
    trades.push({
      symbol,
      side,
      qty,
      entry,
      exit: exit !== null && exit > 0 ? exit : null,
      stop: stop !== null && stop > 0 ? stop : undefined,
      target: target !== null && target > 0 ? target : undefined,
      fees: fees !== null && fees >= 0 ? fees : undefined,
      entryAt,
      exitAt: exit !== null && exit > 0 ? (exitAt ?? entryAt) : null,
      setup: at(col.setup) || undefined,
      notes: at(col.notes) || undefined,
    });
  }
  return { trades, skipped };
}
