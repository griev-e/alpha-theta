/**
 * Shared types for vega — the day trading terminal. Kept provider-agnostic so
 * both the server proxy (lib/server/intraday.ts) and client code can import
 * them without pulling yahoo-finance2 into the browser bundle.
 *
 * Everything here follows the house data-layering model: bars and quotes are
 * live (Yahoo, proxied through /api/vega/*), the journal is the user's own
 * record (localStorage), and nothing is imputed when a provider has no data.
 */

/** Chart bar interval. Intraday intervals carry pre/post-market bars. */
export type Interval = "1m" | "5m" | "15m" | "1d";

export const INTERVALS: readonly Interval[] = ["1m", "5m", "15m", "1d"];

/** One OHLCV bar. `t` is the ISO timestamp of the bar's open. */
export interface Bar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface IntradaySeries {
  symbol: string;
  interval: Interval;
  currency: string;
  bars: Bar[];
}

export type VegaMarketState = "PRE" | "REGULAR" | "POST" | "CLOSED";

/**
 * A rich day-trading quote — everything the cockpit/scanner needs from ONE
 * batched provider call per poll (no per-symbol fan-out, by design: the whole
 * watchlist costs a single Yahoo request, which is what keeps vega inside the
 * keyless provider's tolerance).
 */
export interface VegaQuote {
  symbol: string;
  name: string | null;
  /** Extended-hours aware: outside RTH this is the latest pre/post trade. */
  price: number;
  /** Last regular-session price (differs from `price` outside RTH). */
  regularPrice: number | null;
  prevClose: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  avgVolume10d: number | null;
  avgVolume3m: number | null;
  marketState: VegaMarketState;
  /** Change vs the prior regular close, extended-hours aware. Null when unpriceable. */
  changePct: number | null;
  high52w: number | null;
  low52w: number | null;
  asOf: string;
}

export interface VegaQuotesResponse {
  quotes: Record<string, VegaQuote>;
  asOf: string;
}

/* ── Journal ─────────────────────────────────────────────────────────── */

export type TradeSide = "long" | "short";

/** One journaled trade. `exit === null` means the position is still open. */
export interface Trade {
  id: string;
  symbol: string;
  side: TradeSide;
  qty: number;
  entry: number;
  exit: number | null;
  /** Planned stop — powers R-multiple math. Optional but strongly encouraged. */
  stop?: number;
  target?: number;
  /** Total commissions/fees for the round trip. */
  fees?: number;
  /** ISO datetime of entry / exit. */
  entryAt: string;
  exitAt?: string | null;
  /** Playbook tag ("ORB", "VWAP reclaim", …) — drives per-setup analytics. */
  setup?: string;
  notes?: string;
}

export type NewTrade = Omit<Trade, "id">;

/** The playbook — a starter set of common day-trade setups. Free-form text is
 *  allowed everywhere; these just seed the picker. */
export const SETUPS = [
  "ORB",
  "VWAP reclaim",
  "Gap & go",
  "Breakout",
  "Pullback",
  "Reversal",
  "Trend follow",
  "News",
  "Scalp",
  "Other",
] as const;

/* ── Price alerts ────────────────────────────────────────────────────── */

/** A client-side price alert — armed against the 30s quote poll, no server
 *  state. Fires once on a true cross, then stays visible until dismissed. */
export interface PriceAlert {
  id: string;
  symbol: string;
  price: number;
  /** Which cross arms it: price moving up through the level, or down. */
  dir: "above" | "below";
  note?: string;
  createdAt: string;
  /** Set when the level was crossed; a fired alert never re-arms. */
  firedAt?: string | null;
}

/** Alert count cap — enough for a day's plan, small enough to stay scannable. */
export const ALERTS_MAX = 40;

/* ── Persisted state ─────────────────────────────────────────────────── */

export interface VegaSettings {
  /** Trading account equity, the base for sizing and loss limits. */
  accountSize: number;
  /** Max risk per trade as a % of account (1 = 1%). */
  riskPct: number;
  /** Daily max loss as a % of account — the circuit breaker. */
  dailyLossPct: number;
  /** Opening-range window in minutes (15 or 30 are the usual choices). */
  orMinutes: number;
}

export const DEFAULT_SETTINGS: VegaSettings = {
  accountSize: 25_000,
  riskPct: 1,
  dailyLossPct: 3,
  orMinutes: 15,
};

/** Liquid, day-trader-familiar defaults so the terminal lights up before any
 *  personalization. All major-venue tickers the quote batch resolves keylessly. */
export const DEFAULT_WATCHLIST = [
  "SPY",
  "QQQ",
  "NVDA",
  "TSLA",
  "AAPL",
  "AMD",
  "META",
  "AMZN",
] as const;

/** Market internals tape — index proxies plus the vol/rates complex. `^`
 *  symbols are index tickers (quotes only; they can't be charted intraday
 *  through the same sanitizer alpha uses, which is why vega has its own). */
export const INTERNALS_SYMBOLS = ["SPY", "QQQ", "IWM", "DIA", "^VIX", "^TNX"] as const;

/** Watchlist size cap — one batched quote call covers the whole list, and the
 *  cap keeps that call (and the scanner math) comfortably bounded. */
export const WATCHLIST_MAX = 24;

/** Curated starter boards — one tap fills the watchlist with a coherent
 *  theme instead of typing eight tickers. Adding is cap-aware and additive;
 *  nothing is ever silently evicted. All keyless major-venue tickers. */
