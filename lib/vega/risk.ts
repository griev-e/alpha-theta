import { dailyPnl } from "./journal";
import type { Trade, TradeSide, VegaSettings } from "./types";

/**
 * Risk manager math — position sizing off the planned stop, Kelly sizing off
 * the journal's realized edge, and the daily-loss circuit breaker. All pure;
 * "today" is an explicit input.
 */

export interface SizingInput {
  accountSize: number;
  /** Risk per trade as a % of account (1 = 1%). */
  riskPct: number;
  side: TradeSide;
  entry: number;
  stop: number;
  target?: number;
}

export interface Sizing {
  /** False when the inputs don't make a tradable plan (stop on the wrong side…). */
  valid: boolean;
  reason?: string;
  shares: number;
  notional: number;
  riskDollars: number;
  /** Per-share risk (entry↔stop distance). */
  perShareRisk: number;
  stopPct: number;
  /** Reward:risk to the target, when one is set. */
  rr: number | null;
  /** Price ladder at +1R/+2R/+3R for scaling out. */
  rTargets: { r: number; price: number }[];
}

export function positionSize(input: SizingInput): Sizing {
  const { accountSize, riskPct, side, entry, stop, target } = input;
  const dir = side === "long" ? 1 : -1;
  const invalid = (reason: string): Sizing => ({
    valid: false,
    reason,
    shares: 0,
    notional: 0,
    riskDollars: 0,
    perShareRisk: 0,
    stopPct: 0,
    rr: null,
    rTargets: [],
  });
  if (!(accountSize > 0) || !(riskPct > 0)) return invalid("Set an account size and risk %");
  if (!(entry > 0) || !(stop > 0)) return invalid("Enter an entry and a stop");
  const perShareRisk = (entry - stop) * dir;
  if (perShareRisk <= 0)
    return invalid(side === "long" ? "Stop must sit below entry" : "Stop must sit above entry");
  const riskDollars = accountSize * (riskPct / 100);
  const shares = Math.floor(riskDollars / perShareRisk);
  if (shares < 1) return invalid("Risk budget doesn't cover one share at this stop");
  const rr =
    target !== undefined && target > 0 && (target - entry) * dir > 0
      ? ((target - entry) * dir) / perShareRisk
      : null;
  return {
    valid: true,
    shares,
    notional: shares * entry,
    riskDollars: shares * perShareRisk,
    perShareRisk,
    stopPct: perShareRisk / entry,
    rr,
    rTargets: [1, 2, 3].map((r) => ({ r, price: entry + dir * r * perShareRisk })),
  };
}

/**
 * Kelly fraction from realized stats: f* = W − (1−W)/(avgWin/avgLoss).
 * Clamped at 0 (a negative edge means "don't bet"); callers should present
 * half-Kelly — full Kelly is famously over-aggressive for noisy estimates.
 */
export function kellyFraction(
  winRate: number,
  avgWin: number | null,
  avgLoss: number | null
): number | null {
  if (avgWin === null || avgLoss === null || avgLoss >= 0 || avgWin <= 0) return null;
  const payoff = avgWin / -avgLoss;
  if (!(payoff > 0)) return null;
  const f = winRate - (1 - winRate) / payoff;
  return Number.isFinite(f) ? Math.max(0, f) : null;
}

export interface DayRisk {
  /** Realized P&L on `todayKey` (closed trades only). */
  realized: number;
  /** The dollar loss limit implied by settings. */
  limit: number;
  /** How much of the limit is consumed, 0..1 (0 while green). */
  used: number;
  /** Dollars of drawdown left before the limit. */
  remaining: number;
  /** True once today's realized loss has hit the limit — stop trading. */
  halted: boolean;
}

/** Daily-loss circuit breaker state for a given calendar day ("YYYY-MM-DD"). */
export function dayRisk(
  trades: Trade[],
  settings: VegaSettings,
  todayKey: string
): DayRisk {
  const realized = dailyPnl(trades).get(todayKey) ?? 0;
  const limit = settings.accountSize * (settings.dailyLossPct / 100);
  const loss = Math.max(0, -realized);
  const used = limit > 0 ? Math.min(1, loss / limit) : 0;
  return {
    realized,
    limit,
    used,
    remaining: Math.max(0, limit - loss),
    halted: limit > 0 && loss >= limit,
  };
}
