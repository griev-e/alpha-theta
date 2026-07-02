// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAsyncCompute } from "./useAsyncCompute";

/**
 * Runs an expensive sync computation off the critical render path: pending on
 * mount, value lands ~one frame later, and the previous value is retained while
 * a dependency change recomputes (so charts don't unmount). Fake timers make
 * the deferred tick deterministic.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useAsyncCompute", () => {
  it("is pending with a null value until the deferred tick fires", () => {
    const { result } = renderHook(() => useAsyncCompute(() => 42, []));
    expect(result.current).toEqual({ value: null, pending: true });

    act(() => void vi.advanceTimersByTime(30));
    expect(result.current).toEqual({ value: 42, pending: false });
  });

  it("recomputes when deps change but keeps the old value while pending", () => {
    let n = 1;
    const { result, rerender } = renderHook(
      ({ dep }) => useAsyncCompute(() => n, [dep]),
      { initialProps: { dep: "a" } }
    );
    act(() => void vi.advanceTimersByTime(30));
    expect(result.current.value).toBe(1);

    n = 2;
    rerender({ dep: "b" });
    // Recomputing: pending flips true, but the last value stays visible.
    expect(result.current).toEqual({ value: 1, pending: true });
    act(() => void vi.advanceTimersByTime(30));
    expect(result.current).toEqual({ value: 2, pending: false });
  });

  it("does not commit a stale result when deps change mid-flight", () => {
    let n = 10;
    const { result, rerender } = renderHook(
      ({ dep }) => useAsyncCompute(() => n, [dep]),
      { initialProps: { dep: "a" } }
    );
    // Change deps before the first tick resolves; only the latest should land.
    n = 20;
    rerender({ dep: "b" });
    act(() => void vi.advanceTimersByTime(30));
    expect(result.current).toEqual({ value: 20, pending: false });
  });
});
