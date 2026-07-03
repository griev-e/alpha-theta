/** Shared (client + server) types for theta's AI money brief. */

import type { Category } from "./data";

export type ThetaSnapshot = {
  month: string;
  netWorth: number;
  netWorthDeltaPct: number; // already in %
  income: number;
  expenses: number;
  savingsRate: number; // already in %
  monthlyRecurring: number;
  topCategories: { category: string; amount: number }[];
  budgets: { category: string; limit: number; spent: number }[];
  goals: { name: string; saved: number; target: number; monthly: number }[];
  upcomingRecurring: { name: string; amount: number; nextDate: string }[];
};

export type ThetaBriefRequest = { snapshot: ThetaSnapshot };

export type ThetaBrief = {
  headline: string;
  summary: string;
  wins: string[];
  watchOuts: string[];
  moves: { title: string; detail: string }[];
  goalNote: string;
};

export type ThetaBriefResponse = {
  brief: ThetaBrief;
  generatedAt: string;
  cached: boolean;
  costUSD: number | null;
};

// ── AI transaction categorizer ───────────────────────────────────────────────
// Batch merchant → category inference. Improves on the 41-line substring table
// in lib/theta/categorize.ts by asking a fast model to place merchants it can't
// match. Server-side uses Haiku 4.5 with an enum-constrained JSON schema.

export type CategorizeItem = { merchant: string; amount: number };
export type CategorizeRequest = { items: CategorizeItem[] };
export type CategorizeResult = { merchant: string; category: Category };
export type CategorizeResponse = {
  results: CategorizeResult[];
  cached: boolean;
  costUSD: number | null;
};

// ── AI money review ──────────────────────────────────────────────────────────
// A reasoning pass over the *new* analytics surface (health scorecard, spending
// anomalies, detected subscriptions) — distinct from the monthly narrative brief.
// Server-side uses Sonnet 4.6 with adaptive thinking.

export type ThetaReviewRequest = {
  snapshot: ThetaSnapshot;
  health: { composite: number; grade: string; flags: string[] };
  anomalies: { category: string; note: string }[];
  newSubscriptions: { merchant: string; amount: number; annualCost: number }[];
};

export type ThetaReview = {
  assessment: string;
  priorities: { title: string; detail: string; impact: "high" | "medium" | "low" }[];
  subscriptionNote: string;
};

export type ThetaReviewResponse = {
  review: ThetaReview;
  generatedAt: string;
  cached: boolean;
  costUSD: number | null;
};
