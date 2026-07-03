import { describe, expect, it } from "vitest";
import {
  activePortfolio,
  addPortfolio,
  makePortfolio,
  migrate,
  removePortfolio,
  renamePortfolio,
  selectPortfolio,
  uniqueName,
  updateActive,
  type PortfolioSet,
} from "./portfolios";
import type { RawHolding } from "./types";

const holding = (symbol: string): RawHolding => ({
  name: symbol,
  symbol,
  shares: 1,
  price: 100,
  averageCost: 90,
  totalReturn: 10,
  equity: 100,
});

const legacy = {
  holdings: [holding("AAPL"), holding("MSFT")],
  cash: 500,
  asOf: "2024-01-01T00:00:00.000Z",
};

describe("migrate", () => {
  it("returns null for empty / non-object input", () => {
    expect(migrate(null)).toBeNull();
    expect(migrate(undefined)).toBeNull();
    expect(migrate("nope")).toBeNull();
    expect(migrate({})).toBeNull();
  });

  it("wraps a legacy single-portfolio blob into a one-entry set", () => {
    const set = migrate(legacy)!;
    expect(set.version).toBe(2);
    expect(set.portfolios).toHaveLength(1);
    const [p] = set.portfolios;
    expect(p.name).toBe("Portfolio");
    expect(p.holdings).toHaveLength(2);
    expect(p.cash).toBe(500);
    expect(set.activeId).toBe(p.id);
  });

  it("names a migrated demo blob 'Demo' and keeps the flag", () => {
    const set = migrate({ ...legacy, isDemo: true })!;
    expect(set.portfolios[0].name).toBe("Demo");
    expect(set.portfolios[0].isDemo).toBe(true);
  });

  it("treats a legacy blob with no holdings as empty", () => {
    expect(migrate({ holdings: [], cash: 0, asOf: "x" })).toBeNull();
  });

  it("passes a valid set through unchanged", () => {
    const original = migrate(legacy)!;
    const round = migrate(original)!;
    expect(round.portfolios).toHaveLength(1);
    expect(round.activeId).toBe(original.activeId);
  });

  it("repairs a set whose activeId points at no member", () => {
    const set: PortfolioSet = {
      version: 2,
      portfolios: [makePortfolio("A")],
      activeId: "ghost",
    };
    const fixed = migrate(set)!;
    expect(fixed.activeId).toBe(fixed.portfolios[0].id);
  });

  it("drops malformed members and nulls an emptied set", () => {
    const set = {
      version: 2,
      portfolios: [{ id: "x", name: "bad" }],
      activeId: "x",
    };
    expect(migrate(set)).toBeNull();
  });
});

describe("mutations", () => {
  it("adds a portfolio and makes it active", () => {
    const a = makePortfolio("Individual");
    const set1 = addPortfolio(null, a);
    expect(set1.activeId).toBe(a.id);
    const b = makePortfolio("Roth IRA");
    const set2 = addPortfolio(set1, b);
    expect(set2.portfolios).toHaveLength(2);
    expect(set2.activeId).toBe(b.id);
    expect(activePortfolio(set2)?.name).toBe("Roth IRA");
  });

  it("updateActive only touches the active portfolio", () => {
    const a = makePortfolio("A");
    const b = makePortfolio("B");
    let set = addPortfolio(addPortfolio(null, a), b); // active = b
    set = updateActive(set, { cash: 999 })!;
    expect(set.portfolios.find((p) => p.id === b.id)?.cash).toBe(999);
    expect(set.portfolios.find((p) => p.id === a.id)?.cash).toBe(0);
  });

  it("selectPortfolio switches active, ignoring unknown ids", () => {
    const a = makePortfolio("A");
    const b = makePortfolio("B");
    let set = addPortfolio(addPortfolio(null, a), b);
    set = selectPortfolio(set, a.id);
    expect(set.activeId).toBe(a.id);
    set = selectPortfolio(set, "nope");
    expect(set.activeId).toBe(a.id);
  });

  it("renamePortfolio trims and ignores blank names", () => {
    const a = makePortfolio("A");
    let set = addPortfolio(null, a);
    set = renamePortfolio(set, a.id, "  Brokerage  ");
    expect(set.portfolios[0].name).toBe("Brokerage");
    set = renamePortfolio(set, a.id, "   ");
    expect(set.portfolios[0].name).toBe("Brokerage");
  });

  it("removePortfolio reassigns active to the prior neighbour", () => {
    const a = makePortfolio("A");
    const b = makePortfolio("B");
    const c = makePortfolio("C");
    let set = addPortfolio(addPortfolio(addPortfolio(null, a), b), c);
    set = selectPortfolio(set, b.id);
    const after = removePortfolio(set, b.id)!;
    expect(after.portfolios).toHaveLength(2);
    expect(after.activeId).toBe(a.id); // neighbour before b
  });

  it("removePortfolio returns null when the last one is deleted", () => {
    const a = makePortfolio("A");
    const set = addPortfolio(null, a);
    expect(removePortfolio(set, a.id)).toBeNull();
  });

  it("removing a non-active portfolio keeps the active one", () => {
    const a = makePortfolio("A");
    const b = makePortfolio("B");
    let set = addPortfolio(addPortfolio(null, a), b); // active = b
    set = removePortfolio(set, a.id)!;
    expect(set.activeId).toBe(b.id);
  });
});

describe("uniqueName", () => {
  it("suffixes duplicates case-insensitively", () => {
    const set = addPortfolio(addPortfolio(null, makePortfolio("Roth IRA")), makePortfolio("Roth IRA (2)"));
    expect(uniqueName(set, "Roth IRA")).toBe("Roth IRA (3)");
    expect(uniqueName(set, "Individual")).toBe("Individual");
    expect(uniqueName(null, "First")).toBe("First");
  });
});
