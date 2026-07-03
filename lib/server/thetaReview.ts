import Anthropic from "@anthropic-ai/sdk";
import type {
  ThetaReview,
  ThetaReviewRequest,
  ThetaReviewResponse,
} from "@/lib/theta/intelligence";
import { AiCache, GenLimiter, mapAnthropicError } from "@/lib/server/aiEndpoint";
import { usdCost } from "@/lib/server/cost";

/**
 * theta's AI money review — a reasoning pass over the *structural* analytics
 * (the financial-health scorecard, distribution-ranked spending anomalies, and
 * auto-detected subscriptions), distinct from the monthly narrative brief. It
 * weighs the findings against each other and returns a short, prioritized action
 * read: what matters most, why, and the concrete move.
 *
 * Sonnet 4.6 with adaptive thinking at `high` effort — like alpha's allocator,
 * this is a genuine reasoning task (tradeoffs between runway, debt, savings and
 * subscription creep), so it earns the deeper pass. Cached one per day per
 * ledger-shape.
 */
export const THETA_REVIEW_MODEL = "claude-sonnet-4-6";
const MODEL = THETA_REVIEW_MODEL;
const EFFORT = "high" as const;

const cache = new AiCache<ThetaReviewResponse>(24 * 3600_000, 20);
const genLimiter = new GenLimiter(3600_000, 40);

export const reviewRateLimited = (): boolean => genLimiter.limited();
export const reviewConfigured = (): boolean => !!process.env.ANTHROPIC_API_KEY;

export const reviewErrorResponse = (err: unknown) =>
  mapAnthropicError(err, {
    notConfigured: "review not configured",
    rateLimited: "review provider rate limited",
    unavailable: "review provider unavailable",
  });

export function reviewFingerprint(req: ThetaReviewRequest): string {
  const s = req.snapshot;
  const shape = [
    Math.round(s.netWorth),
    Math.round(s.income),
    Math.round(s.expenses),
    req.health.composite,
    req.anomalies.map((a) => a.category).join(","),
    req.newSubscriptions.map((n) => n.merchant).join(","),
  ].join("|");
  return `${new Date().toISOString().slice(0, 10)}|${shape}`;
}

export const getCachedReview = (key: string): ThetaReviewResponse | null => cache.get(key);
export const setCachedReview = (key: string, data: ThetaReviewResponse): void => cache.set(key, data);

const SYSTEM = `You are the money-review analyst for theta, a private personal-finance terminal. You receive a structured read of one person's finances: a monthly snapshot (net worth, income, expenses, savings rate, budgets, goals), a financial-health scorecard (0–100 composite, letter grade, and flagged weak metrics), spending anomalies (categories running hot vs their own history), and auto-detected recurring charges the person isn't tracking.

Reason across these signals — weigh runway vs debt vs savings vs subscription creep — then write a tight review:

- assessment: 2–3 sentences on the overall financial posture, anchored in the health score and the biggest numbers.
- priorities: up to 4 ranked actions, each a short title, a 1–2 sentence detail tied to the specific numbers, and an impact tag (high/medium/low). Order by impact. Be concrete and grounded — observations and options, never guarantees or personalized investment advice.
- subscriptionNote: one line on the detected subscriptions — the annual cost at stake and any price creep worth a look. If none were detected, say so briefly.

Use only the numbers provided; never invent figures. This is general financial information, not advice. Respond strictly with the requested JSON.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["assessment", "priorities", "subscriptionNote"],
  properties: {
    assessment: { type: "string", description: "2-3 sentence posture read." },
    priorities: {
      type: "array",
      description: "Up to 4 ranked actions.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "impact"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          impact: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    subscriptionNote: { type: "string", description: "One line on detected subscriptions." },
  },
};

export async function generateReview(
  req: ThetaReviewRequest
): Promise<{ review: ThetaReview; costUSD: number | null }> {
  const client = new Anthropic({ timeout: 55_000, maxRetries: 1 });
  genLimiter.record();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA }, effort: EFFORT },
    messages: [{ role: "user", content: JSON.stringify(req) }],
  });

  const response = await stream.finalMessage();
  if (response.stop_reason === "refusal") throw new Error("review generation declined");
  const text = response.content.find((b) => b.type === "text");
  if (!text) throw new Error("empty review response");
  return { review: JSON.parse(text.text) as ThetaReview, costUSD: usdCost(MODEL, response.usage) };
}
