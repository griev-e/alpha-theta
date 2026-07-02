// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Delta, deltaToneClass } from "./Delta";

/**
 * A pure presentational primitive: renders the formatted value and colors it by
 * sign (positive / negative / flat). No DOM APIs beyond render — the smallest
 * proof that the jsdom + Testing Library wiring works end to end.
 */
afterEach(cleanup);

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

describe("Delta", () => {
  it("renders the value through the provided formatter", () => {
    render(<Delta value={0.042} format={pct} />);
    expect(screen.getByText("4.2%")).toBeInTheDocument();
  });

  it("applies the positive tone class for a gain", () => {
    render(<Delta value={0.05} format={pct} />);
    expect(screen.getByText("5.0%")).toHaveClass("text-pos");
  });

  it("applies the negative tone class for a loss", () => {
    render(<Delta value={-0.05} format={pct} />);
    expect(screen.getByText("-5.0%")).toHaveClass("text-neg");
  });

  it("treats zero as flat and forwards a custom className", () => {
    render(<Delta value={0} format={pct} className="ml-2" />);
    const el = screen.getByText("0.0%");
    expect(el).toHaveClass("text-mute");
    expect(el).toHaveClass("ml-2");
  });

  it("deltaToneClass maps sign to the same tone classes", () => {
    expect(deltaToneClass(1)).toBe("text-pos");
    expect(deltaToneClass(-1)).toBe("text-neg");
    expect(deltaToneClass(0)).toBe("text-mute");
  });
});
