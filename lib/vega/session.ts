import type { Bar, Interval } from "./types";

/**
 * US equity session math over bar timestamps, computed in exchange time
 * (America/New_York) regardless of the viewer's locale. Everything here is a
 * pure function of the ISO timestamps it's handed — no ambient clock — so the
 * VWAP anchor, opening range, and "minutes into the session" all stay
 * deterministic and testable.
 */

export const RTH_OPEN_MIN = 9 * 60 + 30; // 09:30 ET
export const RTH_CLOSE_MIN = 16 * 60; // 16:00 ET
export const RTH_MINUTES = RTH_CLOSE_MIN - RTH_OPEN_MIN; // 390

// One formatter, reused: constructing Intl.DateTimeFormat is expensive and
// this runs per-bar over 1m series (~1000 bars).
const ET = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export interface EtStamp {
  /** The ET calendar date, "YYYY-MM-DD" — the session key. */
  dateKey: string;
  /** Minutes since ET midnight. */
  minutes: number;
}

export function etStamp(iso: string): EtStamp {
  const parts = ET.formatToParts(new Date(iso));
  let y = "",
    mo = "",
    d = "",
    h = 0,
    mi = 0;
  for (const p of parts) {
    if (p.type === "year") y = p.value;
    else if (p.type === "month") mo = p.value;
    else if (p.type === "day") d = p.value;
    else if (p.type === "hour") h = Number(p.value);
    else if (p.type === "minute") mi = Number(p.value);
  }
  return { dateKey: `${y}-${mo}-${d}`, minutes: h * 60 + mi };
}

/** The ET trading-date key for a timestamp ("YYYY-MM-DD"). */
export function sessionKey(iso: string): string {
  return etStamp(iso).dateKey;
}

/** True when the timestamp falls inside regular trading hours (09:30–16:00 ET). */
export function inRegularHours(iso: string): boolean {
  const m = etStamp(iso).minutes;
  return m >= RTH_OPEN_MIN && m < RTH_CLOSE_MIN;
}

/** Minutes since the 09:30 ET open, clamped to [0, 390]. */
export function minutesSinceOpen(iso: string): number {
  const m = etStamp(iso).minutes;
  return Math.max(0, Math.min(RTH_MINUTES, m - RTH_OPEN_MIN));
}

/** Group bars into per-ET-day sessions, preserving order. */
export function splitSessions(bars: Bar[]): Bar[][] {
  const out: Bar[][] = [];
  let key = "";
  for (const b of bars) {
    const k = sessionKey(b.t);
    if (k !== key) {
      key = k;
      out.push([]);
    }
    out[out.length - 1].push(b);
  }
  return out;
}

/** Only the bars inside regular trading hours. */
export function regularBars(bars: Bar[]): Bar[] {
  return bars.filter((b) => inRegularHours(b.t));
}

/** The latest session's bars (all hours), or [] when the series is empty. */
export function latestSession(bars: Bar[]): Bar[] {
  const sessions = splitSessions(bars);
  return sessions.length > 0 ? sessions[sessions.length - 1] : [];
}

/** The last `n` sessions' bars, flattened in order — the chart's display
 *  window (fetch spans carry weekend slack, so "2 days" is session-counted). */
export function lastSessions(bars: Bar[], n: number): Bar[] {
  return splitSessions(bars).slice(-n).flat();
}

/** Sessions shown per intraday interval — the display-window contract shared
 *  by the chart terminal and bar replay (1m tapes are only readable one
 *  session at a time; daily bars show the full fetched span). */
const WINDOW_SESSIONS: Record<Interval, number | null> = {
  "1m": 1,
  "5m": 2,
  "15m": 5,
  "1d": null,
};

/** The chart's display window for an interval — a fixed session count. */
export function displayWindow(bars: Bar[], interval: Interval): Bar[] {
  const n = WINDOW_SESSIONS[interval];
  return n === null ? bars : lastSessions(bars, n);
}

/**
 * Where bar replay rewinds to: the first bar of the latest session on
 * intraday tapes, or a quarter of the way in on daily bars (every daily bar
 * is its own ET session, so "latest session" would be the last bar — a
 * zero-length replay). Both the start button and play-again-after-the-end
 * use this, so the two can never disagree.
 */
export function replayStart(win: Bar[], interval: Interval): number {
  if (interval === "1d") return Math.min(Math.floor(win.length * 0.25), Math.max(0, win.length - 2));
  const sessions = splitSessions(win);
  const lastLen = sessions[sessions.length - 1]?.length ?? 0;
  return Math.max(Math.min(5, Math.max(0, win.length - 2)), win.length - lastLen);
}
