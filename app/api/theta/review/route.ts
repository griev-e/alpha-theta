import { NextRequest, NextResponse } from "next/server";
import type { ThetaReviewRequest, ThetaSnapshot } from "@/lib/theta/intelligence";
import { requestAllowed } from "@/lib/server/aiEndpoint";
import {
  generateReview,
  getCachedReview,
  reviewConfigured,
  reviewErrorResponse,
  reviewFingerprint,
  reviewRateLimited,
  setCachedReview,
} from "@/lib/server/thetaReview";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseBody(body: unknown): ThetaReviewRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as ThetaReviewRequest;
  const s = b.snapshot as ThetaSnapshot | undefined;
  if (!s || typeof s !== "object") return null;
  if (!num(s.netWorth) || !num(s.income) || !num(s.expenses) || !num(s.savingsRate)) return null;
  if (!b.health || !num(b.health.composite) || typeof b.health.grade !== "string") return null;
  if (!Array.isArray(b.anomalies) || !Array.isArray(b.newSubscriptions)) return null;

  return {
    snapshot: {
      month: String(s.month ?? "").slice(0, 20),
      netWorth: s.netWorth,
      netWorthDeltaPct: num(s.netWorthDeltaPct) ? s.netWorthDeltaPct : 0,
      income: s.income,
      expenses: s.expenses,
      savingsRate: s.savingsRate,
      monthlyRecurring: num(s.monthlyRecurring) ? s.monthlyRecurring : 0,
      topCategories: Array.isArray(s.topCategories)
        ? s.topCategories
            .slice(0, 12)
            .filter((c) => typeof c?.category === "string" && num(c?.amount))
            .map((c) => ({ category: c.category.slice(0, 40), amount: c.amount }))
        : [],
      budgets: Array.isArray(s.budgets)
        ? s.budgets
            .slice(0, 20)
            .filter((x) => typeof x?.category === "string" && num(x?.limit) && num(x?.spent))
            .map((x) => ({ category: x.category.slice(0, 40), limit: x.limit, spent: x.spent }))
        : [],
      goals: Array.isArray(s.goals)
        ? s.goals
            .slice(0, 20)
            .filter((g) => typeof g?.name === "string" && num(g?.saved) && num(g?.target) && num(g?.monthly))
            .map((g) => ({ name: g.name.slice(0, 50), saved: g.saved, target: g.target, monthly: g.monthly }))
        : [],
      upcomingRecurring: [],
    },
    health: {
      composite: b.health.composite,
      grade: b.health.grade.slice(0, 2),
      flags: Array.isArray(b.health.flags) ? b.health.flags.slice(0, 6).map((f) => String(f).slice(0, 160)) : [],
    },
    anomalies: b.anomalies
      .slice(0, 8)
      .filter((a) => typeof a?.category === "string" && typeof a?.note === "string")
      .map((a) => ({ category: a.category.slice(0, 40), note: a.note.slice(0, 200) })),
    newSubscriptions: b.newSubscriptions
      .slice(0, 12)
      .filter((n) => typeof n?.merchant === "string" && num(n?.amount) && num(n?.annualCost))
      .map((n) => ({ merchant: n.merchant.slice(0, 50), amount: n.amount, annualCost: n.annualCost })),
  };
}

/**
 * POST /api/theta/review
 * AI reasoning pass over the health scorecard + spending anomalies + detected
 * subscriptions. User-triggered; cached one per day per ledger shape. Degrades
 * gracefully (501) when ANTHROPIC_API_KEY is unset.
 */
export async function POST(req: NextRequest) {
  if (!reviewConfigured()) {
    return NextResponse.json(
      { error: "review not configured" },
      { status: 501, headers: { "Cache-Control": "no-store" } }
    );
  }

  let parsed: ThetaReviewRequest | null = null;
  try {
    parsed = parseBody(await req.json());
  } catch {
    parsed = null;
  }
  if (!parsed) return NextResponse.json({ error: "invalid snapshot" }, { status: 400 });

  const key = reviewFingerprint(parsed);
  const cached = getCachedReview(key);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true }, { headers: { "Cache-Control": "no-store" } });
  }

  if (!requestAllowed(req, "theta-review", 10) || reviewRateLimited()) {
    return NextResponse.json(
      { error: "review provider rate limited" },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const { review, costUSD } = await generateReview(parsed);
    const payload = { review, generatedAt: new Date().toISOString(), cached: false, costUSD };
    setCachedReview(key, payload);
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const { status, error } = reviewErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
