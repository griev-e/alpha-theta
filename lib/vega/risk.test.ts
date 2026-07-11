import { describe, expect, it } from "vitest";
import { dayRisk, kellyFraction, positionSize } from "./risk";
import { DEFAULT_SETTINGS, type Trade } from "./types";

describe("positionSize", () => {
  const base = {
    accountSize: 50_000,
    riskPct: 1,
    side: "long" as const,
    entry: 100,
    stop: 98,
  };

  it("sizes off the stop distance", () => {
    const s = positionSize({ ...base, target: 106 });
    expect(s.valid).toBe(true);
    // $500 risk budget / $2 per share = 250 shares.
    expect(s.shares).toBe(250);
    expect(s.notional).toBe(25_000);
    expect(s.riskDollars).toBe(500);
    expect(s.stopPct).toBeCloseTo(0.02, 10);
    expect(s.rr).toBeCloseTo(3, 10);
    expect(s.rTargets.map((t) => t.price)).toEqual([102, 104, 106]);
  });

  it("handles shorts symmetrically", () => {
    const s = positionSize({ ...base, side: "short", entry: 98, stop: 100, target: 92 });
    expect(s.valid).toBe(true);
    expect(s.shares).toBe(250);
    expect(s.rr).toBeCloseTo(3, 10);
    expect(s.rTargets.map((t) => t.price)).toEqual([96, 94, 92]);
  });

  it("rejects a stop on the wrong side", () => {
    expect(positionSize({ ...base, stop: 101 }).valid).toBe(false);
    expect(positionSize({ ...base, side: "short", entry: 98, stop: 97 }).valid).toBe(false);
  });

  it("rejects when the budget can't buy one share", () => {
    const s = positionSize({ accountSize: 100, riskPct: 1, side: "long", entry: 100, stop: 90 });
    expect(s.valid).toBe(false);
  });

  it("ignores a target on the wrong side rather than reporting negative R:R", () => {
    expect(positionSize({ ...base, target: 95 }).rr).toBeNull();
  });
});

describe("kellyFraction", () => {
  it("computes W − (1−W)/payoff", () => {
    // 60% win, 2:1 payoff → 0.6 − 0.4/2 = 0.4.
    expect(kellyFraction(0.6, 200, -100)).toBeCloseTo(0.4, 10);
  });

  it("clamps a negative edge to zero and nulls bad inputs", () => {
    expect(kellyFraction(0.3, 100, -100)).toBe(0);
    expect(kellyFraction(0.6, null, -100)).toBeNull();
    expect(kellyFraction(0.6, 100, null)).toBeNull();
    expect(kellyFraction(0.6, 100, 50)).toBeNull(); // avgLoss must be negative
  });
});

describe("dayRisk", () => {
  const closed = (pnl: number, day: string): Trade => ({
    id: `t${pnl}${day}`,
    symbol: "TEST",
    side: "long",
    qty: 1,
    entry: 100,
    exit: 100 + pnl,
    entryAt: `${day}T14:35:00Z`,
    exitAt: `${day}T15:00:00Z`,
  });
  const settings = { ...DEFAULT_SETTINGS, accountSize: 10_000, dailyLossPct: 3 };

  it("tracks the loss limit for the given day only", () => {
    const trades = [closed(-150, "2026-01-15"), closed(-500, "2026-01-14")];
    const r = dayRisk(trades, settings, "2026-01-15");
    expect(r.limit).toBe(300);
    expect(r.realized).toBe(-150);
    expect(r.used).toBeCloseTo(0.5, 10);
    expect(r.remaining).toBe(150);
    expect(r.halted).toBe(false);
  });

  it("halts at the limit and never reports negative headroom", () => {
    const r = dayRisk([closed(-400, "2026-01-15")], settings, "2026-01-15");
    expect(r.halted).toBe(true);
    expect(r.used).toBe(1);
    expect(r.remaining).toBe(0);
  });

  it("is green on a profitable day", () => {
    const r = dayRisk([closed(250, "2026-01-15")], settings, "2026-01-15");
    expect(r.used).toBe(0);
    expect(r.halted).toBe(false);
    expect(r.realized).toBe(250);
  });
});
