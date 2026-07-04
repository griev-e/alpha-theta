import { NextRequest, NextResponse } from "next/server";
import type {
  MarketBriefFactor,
  MarketBriefLayer,
  MarketBriefRequest,
} from "@/lib/market/types";
import { requestAllowed } from "@/lib/server/aiEndpoint";
import {
  generateMarketBrief,
  getCachedMarketBrief,
  marketBriefConfigured,
  marketBriefErrorResponse,
  marketBriefFingerprint,
  marketBriefRateLimited,
  setCachedMarketBrief,
} from "@/lib/server/marketBrief";

export const dynamic = "force-dynamic";
// Sonnet with adaptive thinking; the client caps its own wait well under this.
export const maxDuration = 60;

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.slice(0, max) : "";

function factors(v: unknown, cap: number): MarketBriefFactor[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, cap).flatMap((f) => {
    if (typeof f !== "object" || f === null) return [];
    const label = str((f as MarketBriefFactor).label, 80);
    if (!label) return [];
    return [{ label, detail: str((f as MarketBriefFactor).detail, 240) }];
  });
}

function strings(v: unknown, cap: number, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, cap)
    .map((s) => str(s, max))
    .filter(Boolean);
}

/** Reject malformed bodies before anything reaches the prompt. */
function parseBody(body: unknown): MarketBriefRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const s = (body as MarketBriefRequest).snapshot;
  if (typeof s !== "object" || s === null) return null;
  if (
    !isNum(s.score) ||
    !isNum(s.confidence) ||
    !isNum(s.health) ||
    typeof s.regime !== "string" ||
    typeof s.direction !== "string" ||
    !Array.isArray(s.layers)
  ) {
    return null;
  }

  const layers: MarketBriefLayer[] = s.layers.slice(0, 12).flatMap((l) => {
    if (typeof l !== "object" || l === null) return [];
    const name = str((l as MarketBriefLayer).name, 40);
    if (!name) return [];
    const score = (l as MarketBriefLayer).score;
    const weight = (l as MarketBriefLayer).weight;
    return [
      {
        name,
        score: isNum(score) ? +score.toFixed(3) : null,
        weight: isNum(weight) ? +weight.toFixed(3) : 0,
        summary: str((l as MarketBriefLayer).summary, 200),
      },
    ];
  });

  return {
    snapshot: {
      asOf: str(s.asOf, 20),
      regime: s.regime.slice(0, 20) as MarketBriefRequest["snapshot"]["regime"],
      score: +s.score.toFixed(3),
      confidence: Math.round(s.confidence),
      consensus: str(s.consensus, 30) as MarketBriefRequest["snapshot"]["consensus"],
      health: Math.round(s.health),
      direction: s.direction.slice(0, 20) as MarketBriefRequest["snapshot"]["direction"],
      directionSlope: isNum(s.directionSlope) ? +s.directionSlope.toFixed(3) : 0,
      maturityDays: isNum(s.maturityDays) ? Math.round(s.maturityDays) : 0,
      persistence: isNum(s.persistence) ? +s.persistence.toFixed(2) : 0,
      layers,
      bullish: factors(s.bullish, 6),
      bearish: factors(s.bearish, 6),
      shifts: factors(s.shifts, 6),
      risks: strings(s.risks, 6, 200),
      opportunities: strings(s.opportunities, 6, 200),
    },
  };
}

/**
 * POST /api/market-brief
 * AI market read over the regime engine's output. The regime numbers are
 * computed server-side (`/api/market`) and held on the client, so the compact
 * snapshot travels with the request; cached one read per day per regime shape.
 */
export async function POST(req: NextRequest) {
  if (!marketBriefConfigured()) {
    return NextResponse.json(
      { error: "market read not configured" },
      { status: 501, headers: { "Cache-Control": "no-store" } }
    );
  }

  let parsed: MarketBriefRequest | null = null;
  try {
    parsed = parseBody(await req.json());
  } catch {
    parsed = null;
  }
  if (!parsed) {
    return NextResponse.json({ error: "invalid snapshot" }, { status: 400 });
  }

  const key = marketBriefFingerprint(parsed);
  const cached = getCachedMarketBrief(key);
  if (cached) {
    return NextResponse.json(
      { ...cached, cached: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!requestAllowed(req, "market-brief", 10) || marketBriefRateLimited()) {
    return NextResponse.json(
      { error: "market read provider rate limited" },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const { brief, costUSD } = await generateMarketBrief(parsed);
    const payload = {
      brief,
      generatedAt: new Date().toISOString(),
      cached: false,
      costUSD,
    };
    setCachedMarketBrief(key, payload);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const { status, error } = marketBriefErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
