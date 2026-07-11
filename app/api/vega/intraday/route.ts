import { NextRequest, NextResponse } from "next/server";
import { requestAllowed } from "@/lib/server/aiEndpoint";
import { fetchIntraday, sanitizeVegaSymbols } from "@/lib/server/intraday";
import { INTERVALS, type Interval } from "@/lib/vega/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/vega/intraday?symbol=NVDA&interval=1m|5m|15m|1d
 * OHLCV bars for vega's chart terminal (pre/post included on intraday
 * intervals). One symbol per call — the chart only ever needs the focused
 * ticker. Intraday bars move constantly, so the CDN holds them briefly;
 * daily bars get the usual 10 minutes.
 */
export async function GET(req: NextRequest) {
  // Per-symbol cache misses are attacker-forcible churn against a real
  // provider — cap per-IP like /api/history does. A normal chart session
  // (one focused symbol, 60s poll) uses a tiny fraction of this.
  if (!requestAllowed(req, "vega-intraday", 60)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const [symbol] = sanitizeVegaSymbols(req.nextUrl.searchParams.get("symbol"), 1);
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }
  const param = (req.nextUrl.searchParams.get("interval") ?? "5m").toLowerCase();
  const interval = (INTERVALS as readonly string[]).includes(param)
    ? (param as Interval)
    : "5m";

  const { series, error } = await fetchIntraday(symbol, interval);
  if (!series) {
    // 404 = the provider conclusively has nothing for this symbol;
    // 503 = the provider call failed and we have no last-known bars —
    // the client keeps its current tape and shows the degraded state
    // instead of a false "no data" empty.
    if (error) {
      return NextResponse.json(
        { error: "provider unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json({ error: "no data" }, { status: 404 });
  }
  return NextResponse.json(series, {
    headers: {
      "Cache-Control": error
        ? "no-store" // stale-served during an outage — don't pin it to the CDN
        : interval === "1d"
          ? "public, s-maxage=600, stale-while-revalidate=3600"
          : "public, s-maxage=55, stale-while-revalidate=300",
    },
  });
}
