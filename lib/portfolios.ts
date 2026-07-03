/**
 * Multi-portfolio state — the persisted alpha book is a *set* of named
 * portfolios (individual account, Roth IRA, …) plus which one is active,
 * rather than a single portfolio. This module holds the pure shape + the
 * migration/mutation helpers; the store (`lib/store.tsx`) owns the React glue.
 *
 * The whole set persists as one opaque blob — localStorage in open mode, the
 * `user_state.portfolio` JSONB column in server mode — so per-user isolation
 * and the compare-and-swap save layer are unchanged: the server never looks
 * inside. Legacy single-portfolio blobs (`{ holdings, cash, asOf, isDemo? }`)
 * are migrated on first read into a one-entry set, so nobody loses their book.
 */
import type { RawHolding } from "./types";

/** One named portfolio. Superset of the legacy single-portfolio shape. */
export interface NamedPortfolio {
  id: string;
  name: string;
  holdings: RawHolding[];
  cash: number;
  asOf: string;
  isDemo?: boolean;
}

/** The persisted alpha state: a set of portfolios + which one is selected. */
export interface PortfolioSet {
  version: 2;
  portfolios: NamedPortfolio[];
  /** id of the active portfolio; null only when `portfolios` is empty. */
  activeId: string | null;
}

/** Legacy pre-multi persisted shape, migrated on read. */
interface LegacyStored {
  holdings: RawHolding[];
  cash: number;
  asOf: string;
  isDemo?: boolean;
}

const DEFAULT_NAME = "Portfolio";

/** UUID with a crypto-less fallback (older jsdom / test envs). */
export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

const isLegacy = (v: Record<string, unknown>): boolean => Array.isArray(v.holdings);
const isSet = (v: Record<string, unknown>): boolean => Array.isArray(v.portfolios);

/**
 * Normalize whatever we read from storage into a `PortfolioSet` (or null when
 * there's nothing). Accepts the current set shape, the legacy single-portfolio
 * blob, and defends against a corrupt `activeId` that points at no member.
 */
export function migrate(raw: unknown): PortfolioSet | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (isSet(obj)) {
    const portfolios = ((obj.portfolios as unknown[]) ?? []).filter(
      (p): p is NamedPortfolio =>
        !!p && typeof p === "object" && Array.isArray((p as NamedPortfolio).holdings)
    );
    if (portfolios.length === 0) return null;
    const activeId =
      typeof obj.activeId === "string" &&
      portfolios.some((p) => p.id === obj.activeId)
        ? (obj.activeId as string)
        : portfolios[0].id;
    return { version: 2, portfolios, activeId };
  }

  if (isLegacy(obj)) {
    const legacy = obj as unknown as LegacyStored;
    if (legacy.holdings.length === 0) return null;
    const p: NamedPortfolio = {
      id: newId(),
      name: obj.isDemo ? "Demo" : DEFAULT_NAME,
      holdings: legacy.holdings,
      cash: typeof obj.cash === "number" ? obj.cash : 0,
      asOf: typeof obj.asOf === "string" ? obj.asOf : new Date().toISOString(),
      isDemo: obj.isDemo === true ? true : undefined,
    };
    return { version: 2, portfolios: [p], activeId: p.id };
  }

  return null;
}

/** The active portfolio, or null when the set is empty. */
export function activePortfolio(set: PortfolioSet | null): NamedPortfolio | null {
  if (!set) return null;
  return set.portfolios.find((p) => p.id === set.activeId) ?? null;
}

/** A fresh, empty named portfolio. */
export function makePortfolio(name: string): NamedPortfolio {
  return {
    id: newId(),
    name: name.trim() || DEFAULT_NAME,
    holdings: [],
    cash: 0,
    asOf: new Date().toISOString(),
  };
}

/** Ensure a name is unique within the set by suffixing " (2)", " (3)", … */
export function uniqueName(set: PortfolioSet | null, base: string): string {
  const name = base.trim() || DEFAULT_NAME;
  const existing = new Set((set?.portfolios ?? []).map((p) => p.name.toLowerCase()));
  if (!existing.has(name.toLowerCase())) return name;
  for (let n = 2; ; n++) {
    const candidate = `${name} (${n})`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }
}

/** Add a portfolio to the set and make it active. */
export function addPortfolio(
  set: PortfolioSet | null,
  portfolio: NamedPortfolio
): PortfolioSet {
  const portfolios = [...(set?.portfolios ?? []), portfolio];
  return { version: 2, portfolios, activeId: portfolio.id };
}

/** Replace the active portfolio's contents (import / cash edit / demo). */
export function updateActive(
  set: PortfolioSet | null,
  patch: Partial<Omit<NamedPortfolio, "id">>
): PortfolioSet | null {
  if (!set || set.activeId === null) return set;
  const portfolios = set.portfolios.map((p) =>
    p.id === set.activeId ? { ...p, ...patch } : p
  );
  return { ...set, portfolios };
}

/** Rename one portfolio. */
export function renamePortfolio(
  set: PortfolioSet,
  id: string,
  name: string
): PortfolioSet {
  const clean = name.trim();
  if (!clean) return set;
  return {
    ...set,
    portfolios: set.portfolios.map((p) => (p.id === id ? { ...p, name: clean } : p)),
  };
}

/** Switch the active portfolio (no-op if the id isn't in the set). */
export function selectPortfolio(set: PortfolioSet, id: string): PortfolioSet {
  if (!set.portfolios.some((p) => p.id === id)) return set;
  return { ...set, activeId: id };
}

/**
 * Remove a portfolio. If it was active, the neighbour before it becomes active
 * (or the first remaining one). Returns null when the last portfolio is gone.
 */
export function removePortfolio(set: PortfolioSet, id: string): PortfolioSet | null {
  const idx = set.portfolios.findIndex((p) => p.id === id);
  if (idx === -1) return set;
  const portfolios = set.portfolios.filter((p) => p.id !== id);
  if (portfolios.length === 0) return null;
  let activeId = set.activeId;
  if (activeId === id) {
    activeId = portfolios[Math.max(0, idx - 1)].id;
  }
  return { ...set, portfolios, activeId };
}
