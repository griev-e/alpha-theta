// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ResizeObserver-backed width isn't observable in jsdom, so pin a fixed width;
// this lets us assert the scale/path geometry directly instead of the layout.
vi.mock("@/lib/useElementWidth", () => ({
  useElementWidth: () => [{ current: null }, 200],
}));

import { Sparkline } from "./Sparkline";

afterEach(cleanup);

describe("Sparkline", () => {
  it("renders nothing chart-like with fewer than two points", () => {
    render(<Sparkline values={[5]} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("draws a line path spanning the full width for a real series", () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} height={64} />);
    const svg = screen.getByRole("img");
    expect(svg).toHaveAttribute("width", "200");
    expect(svg).toHaveAttribute("height", "64");

    const paths = container.querySelectorAll("path");
    // Two paths: the filled area and the line stroke.
    expect(paths.length).toBe(2);
    const line = paths[1].getAttribute("d")!;
    // First point pinned to x=0, last point pinned to x=width (200).
    expect(line.startsWith("M0.0 ")).toBe(true);
    expect(line).toContain("L200.0 ");
  });

  it("draws a dashed baseline reference when `baseline` is set", () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} baseline={0} />);
    const baseline = container.querySelector("line");
    expect(baseline).not.toBeNull();
    expect(baseline).toHaveAttribute("stroke-dasharray");
  });

  it("uses belowColor when the latest value is under the baseline", () => {
    const { container } = render(
      <Sparkline values={[5, 4, -1]} baseline={0} color="green" belowColor="red" />
    );
    const line = container.querySelectorAll("path")[1];
    expect(line).toHaveAttribute("stroke", "red");
  });
});
