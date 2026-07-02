import { describe, expect, it } from "vitest";
import { checkLock, clientKey, recordFailure, recordSuccess } from "./rateLimit";

/**
 * The login brute-force lock. This is the app's actual auth-hardening surface,
 * so its fixed-window behavior is pinned here. `checkLock`/`recordFailure`
 * accept an injectable `now`, so the window/lockout timing is deterministic
 * without fake timers. Each test uses a unique key because the limiter's map
 * is module-scoped and persists across tests.
 */
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60_000;
const LOCKOUT_MS = 15 * 60_000;

let seq = 0;
const uniqueKey = () => `test-key-${seq++}`;

describe("checkLock / recordFailure", () => {
  it("is unlocked before any failures", () => {
    expect(checkLock(uniqueKey())).toEqual({ limited: false, retryAfter: 0 });
  });

  it("tolerates up to MAX_FAILS-1 failures without locking", () => {
    const key = uniqueKey();
    for (let i = 0; i < MAX_FAILS - 1; i++) {
      expect(recordFailure(key, 1000).limited).toBe(false);
    }
    expect(checkLock(key, 1000).limited).toBe(false);
  });

  it("locks out on the MAX_FAILS-th failure and reports a retryAfter", () => {
    const key = uniqueKey();
    const now = 1_000_000;
    let state = { limited: false, retryAfter: 0 };
    for (let i = 0; i < MAX_FAILS; i++) state = recordFailure(key, now);
    expect(state.limited).toBe(true);
    expect(state.retryAfter).toBe(LOCKOUT_MS / 1000);
    expect(checkLock(key, now).limited).toBe(true);
  });

  it("clears the lock once the lockout window elapses", () => {
    const key = uniqueKey();
    const now = 1_000_000;
    for (let i = 0; i < MAX_FAILS; i++) recordFailure(key, now);
    expect(checkLock(key, now + LOCKOUT_MS - 1).limited).toBe(true);
    expect(checkLock(key, now + LOCKOUT_MS + 1).limited).toBe(false);
  });

  it("resets the failure count once the rolling window passes", () => {
    const key = uniqueKey();
    // Four failures, then a gap longer than the window: the counter restarts,
    // so four more failures still don't trip the lock.
    for (let i = 0; i < MAX_FAILS - 1; i++) recordFailure(key, 0);
    const later = WINDOW_MS + 100;
    for (let i = 0; i < MAX_FAILS - 1; i++) {
      expect(recordFailure(key, later + i).limited).toBe(false);
    }
  });

  it("recordSuccess wipes a client's failure record", () => {
    const key = uniqueKey();
    for (let i = 0; i < MAX_FAILS - 1; i++) recordFailure(key, 0);
    recordSuccess(key);
    // Fresh slate: it takes the full MAX_FAILS again to lock.
    for (let i = 0; i < MAX_FAILS - 1; i++) {
      expect(recordFailure(key, 0).limited).toBe(false);
    }
  });

  it("counts down retryAfter as time passes inside the lockout", () => {
    const key = uniqueKey();
    const now = 5_000_000;
    for (let i = 0; i < MAX_FAILS; i++) recordFailure(key, now);
    const half = checkLock(key, now + LOCKOUT_MS / 2);
    expect(half.retryAfter).toBeLessThan(LOCKOUT_MS / 1000);
    expect(half.retryAfter).toBeGreaterThan(0);
  });
});

describe("clientKey", () => {
  const req = (headers: Record<string, string>) =>
    new Request("https://example.com", { headers });

  it("uses the first x-forwarded-for hop", () => {
    expect(clientKey(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7"
    );
  });

  it("trims whitespace around the forwarded IP", () => {
    expect(clientKey(req({ "x-forwarded-for": "  198.51.100.2 " }))).toBe(
      "198.51.100.2"
    );
  });

  it("falls back to x-real-ip, then to 'unknown'", () => {
    expect(clientKey(req({ "x-real-ip": "192.0.2.9" }))).toBe("192.0.2.9");
    expect(clientKey(req({}))).toBe("unknown");
  });
});
