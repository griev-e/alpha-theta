/**
 * The figures dictionary — one place the number style is decided, so new
 * surfaces can't drift. The rules every formatter below follows:
 *
 *  - **Compact vs. full.** Hero and space-tight figures use the compact forms
 *    (`fmtUSDCompact` → $1.24M, `fmtNum` compact where offered); tables, tickets
 *    and anywhere the exact cent matters use the full `fmtUSD`. Prefer compact
 *    in chrome, full in the ledger.
 *  - **Signed.** Deltas pass `signed = true` so a gain reads `+2.4%`; a loss
 *    keeps its own minus. Absolute quantities (a price, a balance) are never
 *    signed by the formatter — the caller adds a `+`/`−` only when the figure is
 *    itself a change.
 *  - **The true minus.** Negative currency from `Intl` uses the locale minus
 *    (U+2212, `−`), not a hyphen — keep it; when composing a sign by hand for a
 *    delta, use `−` (U+2212) to match, never `-`.
 *  - **Non-finite is an em dash.** Every formatter returns `"—"` for NaN/∞ so a
 *    missing input never renders `NaN` or `$Infinity`.
 *  - **Tabular numerals.** Any figure that can change in place or sits in a
 *    column is set in `.tnum` (font-variant-numeric: tabular-nums) so digits
 *    don't shift width as they tick.
 */

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const USD_WHOLE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function fmtUSD(v: number, whole = false): string {
  if (!Number.isFinite(v)) return "—";
  return whole ? USD_WHOLE.format(v) : USD.format(v);
}

/** Compact dollars: $1.24M, $18.3B, $2.1T */
export function fmtUSDCompact(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  // The true minus (U+2212), matching Intl's locale minus used elsewhere — the
  // module contract forbids a hyphen for a negative figure.
  const sign = v < 0 ? "−" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/**
 * Split a formatted currency string into a loud middle and the quiet furniture
 * around it — the leading symbol/sign (`$`, `−$`, `+$`) and the trailing cents
 * (`.56`) — so `<Money>` can dim the furniture and let the significant digits
 * carry. Deliberately operates on the *formatted* string, so it works for any
 * currency formatter here (full or compact). Compact magnitudes keep their
 * decimals loud: only a two-digit fraction anchored to the end of the string is
 * treated as cents, so `$1.24M` dims just the `$`, never the significant `.24`.
 */
export function splitMoney(formatted: string): {
  lead: string;
  main: string;
  tail: string;
} {
  if (!formatted || formatted === "—") return { lead: "", main: formatted, tail: "" };
  const lead = formatted.match(/^[^\d]*/)?.[0] ?? "";
  let rest = formatted.slice(lead.length);
  let tail = "";
  const cents = rest.match(/\.\d{2}$/);
  if (cents) {
    tail = cents[0];
    rest = rest.slice(0, -tail.length);
  }
  return { lead, main: rest, tail };
}

export function fmtPct(v: number, digits = 1, signed = false): string {
  if (!Number.isFinite(v)) return "—";
  const s = (v * 100).toFixed(digits);
  return signed && v > 0 ? `+${s}%` : `${s}%`;
}

export function fmtNum(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function fmtShares(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return Number.isInteger(v)
    ? v.toLocaleString("en-US")
    : v.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function fmtMultiple(v: number | null, digits = 1): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}×`;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 86_400_000);
}

/** Compact age for feeds: "4m ago", "2h ago", "3d ago", then "Jun 10". */
export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60_000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Sign-aware tone for coloring deltas. */
export function tone(v: number): "pos" | "neg" | "flat" {
  if (v > 0.000001) return "pos";
  if (v < -0.000001) return "neg";
  return "flat";
}

/**
 * Stable per-symbol index into a palette, so a ticker's accent color survives
 * re-sorting or re-rendering across any page that colors by symbol.
 */
export function symbolColorIndex(symbol: string, paletteLength: number): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) | 0;
  return Math.abs(h) % paletteLength;
}
