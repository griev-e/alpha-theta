import { NextRequest, NextResponse } from "next/server";
import type { CategorizeItem, CategorizeRequest } from "@/lib/theta/intelligence";
import { requestAllowed } from "@/lib/server/aiEndpoint";
import {
  categorizeConfigured,
  categorizeErrorResponse,
  categorizeFingerprint,
  categorizeRateLimited,
  generateCategorize,
  getCachedCategorize,
  setCachedCategorize,
} from "@/lib/server/thetaCategorize";

export const dynamic = "force-dynamic";
export const maxDuration = 40;

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Reject malformed bodies and bound the batch before anything hits the prompt. */
function parseBody(body: unknown): CategorizeRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const items = (body as CategorizeRequest).items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const clean: CategorizeItem[] = items
    .filter((i) => i && typeof i.merchant === "string" && num(i.amount))
    .slice(0, 200)
    .map((i) => ({ merchant: i.merchant.slice(0, 80), amount: i.amount }));
  return clean.length ? { items: clean } : null;
}

/**
 * POST /api/theta/categorize
 * Batch merchant → category inference for import / bank-sync cleanup. Degrades
 * gracefully (501) when ANTHROPIC_API_KEY is unset — callers keep the keyword
 * categorization in that case.
 */
export async function POST(req: NextRequest) {
  if (!categorizeConfigured()) {
    return NextResponse.json(
      { error: "categorizer not configured" },
      { status: 501, headers: { "Cache-Control": "no-store" } }
    );
  }

  let parsed: CategorizeRequest | null = null;
  try {
    parsed = parseBody(await req.json());
  } catch {
    parsed = null;
  }
  if (!parsed) return NextResponse.json({ error: "invalid request" }, { status: 400 });

  const key = categorizeFingerprint(parsed);
  const cached = getCachedCategorize(key);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true }, { headers: { "Cache-Control": "no-store" } });
  }

  if (!requestAllowed(req, "theta-categorize", 15) || categorizeRateLimited()) {
    return NextResponse.json(
      { error: "categorizer rate limited" },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const { results, costUSD } = await generateCategorize(parsed);
    const payload = { results, cached: false, costUSD };
    setCachedCategorize(key, payload);
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const { status, error } = categorizeErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
