import { describe, expect, it } from "vitest";
import {
  displayWindow,
  etStamp,
  inRegularHours,
  latestSession,
  minutesSinceOpen,
  regularBars,
  replayStart,
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

describe("displayWindow / replayStart", () => {
  // Two ET sessions of three bars each (14:30Z = 09:30 ET in January).
  const twoDays = [
    bar("2026-01-15T14:30:00Z"), bar("2026-01-15T14:35:00Z"), bar("2026-01-15T14:40:00Z"),
    bar("2026-01-16T14:30:00Z"), bar("2026-01-16T14:35:00Z"), bar("2026-01-16T14:40:00Z"),
  ];

  it("windows by session count per interval", () => {
    expect(displayWindow(twoDays, "1m")).toHaveLength(3);
    expect(displayWindow(twoDays, "5m")).toHaveLength(6);
    expect(displayWindow(twoDays, "1d")).toBe(twoDays); // daily shows the span
  });

  it("rewinds intraday replay to the latest session's first bar", () => {
    // Two sessions of eight bars: the latest session starts at index 8,
    // comfortably past the small indicator-warmup floor.
    const bars = [
      ...Array.from({ length: 8 }, (_, i) => bar(`2026-01-15T${String(14 + Math.floor((30 + i * 5) / 60)).padStart(2, "0")}:${String((30 + i * 5) % 60).padStart(2, "0")}:00Z`)),
      ...Array.from({ length: 8 }, (_, i) => bar(`2026-01-16T${String(14 + Math.floor((30 + i * 5) / 60)).padStart(2, "0")}:${String((30 + i * 5) % 60).padStart(2, "0")}:00Z`)),
    ];
    expect(replayStart(bars, "5m")).toBe(8);
    // A single-session window (the 1m tape) floors a few bars in so the
    // indicators have warmup, never past the end.
    const oneSession = bars.slice(8);
    const start = replayStart(oneSession, "1m");
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThan(oneSession.length - 1);
  });

  it("rewinds daily replay a quarter in — never to the final bar", () => {
    const daily = Array.from({ length: 40 }, (_, i) =>
      bar(`2026-0${1 + Math.floor(i / 28)}-${String((i % 28) + 1).padStart(2, "0")}T14:30:00Z`)
    );
    const start = replayStart(daily, "1d");
    expect(start).toBe(10);
    expect(start).toBeLessThan(daily.length - 1); // play-after-finish must have room
    // Tiny daily tapes still leave at least one bar to play.
    expect(replayStart(daily.slice(0, 3), "1d")).toBeLessThan(2);
  });
});
