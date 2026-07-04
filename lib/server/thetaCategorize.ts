import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES } from "@/lib/theta/data";
import type {
  CategorizeItem,
  CategorizeRequest,
  CategorizeResponse,
  CategorizeResult,
} from "@/lib/theta/intelligence";
import { AiCache, GenLimiter, mapAnthropicError } from "@/lib/server/aiEndpoint";
import { usdCost } from "@/lib/server/cost";

/**
 * theta's AI transaction categorizer. The keyword table in
 * `lib/theta/categorize.ts` is fast and free but shallow — a merchant it doesn't
 * recognize falls to "Other". This asks Haiku 4.5 to place a batch of merchants
 * into theta's fixed category set, so bank-sync and CSV imports arrive already
 * well-categorized instead of needing hand cleanup.
 *
 * Haiku 4.5, thinking disabled: the enum-constrained JSON schema does the work,
 * so the cheapest, fastest model is the right tool (same call shape as alpha's
 * brief). One response cached per day per merchant-set shape.
 */
export const THETA_CATEGORIZE_MODEL = "claude-haiku-4-5";
const MODEL = THETA_CATEGORIZE_MODEL;

const cache = new AiCache<CategorizeResponse>(24 * 3600_000, 40);
const genLimiter = new GenLimiter(3600_000, 60);

export const categorizeRateLimited = (): boolean => genLimiter.limited();
export const categorizeConfigured = (): boolean => !!process.env.ANTHROPIC_API_KEY;

export const categorizeErrorResponse = (err: unknown) =>
  mapAnthropicError(err, {
    notConfigured: "categorizer not configured",
    rateLimited: "categorizer rate limited",
    unavailable: "categorizer unavailable",
  });

/** Day- + merchant-set-scoped: the same batch on the same day reuses the result. */
export function categorizeFingerprint(req: CategorizeRequest): string {
  const merchants = [...new Set(req.items.map((i) => i.merchant.trim().toLowerCase()))].sort();
  return `${new Date().toISOString().slice(0, 10)}|${merchants.join("|")}`;
}

export const getCachedCategorize = (key: string): CategorizeResponse | null => cache.get(key);
export const setCachedCategorize = (key: string, data: CategorizeResponse): void => cache.set(key, data);

const SYSTEM = `You categorize personal-finance transactions for theta. You receive a JSON array of merchants (with the transaction amount for context; negative = money out, positive = money in). Assign each merchant exactly one category from this fixed set:

${CATEGORIES.join(", ")}.

Rules:
- Use "Income" for paychecks, interest, dividends, refunds of income.
- Use "Transfer" for movements between the person's own accounts (Venmo/Zelle to self, wires, card payments).
- Prefer the most specific spending category; use "Other" only when nothing fits.
- Judge by the merchant name; the amount is a hint, not the driver.

Return every merchant you were given, once, with its category. Respond strictly with the requested JSON.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      description: "One entry per input merchant.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["merchant", "category"],
        properties: {
          merchant: { type: "string" },
          category: { type: "string", enum: CATEGORIES },
        },
      },
    },
  },
};

/**
 * Split a batch into fixed-size chunks. Each model call's JSON output has to fit
 * under `max_tokens`; a single large batch (the route allows up to 200 merchants)
 * would blow past a fixed cap, truncate mid-JSON, and fail the *whole* request on
 * `JSON.parse`. Chunking keeps every call's output comfortably bounded and lets a
 * single bad chunk degrade to a partial result instead of a hard error.
 */
export function chunkItems<T>(items: T[], size: number): T[][] {
  const step = Math.max(1, size);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += step) out.push(items.slice(i, i + step));
  return out;
}

const CHUNK_SIZE = 40;

/** One model call over a bounded chunk. Anthropic errors (auth/rate/timeout)
 *  bubble to the caller; a truncated/malformed body degrades to no results for
 *  that chunk rather than failing the batch. */
async function categorizeChunk(
  client: Anthropic,
  items: CategorizeItem[]
): Promise<{ results: CategorizeResult[]; costUSD: number }> {
  genLimiter.record();
  const response = await client.messages.create({
    model: MODEL,
    // Sized to the chunk (~60 tokens/result + slack) so the JSON never truncates.
    max_tokens: Math.min(4096, 400 + items.length * 60),
    thinking: { type: "disabled" },
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: JSON.stringify(items.map((i) => ({ merchant: i.merchant, amount: i.amount }))),
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("categorization declined");
  const cost = usdCost(MODEL, response.usage) ?? 0;
  const text = response.content.find((b) => b.type === "text");
  if (!text) return { results: [], costUSD: cost };
  let parsed: { results?: CategorizeResult[] };
  try {
    parsed = JSON.parse(text.text) as { results: CategorizeResult[] };
  } catch {
    // Truncated or malformed output — salvage nothing from this chunk, but keep
    // the rest of the batch working.
    return { results: [], costUSD: cost };
  }
  // Guard the model's category strings against the enum (defense in depth).
  const valid = new Set<string>(CATEGORIES);
  const results = (parsed.results ?? [])
    .filter((r) => r && typeof r.merchant === "string" && valid.has(r.category))
    .map((r) => ({ merchant: r.merchant, category: r.category }));
  return { results, costUSD: cost };
}

export async function generateCategorize(
  req: CategorizeRequest
): Promise<{ results: CategorizeResult[]; costUSD: number | null }> {
  const client = new Anthropic({ timeout: 30_000, maxRetries: 1 });
  const chunks = chunkItems(req.items, CHUNK_SIZE);
  // Chunks run concurrently. A provider error in any chunk rejects and bubbles
  // to the route's error mapping (so "not configured" / "rate limited" still
  // surface); only per-chunk JSON truncation is swallowed (above).
  const settled = await Promise.all(chunks.map((c) => categorizeChunk(client, c)));
  const results = settled.flatMap((s) => s.results);
  const costUSD = settled.reduce((sum, s) => sum + s.costUSD, 0);
  return { results, costUSD };
}
