import { NextResponse } from "next/server";
import { getRegimeReport } from "@/lib/server/marketData";

export const dynamic = "force-dynamic";
// A cold cache fans out ~23 symbols × ~960 calendar days through the Yahoo
// queue (concurrency 6); on a slow provider day that can graze the default
// function budget and 504 before the module cache is ever primed. Give the
// cold build room so the first request after a cold start can complete.
export const maxDuration = 60;

/**
 * GET /api/market
 * Market regime report: ~23 daily series → 8 analytical layers → composite
 * regime, confidence, health, and drivers. Computed server-side and cached
 * (module scope + CDN) since the inputs only move once per session.
 */
export async function GET() {
  try {
    const report = await getRegimeReport();
    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "market data provider unavailable" },
      { status: 502 }
    );
  }
}
