/**
 * US equity-market session from the wall clock, in US/Eastern — the schedule
 * behind the Overview session ribbon (§75). Deliberately calendar-only (it
 * doesn't know market holidays), so it's paired in the UI with the live-price
 * truth (`degraded` / live count): the clock says which session *should* be
 * running; the tape says whether prices are actually live. Pure; `now` explicit.
 */

export type MarketSession = "pre" | "open" | "post" | "closed";

const OPEN_MIN = 9 * 60 + 30; // 9:30 ET
const CLOSE_MIN = 16 * 60; // 16:00 ET
const PRE_MIN = 4 * 60; // 4:00 ET
const POST_END_MIN = 20 * 60; // 20:00 ET

export function usMarketSession(now: Date = new Date()): MarketSession {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") return "closed";
  // hour12:false can emit "24" at midnight in some engines — fold to 0.
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const mins = hour * 60 + minute;
  if (mins < PRE_MIN) return "closed";
  if (mins < OPEN_MIN) return "pre";
  if (mins < CLOSE_MIN) return "open";
  if (mins < POST_END_MIN) return "post";
  return "closed";
}

export const SESSION_LABEL: Record<MarketSession, string> = {
  pre: "Pre-market",
  open: "Regular session",
  post: "After hours",
  closed: "Market closed",
};
