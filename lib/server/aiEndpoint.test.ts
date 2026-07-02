import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AiCache,
  GenLimiter,
  mapAnthropicError,
  requestAllowed,
} from "./aiEndpoint";

/**
 * Shared plumbing in front of every Anthropic-backed route: the response cache,
 * the hourly generation cap, provider-error mapping, and the per-IP request
 * limiter. All four are cost/security backstops, so their exact behavior is
 * pinned here. AiCache/GenLimiter read Date.now() internally — fake timers make
 * their TTL/window logic deterministic.
 */

describe("AiCache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("misses on an unknown key", () => {
    const cache = new AiCache<number>(1000, 10);
    expect(cache.get("nope")).toBeNull();
  });

  it("returns a cached value within its TTL", () => {
    const cache = new AiCache<string>(1000, 10);
    cache.set("k", "v");
    vi.advanceTimersByTime(999);
    expect(cache.get("k")).toBe("v");
  });

  it("expires a value once its TTL elapses", () => {
    const cache = new AiCache<string>(1000, 10);
    cache.set("k", "v");
    vi.advanceTimersByTime(1001);
    expect(cache.get("k")).toBeNull();
  });

  it("evicts the oldest entry when at capacity (LRU by insertion)", () => {
    const cache = new AiCache<number>(10_000, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3); // over capacity → "a" (oldest) is dropped
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });
});

describe("GenLimiter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is not limited until the cap is reached", () => {
    const lim = new GenLimiter(60_000, 3);
    expect(lim.limited()).toBe(false);
    lim.record();
    lim.record();
    expect(lim.limited()).toBe(false);
    lim.record(); // now at 3
    expect(lim.limited()).toBe(true);
  });

  it("resets the count when the window rolls over", () => {
    const lim = new GenLimiter(60_000, 2);
    lim.record();
    lim.record();
    expect(lim.limited()).toBe(true);
    vi.advanceTimersByTime(60_001); // new window
    expect(lim.limited()).toBe(false);
  });
});

describe("mapAnthropicError", () => {
  const labels = {
    notConfigured: "no key",
    rateLimited: "slow down",
    timedOut: "timed out",
    unavailable: "unavailable",
  };

  it("maps an auth error to 501 (a bad key behaves like no key)", () => {
    const err = new Anthropic.AuthenticationError(
      401,
      undefined,
      "bad key",
      new Headers()
    );
    expect(mapAnthropicError(err, labels)).toEqual({
      status: 501,
      error: "no key",
    });
  });

  it("maps a rate-limit error to 429", () => {
    const err = new Anthropic.RateLimitError(429, undefined, "rate", new Headers());
    expect(mapAnthropicError(err, labels)).toEqual({
      status: 429,
      error: "slow down",
    });
  });

  it("maps a timeout/abort to 504 when a timedOut label is provided", () => {
    const timeout = new Anthropic.APIConnectionTimeoutError({ message: "slow" });
    const abort = new Anthropic.APIUserAbortError({ message: "abort" });
    expect(mapAnthropicError(timeout, labels).status).toBe(504);
    expect(mapAnthropicError(abort, labels).status).toBe(504);
  });

  it("falls back to 502 for a timeout when no timedOut label is set", () => {
    const timeout = new Anthropic.APIConnectionTimeoutError({ message: "slow" });
    const noTimeout = { ...labels, timedOut: undefined };
    expect(mapAnthropicError(timeout, noTimeout)).toEqual({
      status: 502,
      error: "unavailable",
    });
  });

  it("maps any other error to 502 unavailable", () => {
    expect(mapAnthropicError(new Error("boom"), labels)).toEqual({
      status: 502,
      error: "unavailable",
    });
  });
});

describe("requestAllowed", () => {
  const reqFrom = (ip: string) =>
    new Request("https://example.com", { headers: { "x-forwarded-for": ip } });

  it("allows up to `max` requests per IP+endpoint window, then blocks", () => {
    const ip = "203.0.113.1";
    const endpoint = "brief-test-a";
    expect(requestAllowed(reqFrom(ip), endpoint, 2)).toBe(true);
    expect(requestAllowed(reqFrom(ip), endpoint, 2)).toBe(true);
    expect(requestAllowed(reqFrom(ip), endpoint, 2)).toBe(false);
  });

  it("buckets separately by endpoint", () => {
    const ip = "203.0.113.2";
    expect(requestAllowed(reqFrom(ip), "brief-test-b", 1)).toBe(true);
    expect(requestAllowed(reqFrom(ip), "brief-test-b", 1)).toBe(false);
    // A different endpoint has its own fresh budget for the same IP.
    expect(requestAllowed(reqFrom(ip), "optimize-test-b", 1)).toBe(true);
  });

  it("buckets separately by client IP", () => {
    const endpoint = "brief-test-c";
    expect(requestAllowed(reqFrom("198.51.100.1"), endpoint, 1)).toBe(true);
    expect(requestAllowed(reqFrom("198.51.100.1"), endpoint, 1)).toBe(false);
    expect(requestAllowed(reqFrom("198.51.100.2"), endpoint, 1)).toBe(true);
  });
});
