import type { FundamentalsPatch } from "@/lib/live/types";
import type { Region } from "@/lib/types";

/**
 * Optional Financial Modeling Prep enrichment (server-only).
 *
 * Yahoo's keyless feed is the primary source; FMP fills the three fields Yahoo
 * can't cleanly provide: **ROIC**, **FCF growth**, and **revenue-by-region mix**.
 * Gated on `FMP_API_KEY` — with no key the whole module is a no-op and the app
 * runs on Yahoo alone (graceful degradation preserved).
 *
 * Kept deliberately to three endpoints per symbol to respect the free tier's
 * 250-requests/day budget; results are cached for 12h alongside the Yahoo
 * fundamentals.
 */

const BASE = "https://financialmodelingprep.com/api";

export const fmpEnabled = (): boolean => !!process.env.FMP_API_KEY;

const cache = new Map<string, { at: number; data: FmpPatch | null }>();
const TTL = 12 * 3600_000;

/** The subset FMP contributes — merged over the Yahoo patch by the orchestrator. */
export type FmpPatch = Pick<FundamentalsPatch, "roic" | "fcfGrowth" | "regions">;

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

async function getJson(path: string): Promise<unknown | null> {
  const key = process.env.FMP_API_KEY;
  if (!key) return null;
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}apikey=${key}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const first = (v: unknown): Record<string, unknown> | null =>
  Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null
    ? (v[0] as Record<string, unknown>)
    : null;

/**
 * Map an FMP geography label to one of our four region buckets. Specific
 * emerging / Europe / Asia labels are matched before the broad US catch so
 * "Latin America" (which contains "america") isn't misread as US.
 */
export function classifyRegion(label: string): Region {
  const s = label.toLowerCase();
  if (/(latin|south america|central america|brazil|mexico|middle east|africa|india|emerging|developing)/.test(s))
    return "Emerging";
  if (/(europe|emea|eurozone|united kingdom|\buk\b|germany|france|italy|spain|nordic|switzerland|netherlands)/.test(s))
    return "Europe";
  if (/(asia|pacific|china|japan|taiwan|korea|hong kong|singapore|australia|apac)/.test(s))
    return "Asia-Pacific";
  if (/(united states|u\.s|^u s$|^us\b|\bus\b|usa|north america|americas|domestic)/.test(s))
    return "US";
  return "Emerging"; // "rest of world", unclassified
}

/** Collapse an FMP flat segmentation record into a normalized region mix. */
export function regionsFromSegmentation(
  record: Record<string, unknown>
): Partial<Record<Region, number>> | undefined {
  const buckets: Partial<Record<Region, number>> = {};
  let total = 0;
  for (const [label, raw] of Object.entries(record)) {
    const v = num(raw);
    if (!v || v <= 0) continue;
    const region = classifyRegion(label);
    buckets[region] = (buckets[region] ?? 0) + v;
    total += v;
  }
  if (total <= 0) return undefined;
  for (const k of Object.keys(buckets) as Region[]) buckets[k] = buckets[k]! / total;
  return buckets;
}

/** ROIC, FCF growth and region mix for one symbol — null when FMP is disabled or fails. */
export async function fetchFmpPatch(symbol: string): Promise<FmpPatch | null> {
  if (!fmpEnabled()) return null;
  const now = Date.now();
  const hit = cache.get(symbol);
  if (hit && now - hit.at < TTL) return hit.data;

  const [metrics, growth, geo] = await Promise.all([
    getJson(`/v3/key-metrics-ttm/${symbol}`),
    getJson(`/v3/financial-growth/${symbol}?period=annual&limit=1`),
    getJson(`/v4/revenue-geographic-segmentation?symbol=${symbol}&structure=flat&period=annual`),
  ]);

  const roic = num(first(metrics)?.roicTTM ?? first(metrics)?.returnOnInvestedCapitalTTM);
  const fcfGrowth = num(first(growth)?.freeCashFlowGrowth);

  // Geographic segmentation: [{ "2023-12-31": { "United States": 1234, ... } }].
  let regions: FmpPatch["regions"];
  const geoEntry = first(geo);
  if (geoEntry) {
    const period = Object.values(geoEntry)[0];
    if (period && typeof period === "object")
      regions = regionsFromSegmentation(period as Record<string, unknown>);
  }

  const patch: FmpPatch | null =
    roic !== undefined || fcfGrowth !== undefined || regions
      ? { roic, fcfGrowth, regions }
      : null;

  cache.set(symbol, { at: now, data: patch });
  return patch;
}
