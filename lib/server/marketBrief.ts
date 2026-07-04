import Anthropic from "@anthropic-ai/sdk";
import type {
  MarketBrief,
  MarketBriefRequest,
  MarketBriefResponse,
} from "@/lib/market/types";
import { AiCache, GenLimiter, mapAnthropicError } from "@/lib/server/aiEndpoint";
import { usdCost } from "@/lib/server/cost";

/**
 * The Market Analysis page's AI read — a reasoning pass over the regime engine's
 * output (composite score, confidence, internal health, the eight analytical
 * layers, and the contribution-ranked drivers). It synthesizes the numbers into
 * a plain-language market read: what the tape is, what's driving it, what a
 * risk-on/off posture implies, what to watch, and the strongest counter-signal.
 *
 * Sonnet 4.6 with adaptive thinking at `high` effort — like the allocator and
 * theta's money review, weighing eight partly-conflicting layers against each
 * other into one honest read is a genuine reasoning task, so it earns the deeper
 * pass. Cached one per day per regime shape.
 */
export const MARKET_BRIEF_MODEL = "claude-sonnet-4-6";
const MODEL = MARKET_BRIEF_MODEL;
const EFFORT = "high" as const;

const cache = new AiCache<MarketBriefResponse>(24 * 3600_000, 20);
const genLimiter = new GenLimiter(3600_000, 40);

export const marketBriefRateLimited = (): boolean => genLimiter.limited();
export const marketBriefConfigured = (): boolean => !!process.env.ANTHROPIC_API_KEY;

export const marketBriefErrorResponse = (err: unknown) =>
  mapAnthropicError(err, {
    notConfigured: "market read not configured",
    rateLimited: "market read provider rate limited",
    unavailable: "market read provider unavailable",
  });

/** Day-scoped + regime-shape-scoped: intraday noise doesn't bust it, a regime
 *  change does. Score/health are bucketed so a tiny drift stays on one cache. */
export function marketBriefFingerprint(req: MarketBriefRequest): string {
  const s = req.snapshot;
  const shape = [
    s.regime,
    s.direction,
    Math.round(s.score * 20), // ~0.05 buckets on the -1…1 score
    Math.round(s.health / 5), // 5-point buckets on health
    s.bearish.map((b) => b.label).join(","),
    s.bullish.map((b) => b.label).join(","),
  ].join("|");
  return `${new Date().toISOString().slice(0, 10)}|${shape}`;
}

export const getCachedMarketBrief = (key: string): MarketBriefResponse | null =>
  cache.get(key);
export const setCachedMarketBrief = (key: string, data: MarketBriefResponse): void =>
  cache.set(key, data);

const SYSTEM = `You are the market strategist for alpha, a private analytics terminal. You receive a JSON snapshot of a quantitative market-regime model: a composite risk-on/risk-off score (−1…+1), a regime label, a confidence and internal-health reading (0–100), a direction of travel, and eight analytical layers (trend, breadth, relative strength, leadership, volatility, structure, momentum, transition) each with its own score, weight, and one-line summary — plus the contribution-ranked bullish factors, bearish factors, largest recent shifts, emerging risks, and emerging opportunities.

Reason across the layers — weigh where they agree and where they conflict — then write a tight, honest market read in the voice of a strategy desk note: concrete, quantified, no filler, no pleasantries.

- headline: one crisp line capturing the tape's character right now.
- read: 3–4 sentences synthesizing the regime, its health and confidence, the direction of travel, and what is actually driving it. Name the specific layers and factors.
- positioning: up to 4 short observations on what this posture implies for risk-taking — where the internals support or undercut the headline score, what the leadership/breadth split means. Observations and context only, never personalized buy/sell advice or price targets.
- watchItems: up to 4 forward-looking things that would confirm or break the current regime (a layer near an inflection, a shift gathering pace, a divergence resolving).
- contrarian: the single strongest counter-signal — the factor most at odds with the headline read, and what would flip it.

Use only the numbers provided; never invent figures. This is a model read, not advice. Respond strictly with the requested JSON.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "read", "positioning", "watchItems", "contrarian"],
  properties: {
    headline: { type: "string", description: "One-line take on the tape." },
    read: {
      type: "string",
      description: "3-4 sentence synthesis of the regime and its drivers.",
    },
    positioning: {
      type: "array",
      description: "Up to 4 observations on what the posture implies for risk.",
      items: { type: "string" },
    },
    watchItems: {
      type: "array",
      description: "Up to 4 things that would confirm or break the regime.",
      items: { type: "string" },
    },
    contrarian: {
      type: "string",
      description: "The strongest counter-signal and what would flip the read.",
    },
  },
};

export async function generateMarketBrief(
  req: MarketBriefRequest
): Promise<{ brief: MarketBrief; costUSD: number | null }> {
  const client = new Anthropic({ timeout: 55_000, maxRetries: 1 });
  genLimiter.record();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA }, effort: EFFORT },
    messages: [{ role: "user", content: JSON.stringify(req.snapshot) }],
  });

  const response = await stream.finalMessage();
  if (response.stop_reason === "refusal") throw new Error("market read declined");
  const text = response.content.find((b) => b.type === "text");
  if (!text) throw new Error("empty market read response");
  return {
    brief: JSON.parse(text.text) as MarketBrief,
    costUSD: usdCost(MODEL, response.usage),
  };
}
