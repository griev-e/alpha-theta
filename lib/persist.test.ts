import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Client save-back layer for authenticated mode. It hydrates from /api/state,
 * echoes the compare-and-swap revision on every PUT, and — the honesty
 * guarantee — surfaces failures/conflicts through the sync banner instead of
 * swallowing them. These paths (retry, 4xx-no-retry, 409 conflict, rev
 * threading) are exercised here against a mocked fetch. Module scope persists
 * across tests, so we reset the sync status and re-import a fresh module per
 * test to clear the in-memory rev cache.
 */

const fetchMock = vi.fn();

/**
 * Load persist and syncStatus from the *same* post-reset module registry, so
 * the sync-status channel the test reads is the exact instance persist writes
 * to. (resetModules gives each test a fresh module scope — clean rev cache and
 * a status that starts at "ok".)
 */
async function load() {
  const persist = await import("./persist");
  const { getSyncStatus } = await import("./syncStatus");
  return { ...persist, getSyncStatus };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const jsonRes = (body: unknown, init?: { status?: number }) =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });

describe("getServerState", () => {
  it("returns both blobs on a 200 and records their revisions", async () => {
    const { getServerState } = await load();
    fetchMock.mockResolvedValueOnce(
      jsonRes({
        portfolio: { p: 1 },
        ledger: null,
        portfolioRev: "rev-A",
        ledgerRev: null,
      })
    );
    const state = await getServerState();
    expect(state).toMatchObject({ portfolio: { p: 1 }, ledger: null });
    expect(fetchMock).toHaveBeenCalledWith("/api/state", expect.any(Object));
  });

  it("does NOT retry a 4xx (a failed load must not read as empty)", async () => {
    const { getServerState } = await load();
    fetchMock.mockResolvedValueOnce(jsonRes({}, { status: 401 }));
    expect(await getServerState()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a transient network failure before succeeding", async () => {
    vi.useFakeTimers();
    const { getServerState } = await load();
    fetchMock
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(
        jsonRes({ portfolio: null, ledger: null, portfolioRev: null, ledgerRev: null })
      );
    const p = getServerState();
    await vi.runAllTimersAsync();
    const state = await p;
    expect(state).toEqual({
      portfolio: null,
      ledger: null,
      portfolioRev: null,
      ledgerRev: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe("putPortfolio", () => {
  it("returns true, marks sync ok, and threads the rev on success", async () => {
    const { getServerState, putPortfolio, getSyncStatus } = await load();
    // Hydrate first so the module knows the base revision to send.
    fetchMock.mockResolvedValueOnce(
      jsonRes({
        portfolio: null,
        ledger: null,
        portfolioRev: "rev-1",
        ledgerRev: null,
      })
    );
    await getServerState();

    fetchMock.mockResolvedValueOnce(jsonRes({ rev: "rev-2" }));
    expect(await putPortfolio({ x: 1 })).toBe(true);
    expect(getSyncStatus()).toBe("ok");

    const [, init] = fetchMock.mock.calls[1];
    expect(init.method).toBe("PUT");
    expect(init.headers["x-base-rev"]).toBe("rev-1");

    // The next save should send the server's returned rev as its new base.
    fetchMock.mockResolvedValueOnce(jsonRes({ rev: "rev-3" }));
    await putPortfolio({ x: 2 });
    const [, init2] = fetchMock.mock.calls[2];
    expect(init2.headers["x-base-rev"]).toBe("rev-2");
  });

  it("returns false and flags a conflict on 409", async () => {
    const { putPortfolio, getSyncStatus } = await load();
    fetchMock.mockResolvedValueOnce(jsonRes({ rev: "newer" }, { status: 409 }));
    expect(await putPortfolio({ x: 1 })).toBe(false);
    expect(getSyncStatus()).toBe("conflict");
  });

  it("returns false and flags an error after retries on a network failure", async () => {
    vi.useFakeTimers();
    const { putPortfolio, getSyncStatus } = await load();
    fetchMock.mockRejectedValue(new Error("offline"));
    const p = putPortfolio({ x: 1 });
    await vi.runAllTimersAsync();
    expect(await p).toBe(false);
    expect(getSyncStatus()).toBe("error");
    vi.useRealTimers();
  });
});
