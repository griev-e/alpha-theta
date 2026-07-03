import { describe, expect, it } from "vitest";
import {
  ASSUMPTION_PRESETS,
  DEFAULT_ASSUMPTIONS,
  cloneAssumptions,
  effectiveApr,
  isInvested,
  matchPreset,
} from "./assumptions";
import type { Account } from "./data";

const acct = (over: Partial<Account>): Account => ({
  id: "a",
  name: "x",
  institution: "y",
  kind: "credit",
  balance: -100,
  trend: [],
  mask: "1",
  ...over,
});

describe("assumptions presets", () => {
  it("base preset equals the defaults", () => {
    expect(matchPreset(DEFAULT_ASSUMPTIONS)).toBe("base");
  });

  it("every preset round-trips through matchPreset", () => {
    for (const p of ASSUMPTION_PRESETS) {
      expect(matchPreset(cloneAssumptions(p.values))).toBe(p.id);
    }
  });

  it("returns null once a value is customized", () => {
    expect(matchPreset({ ...DEFAULT_ASSUMPTIONS, investReturn: 0.123 })).toBeNull();
  });
});

describe("effectiveApr", () => {
  it("uses the account's own rate when set", () => {
    expect(effectiveApr(acct({ apr: 0.09 }), DEFAULT_ASSUMPTIONS)).toBe(0.09);
  });

  it("falls back to the credit vs loan default by kind", () => {
    expect(effectiveApr(acct({ kind: "credit" }), DEFAULT_ASSUMPTIONS)).toBe(DEFAULT_ASSUMPTIONS.creditApr);
    expect(effectiveApr(acct({ kind: "loan" }), DEFAULT_ASSUMPTIONS)).toBe(DEFAULT_ASSUMPTIONS.loanApr);
  });
});

describe("isInvested", () => {
  it("treats brokerage and retirement as invested", () => {
    expect(isInvested("brokerage")).toBe(true);
    expect(isInvested("retirement")).toBe(true);
    expect(isInvested("checking")).toBe(false);
    expect(isInvested("savings")).toBe(false);
  });
});
