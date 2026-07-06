import { describe, expect, it } from "vitest";
import { usMarketSession } from "./marketSession";

// Helper: a UTC instant. ET is UTC-5 (EST) in January, UTC-4 (EDT) in July.
const at = (iso: string) => new Date(iso);

describe("usMarketSession", () => {
  it("classifies the regular session (9:30–16:00 ET)", () => {
    // 2026-01-06 is a Tuesday. 15:00 UTC = 10:00 EST.
    expect(usMarketSession(at("2026-01-06T15:00:00Z"))).toBe("open");
    // 21:30 UTC = 16:30 EST → after hours.
    expect(usMarketSession(at("2026-01-06T21:30:00Z"))).toBe("post");
  });

  it("classifies pre-market (4:00–9:30 ET)", () => {
    // 13:00 UTC = 08:00 EST.
    expect(usMarketSession(at("2026-01-06T13:00:00Z"))).toBe("pre");
  });

  it("classifies overnight and weekends as closed", () => {
    // 06:00 UTC = 01:00 EST → closed (before 4:00).
    expect(usMarketSession(at("2026-01-06T06:00:00Z"))).toBe("closed");
    // 2026-01-10 is a Saturday.
    expect(usMarketSession(at("2026-01-10T15:00:00Z"))).toBe("closed");
  });

  it("respects daylight saving (EDT, UTC-4) in summer", () => {
    // 2026-07-06 is a Monday. 13:30 UTC = 09:30 EDT → open.
    expect(usMarketSession(at("2026-07-06T13:30:00Z"))).toBe("open");
    // 13:00 UTC = 09:00 EDT → still pre-market.
    expect(usMarketSession(at("2026-07-06T13:00:00Z"))).toBe("pre");
  });
});
