import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  daysUntil,
  fmtDate,
  fmtMultiple,
  fmtNum,
  fmtPct,
  fmtShares,
  fmtUSD,
  fmtUSDCompact,
  relativeTime,
  tone,
} from "./format";

describe("fmtUSD", () => {
  it("formats with two decimals, or whole dollars on request", () => {
    expect(fmtUSD(1234.5)).toBe("$1,234.50");
    expect(fmtUSD(1234.5, true)).toBe("$1,235");
    expect(fmtUSD(-12.5)).toBe("-$12.50");
  });

  it("returns an em dash for non-finite values", () => {
    expect(fmtUSD(NaN)).toBe("—");
    expect(fmtUSD(Infinity)).toBe("—");
  });
});

describe("fmtUSDCompact", () => {
  it("applies T/B/M/K suffixes with the documented precision", () => {
    expect(fmtUSDCompact(1.24e12)).toBe("$1.24T");
    expect(fmtUSDCompact(1.83e10)).toBe("$18.3B");
    expect(fmtUSDCompact(2.1e6)).toBe("$2.1M");
    expect(fmtUSDCompact(3.4e3)).toBe("$3.4K");
    expect(fmtUSDCompact(750)).toBe("$750");
  });

  it("preserves the sign and brackets at each magnitude boundary", () => {
    expect(fmtUSDCompact(-2.1e6)).toBe("-$2.1M");
    expect(fmtUSDCompact(1e12)).toBe("$1.00T");
    expect(fmtUSDCompact(1e9)).toBe("$1.0B");
    expect(fmtUSDCompact(999)).toBe("$999");
  });

  it("returns an em dash for non-finite values", () => {
    expect(fmtUSDCompact(NaN)).toBe("—");
  });
});

describe("fmtPct", () => {
  it("scales to percent with configurable digits", () => {
    expect(fmtPct(0.1234)).toBe("12.3%");
    expect(fmtPct(0.1234, 2)).toBe("12.34%");
  });

  it("prefixes a + only for positive values when signed", () => {
    expect(fmtPct(0.05, 1, true)).toBe("+5.0%");
    expect(fmtPct(-0.05, 1, true)).toBe("-5.0%");
    expect(fmtPct(0, 1, true)).toBe("0.0%");
  });

  it("returns an em dash for non-finite values", () => {
    expect(fmtPct(Infinity)).toBe("—");
  });
});

describe("fmtNum / fmtShares / fmtMultiple", () => {
  it("fmtNum pads to a fixed number of decimals with grouping", () => {
    expect(fmtNum(1234.5)).toBe("1,234.50");
    expect(fmtNum(1234.5, 0)).toBe("1,235");
    expect(fmtNum(NaN)).toBe("—");
  });

  it("fmtShares prints integers bare and fractions to 4 dp", () => {
    expect(fmtShares(1000)).toBe("1,000");
    expect(fmtShares(12.3456789)).toBe("12.3457");
    expect(fmtShares(Infinity)).toBe("—");
  });

  it("fmtMultiple appends × and handles null", () => {
    expect(fmtMultiple(18.2)).toBe("18.2×");
    expect(fmtMultiple(18.25, 2)).toBe("18.25×");
    expect(fmtMultiple(null)).toBe("—");
    expect(fmtMultiple(NaN)).toBe("—");
  });
});

describe("fmtDate", () => {
  it("formats a valid ISO date", () => {
    expect(fmtDate("2026-06-28")).toBe("Jun 28, 2026");
  });

  it("returns an em dash for null or unparseable input", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate("not-a-date")).toBe("—");
  });
});

describe("clock-relative helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("daysUntil counts forward and backward from today", () => {
    expect(daysUntil("2026-07-08")).toBe(10);
    expect(daysUntil("2026-06-18")).toBe(-10);
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil("bad")).toBeNull();
  });

  it("relativeTime bins by minutes, hours, days, then a date", () => {
    expect(relativeTime("2026-06-28T11:59:30Z")).toBe("now");
    expect(relativeTime("2026-06-28T11:30:00Z")).toBe("30m ago");
    expect(relativeTime("2026-06-28T09:00:00Z")).toBe("3h ago");
    expect(relativeTime("2026-06-25T12:00:00Z")).toBe("3d ago");
    // Older than a week falls back to a short calendar date.
    expect(relativeTime("2026-06-10T12:00:00Z")).toBe("Jun 10");
    expect(relativeTime("garbage")).toBe("—");
  });
});

describe("tone", () => {
  it("classifies sign with a tiny deadband around zero", () => {
    expect(tone(0.01)).toBe("pos");
    expect(tone(-0.01)).toBe("neg");
    expect(tone(0)).toBe("flat");
    expect(tone(1e-9)).toBe("flat");
  });
});
