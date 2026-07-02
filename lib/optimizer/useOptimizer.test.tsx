// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holding, makePortfolio } from "../__tests__/factory";
import { buildOptimizerInputs } from "./optimize";
import type { ObjectiveId, OptimizerConstraints } from "./types";
import { useOptimizer } from "./useOptimizer";

/**
 * Like useMonteCarlo, useOptimizer runs its solve in a Web Worker with a
 * deferred synchronous fallback when no Worker exists — the path jsdom takes.
 * We verify that fallback: pending on mount, a solved result one tick later,
 * null inputs short-circuiting, and re-solving when the objective changes.
 */
const PORTFOLIO = makePortfolio(
  [
    holding({ symbol: "NVDA", shares: 20, price: 120, averageCost: 80 }),
    holding({ symbol: "AAPL", shares: 30, price: 200, averageCost: 150 }),
    holding({ symbol: "MSFT", shares: 15, price: 400, averageCost: 300 }),
    holding({ symbol: "JNJ", shares: 40, price: 160, averageCost: 150 }),
    holding({ symbol: "KO", shares: 50, price: 60, averageCost: 55 }),
  ],
  5000
);
const INPUTS = buildOptimizerInputs(PORTFOLIO)!;
const CONSTRAINTS: OptimizerConstraints = {
  maxWeight: 0.3,
  minWeight: 0,
  allowExit: true,
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useOptimizer (sync fallback)", () => {
  it("solves on the deferred tick when no Worker is available", () => {
    expect(typeof Worker).toBe("undefined"); // jsdom really has no Worker
    const { result } = renderHook(() =>
      useOptimizer(INPUTS, "sharpe", CONSTRAINTS)
    );
    expect(result.current).toEqual({ result: null, pending: true });

    act(() => void vi.advanceTimersByTime(30));
    expect(result.current.pending).toBe(false);
    expect(result.current.result).not.toBeNull();
    // The invested target weights form a simplex.
    const w = result.current.result!.positions.map((p) => p.targetWeight);
    expect(w.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 4);
  });

  it("clears the result and settles when inputs are null", () => {
    const { result } = renderHook(() =>
      useOptimizer(null, "sharpe", CONSTRAINTS)
    );
    act(() => void vi.advanceTimersByTime(30));
    expect(result.current).toEqual({ result: null, pending: false });
  });

  it("re-solves when the objective changes", () => {
    const { result, rerender } = renderHook(
      ({ obj }) => useOptimizer(INPUTS, obj, CONSTRAINTS),
      { initialProps: { obj: "sharpe" as ObjectiveId } }
    );
    act(() => void vi.advanceTimersByTime(30));
    const sharpe = result.current.result;
    expect(sharpe).not.toBeNull();

    rerender({ obj: "min-vol" });
    // Recomputing: pending flips true while the previous result stays visible.
    expect(result.current.pending).toBe(true);
    expect(result.current.result).toBe(sharpe);
    act(() => void vi.advanceTimersByTime(30));
    expect(result.current.pending).toBe(false);
    expect(result.current.result).not.toBeNull();
  });
});