export const WATCHLIST_PRESETS: readonly { label: string; symbols: readonly string[] }[] = [
  { label: "Mega tech", symbols: ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA"] },
  { label: "Semis", symbols: ["NVDA", "AMD", "AVGO", "TSM", "MU", "SMCI", "ARM"] },
  { label: "Index ETFs", symbols: ["SPY", "QQQ", "IWM", "DIA", "SMH", "XLK"] },
  { label: "High beta", symbols: ["TSLA", "COIN", "PLTR", "MSTR", "HOOD", "SOFI"] },
  { label: "Energy & rates", symbols: ["XLE", "XOM", "CVX", "OXY", "TLT", "XLF"] },
];

/** The Edge Engine's relative-strength benchmark. Lives here with the other
 *  symbol constants so every surface that assembles engine input agrees. */
export const ENGINE_BENCHMARK = "SPY";

export interface VegaState {
  v: 2;
  watchlist: string[];
  /** The symbol the cockpit + chart terminal are focused on. */
  focus: string;
  trades: Trade[];
  alerts: PriceAlert[];
  settings: VegaSettings;
  /** The bundled sample journal is loaded (vs. the user's own trades). */
  isSample?: boolean;
}

export const EMPTY_VEGA_STATE: VegaState = {
  v: 2,
  watchlist: [...DEFAULT_WATCHLIST],
  focus: "SPY",
  trades: [],
  alerts: [],
  settings: DEFAULT_SETTINGS,
};

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === "string" && x.length > 0;

function migrateTrade(raw: unknown): Trade | null {
  const t = raw as Partial<Trade> | null;
  if (!t || !isStr(t.id) || !isStr(t.symbol) || !isStr(t.entryAt)) return null;
  if (!isNum(t.qty) || t.qty <= 0 || !isNum(t.entry) || t.entry <= 0) return null;
  const side: TradeSide = t.side === "short" ? "short" : "long";
  return {
    id: t.id,
    symbol: t.symbol.toUpperCase(),
    side,
    qty: t.qty,
    entry: t.entry,
    exit: isNum(t.exit) ? t.exit : null,
    stop: isNum(t.stop) && t.stop > 0 ? t.stop : undefined,
    target: isNum(t.target) && t.target > 0 ? t.target : undefined,
    fees: isNum(t.fees) && t.fees >= 0 ? t.fees : undefined,
    entryAt: t.entryAt,
    exitAt: isStr(t.exitAt) ? t.exitAt : null,
    setup: isStr(t.setup) ? t.setup : undefined,
    notes: isStr(t.notes) ? t.notes : undefined,
  };
}

function migrateAlert(raw: unknown): PriceAlert | null {
  const a = raw as Partial<PriceAlert> | null;
  if (!a || !isStr(a.id) || !isStr(a.symbol) || !isStr(a.createdAt)) return null;
  if (!isNum(a.price) || a.price <= 0) return null;
  return {
    id: a.id,
    symbol: a.symbol.toUpperCase(),
    price: a.price,
    dir: a.dir === "below" ? "below" : "above",
    note: isStr(a.note) ? a.note : undefined,
    createdAt: a.createdAt,
    firedAt: isStr(a.firedAt) ? a.firedAt : null,
  };
}

/**
 * Parse + repair a persisted vega blob. Unknown shapes return null (caller
 * falls back to the empty state); partially-valid blobs keep what's usable so
 * a bad trade row never voids the whole journal. v1 blobs (pre-alerts) are
 * upgraded transparently.
 */
export function migrateVegaState(raw: unknown): VegaState | null {
  const s = raw as Partial<VegaState> | null;
  if (!s || typeof s !== "object") return null;
  const watchlist = Array.isArray(s.watchlist)
    ? [...new Set(s.watchlist.filter(isStr).map((x) => x.toUpperCase()))].slice(
        0,
        WATCHLIST_MAX
      )
    : [...DEFAULT_WATCHLIST];
  const trades = Array.isArray(s.trades)
    ? s.trades.map(migrateTrade).filter((t): t is Trade => t !== null)
    : [];
  const st = s.settings as Partial<VegaSettings> | undefined;
  const settings: VegaSettings = {
    accountSize:
      st && isNum(st.accountSize) && st.accountSize > 0
        ? st.accountSize
        : DEFAULT_SETTINGS.accountSize,
    riskPct:
      st && isNum(st.riskPct) && st.riskPct > 0 && st.riskPct <= 10
        ? st.riskPct
        : DEFAULT_SETTINGS.riskPct,
    dailyLossPct:
      st && isNum(st.dailyLossPct) && st.dailyLossPct > 0 && st.dailyLossPct <= 100
        ? st.dailyLossPct
        : DEFAULT_SETTINGS.dailyLossPct,
    orMinutes:
      st && isNum(st.orMinutes) && st.orMinutes >= 5 && st.orMinutes <= 60
        ? st.orMinutes
        : DEFAULT_SETTINGS.orMinutes,
  };
  const focus = isStr(s.focus) ? s.focus.toUpperCase() : watchlist[0] ?? "SPY";
  const alerts = Array.isArray(s.alerts)
    ? s.alerts
        .map(migrateAlert)
        .filter((a): a is PriceAlert => a !== null)
        .slice(-ALERTS_MAX) // over-cap blobs keep the most recent, like the store
    : [];
  return {
    v: 2,
    watchlist: watchlist.length > 0 ? watchlist : [...DEFAULT_WATCHLIST],
    focus,
    trades,
    alerts,
    settings,
    isSample: s.isSample === true ? true : undefined,
  };
}
