import { describe, expect, it } from "vitest";
import {
  etStamp,
  inRegularHours,
  latestSession,
  minutesSinceOpen,
  regularBars,
  RTH_MINUTES,
  sessionKey,
  splitSessions,
} from "./session";
import type { Bar } from "./types";

// January dates: ET = UTC−5 (EST). July dates: ET = UTC−4 (EDT).
const bar = (t: string): Bar => ({ t, o: 1, h: 2, l: 0.5, c: 1.5, v: 100 });

describe("etStamp", () => {
  it("converts UTC to Eastern Standard Time in winter", () => {
    const s = etStamp("2026-01-15T14:30:00Z"); // 09:30 EST
    expect(s.dateKey).toBe("2026-01-15");
    expect(s.minutes).toBe(9 * 60 + 30);
  });

  it("converts UTC to Eastern Daylight Time in summer", () => {
    const s = etStamp("2026-07-10T13:30:00Z"); // 09:30 EDT
    expect(s.dateKey).toBe("2026-07-10");
    expect(s.minutes).toBe(9 * 60 + 30);
  });

  it("rolls the date across the ET midnight boundary", () => {
    // 03:00 UTC = 22:00 ET the previous day.
    const s = etStamp("2026-01-15T03:00:00Z");
    expect(s.dateKey).toBe("2026-01-14");
    expect(s.minutes).toBe(22 * 60);
  });
});

describe("regular hours", () => {
  it("flags the open as in-session and 09:29 as premarket", () => {
    expect(inRegularHours("2026-01-15T14:30:00Z")).toBe(true); // 09:30
    expect(inRegularHours("2026-01-15T14:29:00Z")).toBe(false); // 09:29
    expect(inRegularHours("2026-01-15T20:59:00Z")).toBe(true); // 15:59
    expect(inRegularHours("2026-01-15T21:00:00Z")).toBe(false); // 16:00
  });

  it("clamps minutesSinceOpen to the session", () => {
    expect(minutesSinceOpen("2026-01-15T13:00:00Z")).toBe(0); // premarket
    expect(minutesSinceOpen("2026-01-15T15:30:00Z")).toBe(60); // 10:30
    expect(minutesSinceOpen("2026-01-15T23:00:00Z")).toBe(RTH_MINUTES); // after hours
  });
});

describe("session grouping", () => {
  const bars = [
    bar("2026-01-14T14:30:00Z"),
    bar("2026-01-14T22:00:00Z"), // 17:00 ET — after hours
    bar("2026-01-15T12:00:00Z"), // premarket next day
    bar("2026-01-15T14:30:00Z"),
  ];

  it("splits bars by ET trading day", () => {
    const sessions = splitSessions(bars);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toHaveLength(2);
    expect(sessions[1]).toHaveLength(2);
    expect(sessionKey(sessions[1][0].t)).toBe("2026-01-15");
  });

  it("latestSession returns the final day, regularBars filters RTH", () => {
    expect(latestSession(bars)).toHaveLength(2);
    expect(latestSession([])).toHaveLength(0);
    expect(regularBars(bars)).toHaveLength(2); // the two 09:30 bars
  });
});
