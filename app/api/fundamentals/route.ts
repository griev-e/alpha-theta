import { NextRequest, NextResponse } from "next/server";
import { requestAllowed } from "@/lib/server/aiEndpoint";
import { fetchFundamentalsPatch } from "@/lib/server/fundamentals";
import { sanitizeSymbols } from "@/lib/server/yahoo";
import type { FundamentalsPatch } from "@/lib/live/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Stop starting new provider fetches this long into the request, so a cold
 * 30-symbol book on a slow provider returns what it has instead of blowing the
 * 30s function budget and 500-ing the whole overlay. Symbols already fetched
 * are warm-cached (12h), so the client's next poll finishes the remainder.
 */
const DEADLINE_MS = 22_000;

/**
 * GET /api/fundamentals?symbols=AAPL,MSFT
 * Live fundamentals overlay, fetched per symbol with bounded concurrency.
 * Fundamentals move slowly — CDN caches for 12h, server memory for 12h.
 * Symbols Yahoo can't resolve are simply omitted; the client falls back to
 * the bundled snapshot. On a cold cache that grazes the function deadline the
 * response is partial (`partial: true`, not CDN-cached) rather than an error.
 */
export async function GET(req: NextRequest) {
  const symbols = sanitizeSymbols(req.nextUrl.searchParams.get("symbols"));
  if (symbols.length === 0) {
    return NextResponse.json({ error: "symbols required" }, { status: 400 });
  }
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  // The steady-state overlay is CDN + warm-cache absorbed, but each cold symbol
  // costs Yahoo ~3 upstream calls (quoteSummary + chart + fundamentalsTimeSeries),
  // and in open mode this route is unauthenticated. An attacker who varies the
  // symbol set defeats both the CDN and warm caches, so cap per-IP churn — 20/min
  // is far above any real book's poll cadence. `fresh=1` (manual refresh) punches
  // through the caches straight to the provider, so throttle it tighter still.
  if (fresh && !requestAllowed(req, "fundamentals-fresh", 6)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (!fresh && !requestAllowed(req, "fundamentals", 20)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const started = Date.now();
  const patches: Record<string, FundamentalsPatch> = {};
  let partial = false;
  const CONCURRENCY = 6;
  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    if (Date.now() - started > DEADLINE_MS) {
      partial = true;
      break;
    }
    const chunk = symbols.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((s) => fetchFundamentalsPatch(s, fresh))
    );
    results.forEach((r, j) => {
      if (r.status === "fulfilled" && r.value) patches[chunk[j]] = r.value;
    });
  }

  return NextResponse.json(
    { patches, asOf: new Date().toISOString(), ...(partial ? { partial } : {}) },
    {
      headers: {
        // Never CDN-cache a partial overlay (the next poll finishes it) or a
        // forced refresh (it must reach the provider, not the CDN).
        "Cache-Control": partial || fresh
          ? "no-store"
          : "public, s-maxage=43200, stale-while-revalidate=86400",
      },
    }
  );
}
