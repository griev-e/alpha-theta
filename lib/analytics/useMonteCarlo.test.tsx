// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MonteCarloInputs } from "./montecarlo";
import { useMonteCarlo } from "./useMonteCarlo";

/**
 * jsdom has no Web Worker, so `typeof Worker === "undefined"` and the hook takes
 * its synchronous fallback path — the resilience contract that keeps Monte Carlo
 * working under SSR / old browsers / a failed worker spawn. Here we verify that
 * fallback: pending on mount, a real result one tick later, and null inputs
 * short-circuiting to no result.
 */
const inputs: MonteCarloInputs = {
  initialValue: 100_000,
  mu: 0.08,
  sigma: 0.18,
  years: 10,
  monthlyContribution: 500,
  targetValue: 400_000,
  paths: 500,
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useMonteCarlo (sync fallback)", () => {
  it("computes a result on the deferred tick when no Worker is available", () => {
    expect(typeof Worker).toBe("undefined"); // guard: jsdom really has no Worker
    const { result } = renderHook(() => useMonteCarlo(inputs));
    expect(result.current.pending).toBe(true);
    expect(result.current.result).toBeNull();

    act(() => void vi.advanceTimersByTime(30));
    expect(result.current.pending).toBe(false);
    expect(result.current.result).not.toBeNull();
    expect(result.current.result!.bands.length).toBeGreaterThan(0);
  });

  it("clears the result and settles when inputs are null", () => {
    const { result } = renderHook(() => useMonteCarlo(null));
    act(() => void vi.advanceTimersByTime(30));
    expect(result.current).toEqual({ result: null, pending: false });
  });

  it("is deterministic — the same inputs yield the same target probability", () => {
    const a = renderHook(() => useMonteCarlo(inputs));
    act(() => void vi.advanceTimersByTime(30));
    const b = renderHook(() => useMonteCarlo(inputs));
    act(() => void vi.advanceTimersByTime(30));
    expect(b.result.current.result!.probTargetAtHorizon).toBe(
      a.result.current.result!.probTargetAtHorizon
    );
  });
});
