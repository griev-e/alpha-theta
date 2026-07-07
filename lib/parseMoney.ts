/**
 * Parse a loose money string typed into the command palette (§123) into a
 * number: tolerant of a leading `$`, thousands commas, surrounding spaces, and
 * a `k`/`m` magnitude suffix ("5k" → 5000, "1.2m" → 1_200_000). Returns `null`
 * for anything that isn't a clean amount, so a verb only fires on real input.
 */
export function parseMoneyInput(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (!s) return null;
  const m = s.match(/^(-?\d+(?:\.\d+)?)([km])?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  if (m[2] === "k") return n * 1_000;
  if (m[2] === "m") return n * 1_000_000;
  return n;
}
