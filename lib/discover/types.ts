/**
 * Shared client/server types for the AI Discover screen.
 *
 * The client builds a compact snapshot of the in-browser portfolio (holdings
 * never persist server-side) plus a chosen research "mode", and POSTs it to
 * `/api/discover`. Claude returns a structured set of *new* ideas — tickers the
 * investor doesn't own — tailored to both the directive and this specific book.
 */

export type Conviction = "high" | "medium" | "low";

/** The preset research lenses surfaced as buttons. id is sent to the model. */
export const DISCOVER_MODES = [
  {
    id: "diversify",
    label: "Diversify",
    tagline: "Fill the gaps in your book",
  },
  {
    id: "growth",
    label: "High Growth",
    tagline: "Secular compounders",
  },
  {
    id: "value",
    label: "Value & Income",
    tagline: "Cheap and cash-generative",
  },
  {
    id: "defensive",
    label: "Defensive Hedge",
    tagline: "Lower the book's risk",
  },
  {
    id: "quality",
    label: "Quality Moats",
    tagline: "Durable high-ROIC franchises",
  },
  {
    id: "thematic",
    label: "Megatrends",
    tagline: "Thematic frontier bets",
  },
] as const;

export type DiscoverModeId = (typeof DISCOVER_MODES)[number]["id"];

export const DISCOVER_MODE_IDS = DISCOVER_MODES.map((m) => m.id) as DiscoverModeId[];

/** Compact per-position snapshot sent to the model (mirrors the allocator's). */
export interface DiscoverPosition {
  symbol: string;
  name: string;
  weight: number; // of total portfolio incl. cash, decimal
  sector: string | null;
  forwardPE: number | null;
  dividendYield: number | null;
  roic: number | null;
  revenueGrowth: number | null;
  beta: number | null;
  volatility: number | null;
}

export interface DiscoverRequest {
  mode: DiscoverModeId;
  portfolio: {
    totalValue: number;
    cashWeightPct: number;
    /** Book-level risk/return context so the model reasons about real gaps. */
    metrics: {
      expectedReturnPct: number;
      volatilityPct: number;
      sharpe: number;
      beta: number;
      effectiveHoldings: number;
    };
    /** Sorted by weight desc; the client caps this. */
    positions: DiscoverPosition[];
  };
}

/** A single compact metric the model attaches to an idea (approximate). */
export interface IdeaMetric {
  label: string;
  value: string;
}

/** One suggested new holding. */
export interface DiscoverIdea {
  symbol: string;
  name: string;
  sector: string;
  conviction: Conviction;
  /** The standalone case for the name. */
  thesis: string;
  /** How it interacts with the existing book — what it adds or hedges. */
  fit: string;
  /** 2-4 decision-relevant, approximate figures. */
  metrics: IdeaMetric[];
  /** The single sharpest risk. */
  risk: string;
}

/** A structural hole in the current book the directive addresses. */
export interface DiscoverGap {
  title: string;
  detail: string;
}

/** The structured research output returned by the model. */
export interface DiscoverPlan {
  /** Overall read tying the directive to this book. */
  read: string;
  ideas: DiscoverIdea[];
  gaps: DiscoverGap[];
}

export interface DiscoverResponse {
  plan: DiscoverPlan;
  mode: DiscoverModeId;
  generatedAt: string;
  cached: boolean;
  costUSD?: number | null;
}
