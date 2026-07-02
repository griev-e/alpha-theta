import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Credential-isolation contract for per-user state queries.
 *
 * The security-critical invariant (asserted only in prose in state.ts) is that
 * `getUserState` — the function whose result is serialized to the client via
 * GET /api/state — must NEVER select the `simplefin` column, which holds the
 * bank access URL. Only the server-only `getSimplefin` may read it. Here we mock
 * the db client and capture the exact column set each query selects, so a
 * refactor that accidentally widens getUserState's projection fails the build.
 */

const h = vi.hoisted(() => ({
  selectedColumns: [] as Record<string, unknown>[],
  rows: [] as unknown[],
}));

vi.mock("./index", () => ({
  getDb: () => ({
    select: (cols: Record<string, unknown>) => {
      h.selectedColumns.push(cols);
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(h.rows),
          }),
        }),
      };
    },
  }),
}));

import { getSimplefin, getUserState } from "./state";

beforeEach(() => {
  h.selectedColumns.length = 0;
  h.rows = [];
});

describe("getUserState", () => {
  it("selects only the two app blobs and their revisions — never simplefin", async () => {
    await getUserState("user-1");
    expect(h.selectedColumns).toHaveLength(1);
    const keys = Object.keys(h.selectedColumns[0]);
    expect(keys.sort()).toEqual(
      ["ledger", "ledgerUpdatedAt", "portfolio", "portfolioUpdatedAt"].sort()
    );
    // The invariant this whole test exists for:
    expect(keys).not.toContain("simplefin");
    expect(keys).not.toContain("accessUrl");
  });

  it("returns all-null state when the user has no row yet", async () => {
    h.rows = [];
    expect(await getUserState("user-1")).toEqual({
      portfolio: null,
      ledger: null,
      portfolioRev: null,
      ledgerRev: null,
    });
  });

  it("maps stored blobs and updatedAt timestamps into rev tokens", async () => {
    const when = new Date("2026-01-02T03:04:05.000Z");
    h.rows = [
      {
        portfolio: { a: 1 },
        ledger: { b: 2 },
        portfolioUpdatedAt: when,
        ledgerUpdatedAt: null,
      },
    ];
    expect(await getUserState("user-1")).toEqual({
      portfolio: { a: 1 },
      ledger: { b: 2 },
      portfolioRev: when.toISOString(),
      ledgerRev: null,
    });
  });
});

describe("getSimplefin", () => {
  it("does read the simplefin column (the server-only path)", async () => {
    h.rows = [{ simplefin: null }];
    await getSimplefin("user-1");
    expect(h.selectedColumns).toHaveLength(1);
    expect(Object.keys(h.selectedColumns[0])).toEqual(["simplefin"]);
  });

  it("returns null when the user has no link", async () => {
    h.rows = [{ simplefin: null }];
    expect(await getSimplefin("user-1")).toBeNull();
  });
});
