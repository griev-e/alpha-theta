import { describe, expect, it } from "vitest";
import { usdCost } from "./cost";

/**
 * `usdCost` turns an Anthropic usage object into a USD estimate. A regression
 * here is silent — the UI shows a wrong `costUSD` footer, nothing crashes — so
 * the exact per-model / cache-tier math is pinned here. Prices are per MTok;
 * cache writes bill at 1.25× input, cache reads at 0.1× input.
 */
describe("usdCost", () => {
  it("returns null for an unknown model so the UI can omit the footer", () => {
    expect(usdCost("gpt-4", { input_tokens: 1000, output_tokens: 1000 })).toBeNull();
    expect(usdCost("", {})).toBeNull();
  });

  it("prices plain input + output at the model's per-MTok rate", () => {
    // Haiku: $1/MTok in, $5/MTok out.
    const cost = usdCost("claude-haiku-4-5", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(1 + 5, 10);
  });

  it("bills cache writes at 1.25× input and cache reads at 0.1× input", () => {
    // Sonnet: $3/MTok in. 1M cache-write = 3 * 1.25 = 3.75; 1M read = 3 * 0.1 = 0.3.
    const cost = usdCost("claude-sonnet-4-6", {
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(3.75 + 0.3, 10);
  });

  it("sums every token bucket for a mixed call", () => {
    // Opus: $5 in / $25 out. 100k in, 200k write, 300k read, 50k out.
    const cost = usdCost("claude-opus-4-8", {
      input_tokens: 100_000,
      cache_creation_input_tokens: 200_000,
      cache_read_input_tokens: 300_000,
      output_tokens: 50_000,
    });
    const expected =
      (100_000 * 5 + 200_000 * 5 * 1.25 + 300_000 * 5 * 0.1 + 50_000 * 25) /
      1_000_000;
    expect(cost).toBeCloseTo(expected, 10);
  });

  it("treats missing / null usage fields as zero", () => {
    expect(usdCost("claude-haiku-4-5", {})).toBe(0);
    expect(
      usdCost("claude-haiku-4-5", { input_tokens: null, output_tokens: null })
    ).toBe(0);
  });
});
