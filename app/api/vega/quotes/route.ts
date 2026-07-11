import { NextRequest, NextResponse } from "next/server";
import { requestAllowed } from "@/lib/server/aiEndpoint";
import { fetchVegaQuotes, sanitizeVegaSymbols } from "@/lib/server/intraday";
import type { VegaQuotesResponse } from "@/lib/vega/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/vega/quotes?symbols=SPY,QQQ,^VIX,…
 * Rich day-trading quotes (OHLC of the day, volume, averages, 52w range,
 * extended hours) for up to 40 symbols in ONE batched provider call — the
 * cockpit, scanner, and internals tape all draw from this. 30s CDN cache
 * matches the client poll.
 */
export async function GET(req: NextRequest) {
  if (!requestAllowed(req, "vega-quotes", 120)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const symbols = sanitizeVegaSymbols(req.nextUrl.searchParams.get("symbols"));
  if (symbols.length === 0) {
    return NextResponse.json({ error: "symbols required" }, { status: 400 });
  }
  const quotes = await fetchVegaQuotes(symbols);
  const body: VegaQuotesResponse = { quotes, asOf: new Date().toISOString() };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
    },
  });
}
