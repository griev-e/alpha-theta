import { describe, expect, it } from "vitest";
import { volumeProfile } from "./profile";
import type { Bar } from "./types";

// Flat bars put all volume at one typical price, making bins predictable.
const at = (price: number, v: number, i: number): Bar => ({
  t: `2026-01-15T14:${String(30 + i).padStart(2, "0")}:00Z`,
  o: price,
  h: price,
  l: price,
  c: price,
  v,
});

describe("volumeProfile", () => {
  it("puts the POC at the heaviest price and covers ~70% in the value area", () => {
    const bars = [
      at(100, 100, 0),
      at(105, 800, 1), // the magnet
      at(110, 100, 2),
    ];
    const p = volumeProfile(bars, 10);
    expect(p).not.toBeNull();
    expect(p!.totalVolume).toBe(1000);
    // POC bin midpoint should sit at ~105.
    expect(Math.abs(p!.poc - 105)).toBeLessThan(p!.binSize);
    // 80% of volume sits in one bin, so the value area is tight around it.
    expect(p!.vah - p!.val).toBeLessThanOrEqual(3 * p!.binSize + 1e-9);
    expect(p!.val).toBeLessThanOrEqual(p!.poc);
    expect(p!.vah).toBeGreaterThanOrEqual(p!.poc);
  });

  it("conserves total volume across bins", () => {
    const bars = [at(10, 300, 0), at(11, 200, 1), at(12, 500, 2)];
    const p = volumeProfile(bars, 6)!;
    const sum = p.bins.reduce((s, b) => s + b.volume, 0);
    expect(sum).toBe(1000);
  });

  it("returns null when there is nothing to profile", () => {
    expect(volumeProfile([], 24)).toBeNull();
    expect(volumeProfile([at(100, 0, 0), at(100, 0, 1)], 24)).toBeNull();
    // Zero price range → null rather than a degenerate divide.
    expect(volumeProfile([at(100, 10, 0), at(100, 10, 1)], 24)).toBeNull();
  });
});
