import { describe, expect, it } from "vitest";
import { armedAlerts, firedAlerts, pricesFromQuotes, sweepAlerts } from "./alerts";
import type { PriceAlert, VegaQuote } from "./types";

const alert = (over: Partial<PriceAlert> = {}): PriceAlert => ({
  id: "a1",
  symbol: "NVDA",
  price: 100,
  dir: "above",
  createdAt: "2026-01-16T14:00:00.000Z",
  firedAt: null,
  ...over,
});

const NOW = "2026-01-16T15:00:00.000Z";

describe("sweepAlerts", () => {
  it("fires an above-alert only on a true upward cross", () => {
    const a = alert();
    // Below → below: nothing.
    expect(sweepAlerts([a], { NVDA: 98 }, { NVDA: 99 }, NOW).fired).toHaveLength(0);
    // Below → at the level: fires.
    const hit = sweepAlerts([a], { NVDA: 99 }, { NVDA: 100 }, NOW);
    expect(hit.fired).toHaveLength(1);
    expect(hit.next[0].firedAt).toBe(NOW);
    // Already above → higher: does NOT fire (no cross).
    expect(sweepAlerts([a], { NVDA: 101 }, { NVDA: 105 }, NOW).fired).toHaveLength(0);
  });

  it("mirrors for below-alerts", () => {
    const a = alert({ dir: "below", price: 90 });
    expect(sweepAlerts([a], { NVDA: 91 }, { NVDA: 89.5 }, NOW).fired).toHaveLength(1);
    expect(sweepAlerts([a], { NVDA: 89 }, { NVDA: 88 }, NOW).fired).toHaveLength(0);
    expect(sweepAlerts([a], { NVDA: 92 }, { NVDA: 91 }, NOW).fired).toHaveLength(0);
  });

  it("never re-fires and skips symbols with missing prices", () => {
    const done = alert({ firedAt: "2026-01-16T14:30:00.000Z" });
    const r = sweepAlerts([done], { NVDA: 99 }, { NVDA: 101 }, NOW);
    expect(r.fired).toHaveLength(0);
    expect(r.next[0].firedAt).toBe("2026-01-16T14:30:00.000Z");
    // No previous snapshot yet (first poll) — a reload can't fire it.
    expect(sweepAlerts([alert()], {}, { NVDA: 101 }, NOW).fired).toHaveLength(0);
    // Returns the SAME array when nothing changed (no pointless persists).
    const list = [alert()];
    expect(sweepAlerts(list, { NVDA: 98 }, { NVDA: 99 }, NOW).next).toBe(list);
  });

  it("sweeps multiple alerts independently", () => {
    const list = [
      alert({ id: "a1", price: 100, dir: "above" }),
      alert({ id: "a2", price: 95, dir: "below" }),
      alert({ id: "a3", symbol: "TSLA", price: 200, dir: "above" }),
    ];
    const r = sweepAlerts(list, { NVDA: 99, TSLA: 199 }, { NVDA: 100.5, TSLA: 201 }, NOW);
    expect(r.fired.map((a) => a.id).sort()).toEqual(["a1", "a3"]);
    expect(r.next.find((a) => a.id === "a2")!.firedAt).toBeNull();
  });
});

describe("alert lists", () => {
  it("splits armed vs fired and sorts usefully", () => {
    const list = [
      alert({ id: "f1", firedAt: "2026-01-16T14:10:00.000Z" }),
      alert({ id: "f2", firedAt: "2026-01-16T14:50:00.000Z" }),
      alert({ id: "b", symbol: "AAPL", price: 150 }),
      alert({ id: "a", symbol: "AAPL", price: 120 }),
    ];
    expect(armedAlerts(list).map((a) => a.id)).toEqual(["a", "b"]);
    expect(armedAlerts(list, "NVDA")).toHaveLength(0);
    expect(firedAlerts(list).map((a) => a.id)).toEqual(["f2", "f1"]);
  });

  it("pricesFromQuotes keeps only finite positive prices", () => {
    const q = (price: number): VegaQuote => ({
      symbol: "X",
      name: null,
      price,
      regularPrice: price,
      prevClose: null,
      open: null,
      dayHigh: null,
      dayLow: null,
      volume: null,
      avgVolume10d: null,
      avgVolume3m: null,
      marketState: "REGULAR",
      changePct: null,
      high52w: null,
      low52w: null,
      asOf: NOW,
    });
    expect(pricesFromQuotes({ A: q(10), B: q(0), C: q(NaN) })).toEqual({ A: 10 });
  });
});
