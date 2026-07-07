import { describe, expect, it } from "vitest";
import { parseMoneyInput } from "./parseMoney";

describe("parseMoneyInput", () => {
  it("parses plain numbers, $, and commas", () => {
    expect(parseMoneyInput("5000")).toBe(5000);
    expect(parseMoneyInput("$5,000")).toBe(5000);
    expect(parseMoneyInput("  1200.50 ")).toBe(1200.5);
  });

  it("applies k / m magnitude suffixes", () => {
    expect(parseMoneyInput("5k")).toBe(5000);
    expect(parseMoneyInput("1.2m")).toBe(1_200_000);
    expect(parseMoneyInput("$2.5K")).toBe(2500);
  });

  it("returns null for non-amounts", () => {
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("5 dollars")).toBeNull();
    expect(parseMoneyInput("5kk")).toBeNull();
  });

  it("keeps a negative sign", () => {
    expect(parseMoneyInput("-40")).toBe(-40);
  });
});
