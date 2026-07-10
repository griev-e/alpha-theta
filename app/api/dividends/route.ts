import { NextRequest, NextResponse } from "next/server";
import { requestAllowed } from "@/lib/server/aiEndpoint";
import { fetchDividendProfiles } from "@/lib/server/dividends";
import { sanitizeSymbols } from "@/lib/server/yahoo";

export const dynamic = "force-dynamic";

/**
 * GET /api/dividends?symbols=AAPL,SCHD
 * Per-symbol dividend profiles (10y payment history + safety inputs).
 * Pure market data — the dividend report itself is computed client-side
 * against the locally stored portfolio.
 */
export async function GET(req: NextRequest) {
  const symbols = sanitizeSymbols(req.nextUrl.searchParams.get("symbols"));
  if (symbols.length === 0) {
    return NextResponse.json({ error: "symbols required" }, { status: 400 });
  }
  // Each symbol pulls 10y of dividend history; unauthenticated in open mode and
  // symbol-set-varying defeats the cache, so cap per-IP churn (well above any
  // real book's fetch cadence).
  if (!requestAllowed(req, "dividends", 20)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  try {
    const profiles = await fetchDividendProfiles(symbols);
    return NextResponse.json(
      { profiles, asOf: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "dividend data provider unavailable" },
      { status: 502 }
    );
  }
}
