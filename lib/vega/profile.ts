import { typicalPrice } from "./indicators";
import type { Bar } from "./types";

/**
 * Volume profile — where the day's volume actually traded. Each bar's volume
 * is assigned to the price bin of its typical price ((H+L+C)/3); the point of
 * control (POC) is the heaviest bin and the value area is the standard 70%
 * band grown outward from the POC by repeatedly annexing the heavier
 * neighbor. A model over OHLCV bars, not tick data — honest resolution for a
 * keyless feed, and stated as such in the UI.
 */

export interface ProfileBin {
  /** Bin midpoint price. */
  price: number;
  volume: number;
}

export interface VolumeProfile {
  bins: ProfileBin[];
  binSize: number;
  /** Point of control — the price with the most traded volume. */
  poc: number;
  /** Value-area high/low — the tightest ~70%-of-volume band around the POC. */
  vah: number;
  val: number;
  totalVolume: number;
}

export function volumeProfile(bars: Bar[], binCount = 24): VolumeProfile | null {
  const usable = bars.filter((b) => b.v > 0);
  if (usable.length < 2 || binCount < 2) return null;
  let lo = Infinity;
  let hi = -Infinity;
  for (const b of usable) {
    if (b.l < lo) lo = b.l;
    if (b.h > hi) hi = b.h;
  }
  if (!(hi > lo)) return null;
  const binSize = (hi - lo) / binCount;
  const volumes = new Array<number>(binCount).fill(0);
  let total = 0;
  for (const b of usable) {
    const tp = typicalPrice(b);
    const idx = Math.min(binCount - 1, Math.max(0, Math.floor((tp - lo) / binSize)));
    volumes[idx] += b.v;
    total += b.v;
  }
  if (total <= 0) return null;

  let pocIdx = 0;
  for (let i = 1; i < binCount; i++) if (volumes[i] > volumes[pocIdx]) pocIdx = i;

  // Grow the value area outward from the POC, annexing the heavier neighbor
  // until ≥70% of total volume is covered.
  let loIdx = pocIdx;
  let hiIdx = pocIdx;
  let covered = volumes[pocIdx];
  while (covered < 0.7 * total && (loIdx > 0 || hiIdx < binCount - 1)) {
    const below = loIdx > 0 ? volumes[loIdx - 1] : -1;
    const above = hiIdx < binCount - 1 ? volumes[hiIdx + 1] : -1;
    if (above >= below) {
      hiIdx += 1;
      covered += volumes[hiIdx];
    } else {
      loIdx -= 1;
      covered += volumes[loIdx];
    }
  }

  const mid = (i: number) => lo + (i + 0.5) * binSize;
  return {
    bins: volumes.map((v, i) => ({ price: mid(i), volume: v })),
    binSize,
    poc: mid(pocIdx),
    vah: lo + (hiIdx + 1) * binSize,
    val: lo + loIdx * binSize,
    totalVolume: total,
  };
}
