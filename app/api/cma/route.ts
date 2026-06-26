import { NextResponse } from "next/server";
import { getLiveCMA } from "@/lib/server/cma";

export const dynamic = "force-dynamic";

/**
 * GET /api/cma
 * Live capital-market assumptions: risk-free rate (^IRX) and realized S&P 500
 * volatility, refetched every 6h. Equity risk premium has no live source and
 * stays the static assumption — the client falls back to it on failure.
 */
export async function GET() {
  try {
    const data = await getLiveCMA();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "rates provider unavailable" },
      { status: 502 }
    );
  }
}
