/**
 * Shared contract for the Market Analysis page's AI read (`/api/market-brief`).
 * Pure types — safe to import from client components. The regime engine already
 * computes the numbers; this is a reasoning pass that synthesizes them into a
 * plain-language market read.
 */

import type {
  ConsensusLabel,
  DirectionLabel,
  RegimeLabel,
} from "@/lib/analytics/regime/types";

export interface MarketBriefLayer {
  name: string;
  /** -1 … +1, or null when the layer had no computable signals. */
  score: number | null;
  weight: number;
  summary: string;
}

export interface MarketBriefFactor {
  label: string;
  detail: string;
}

/** The compact regime snapshot the client POSTs to `/api/market-brief`. */
export interface MarketBriefRequest {
  snapshot: {
    asOf: string;
    regime: RegimeLabel;
    /** -1 … +1 composite. */
    score: number;
    /** 0–100. */
    confidence: number;
    consensus: ConsensusLabel;
    /** 0–100 internal health. */
    health: number;
    direction: DirectionLabel;
    directionSlope: number;
    maturityDays: number;
    persistence: number;
    layers: MarketBriefLayer[];
    bullish: MarketBriefFactor[];
    bearish: MarketBriefFactor[];
    shifts: MarketBriefFactor[];
    risks: string[];
    opportunities: string[];
  };
}

export interface MarketBrief {
  /** One crisp line capturing the tape's character. */
  headline: string;
  /** 3–4 sentence synthesis of the regime, health, and what's driving it. */
  read: string;
  /** What this posture implies for risk-taking — observations, not advice. */
  positioning: string[];
  /** Forward-looking things to watch that could confirm or break the regime. */
  watchItems: string[];
  /** The strongest counter-signal — what would flip the current read. */
  contrarian: string;
}

export interface MarketBriefResponse {
  brief: MarketBrief;
  generatedAt: string;
  cached: boolean;
  costUSD: number | null;
}
