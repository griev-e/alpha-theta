// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./useDebouncedValue";

/**
 * Coalesces rapid input: the debounced copy only updates after `delayMs` of
 * quiet, and a value that changes again inside the window resets the timer so
 * only the settled value lands.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDebouncedValue", () => {
  it("returns the seed value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("a", 120));
    expect(result.current).toBe("a");
  });

  it("updates only after the delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebouncedValue(v, 120),
      { initialProps: { v: "a" } }
    );
    rerender({ v: "b" });
    expect(result.current).toBe("a"); // still the old value

    act(() => void vi.advanceTimersByTime(119));
    expect(result.current).toBe("a");
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe("b");
  });

  it("resets the timer when the value changes again inside the window", () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebouncedValue(v, 120),
      { initialProps: { v: "a" } }
    );
    rerender({ v: "b" });
    act(() => void vi.advanceTimersByTime(80));
    rerender({ v: "c" }); // restarts the 120ms window
    act(() => void vi.advanceTimersByTime(80));
    expect(result.current).toBe("a"); // 160ms total, but only 80ms since "c"
    act(() => void vi.advanceTimersByTime(40));
    expect(result.current).toBe("c"); // never emits the intermediate "b"
  });
});
