"use client";

import { relativeTime } from "@/lib/format";

/**
 * The consistent footer chip for any Claude-backed result — model, whether it
 * came from the day cache or was freshly generated, what the call cost, and
 * when. Every AI route already returns `cached` / `costUSD` / `generatedAt`, so
 * this reads as the same honest metadata line on the daily brief, the market
 * read, the allocator, and so on, instead of each page inventing its own.
 */
export function AiMeta({
  model,
  cached,
  costUSD,
  generatedAt,
  className = "",
}: {
  model?: string;
  cached?: boolean;
  costUSD?: number | null;
  generatedAt?: string;
  className?: string;
}) {
  const cost =
    costUSD != null && costUSD > 0
      ? `$${costUSD < 0.01 ? costUSD.toFixed(4) : costUSD.toFixed(2)}`
      : null;
  const parts: string[] = [];
  if (model) parts.push(model);
  parts.push(cached ? "cached" : "fresh");
  if (cost) parts.push(cost);
  if (generatedAt) parts.push(relativeTime(generatedAt));

  return (
    <div
      className={`flex items-center gap-1.5 font-mono text-[10px] text-faint ${className}`}
    >
      <span
        className="h-1 w-1 shrink-0 rounded-full"
        style={{ background: cached ? "var(--color-mute)" : "var(--color-mint)" }}
      />
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-edge2">·</span>}
          {p}
        </span>
      ))}
    </div>
  );
}
