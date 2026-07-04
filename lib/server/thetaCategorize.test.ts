import { describe, expect, it } from "vitest";
import { chunkItems } from "./thetaCategorize";

describe("chunkItems", () => {
  it("splits a batch into fixed-size chunks, last one short", () => {
    const items = Array.from({ length: 95 }, (_, i) => i);
    const chunks = chunkItems(items, 40);
    expect(chunks.map((c) => c.length)).toEqual([40, 40, 15]);
    // Chunking is lossless and order-preserving.
    expect(chunks.flat()).toEqual(items);
  });

  it("returns a single chunk when the batch fits", () => {
    expect(chunkItems([1, 2, 3], 40)).toEqual([[1, 2, 3]]);
  });

  it("handles an empty batch and never loops forever on size 0", () => {
    expect(chunkItems([], 40)).toEqual([]);
    // A degenerate size must not hang; it's clamped to at least 1.
    expect(chunkItems([1, 2], 0)).toEqual([[1], [2]]);
  });
});
