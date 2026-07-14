"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Meter } from "@/components/ui/Meter";
import { Segmented } from "@/components/ui/Segmented";
import { fmtNum, fmtUSD } from "@/lib/format";
import { PositionsCard } from "@/components/vega/PositionsCard";
import { journalStats, localDayKey } from "@/lib/vega/journal";
import { markOpenBook, openTrades } from "@/lib/vega/positions";
import { dayRisk, kellyFraction, positionSize } from "@/lib/vega/risk";
import { useVega } from "@/lib/vega/store";
import type { TradeSide } from "@/lib/vega/types";
import { useVegaQuotes } from "@/lib/vega/useVegaQuotes";

const parse = (s: string): number | undefined => {
  const v = Number(s.replace(/[$,%\s]/g, ""));
  return Number.isFinite(v) && v > 0 ? v : undefined;
};

/**
 * The risk manager — size every trade off the stop before caring about the
 * ticker, and stop trading when the day hits its loss budget. The two rules
 * that keep a day trader alive, wired to the journal.
 */
export default function RiskPage() {
  const { state, ready, setSettings } = useVega();
  const { settings } = state;

  const [side, setSide] = useState<TradeSide>("long");
  const [entry, setEntry] = useState("100.00");
  const [stop, setStop] = useState("99.00");
  const [target, setTarget] = useState("");

  const sizing = useMemo(() => {
    const e = parse(entry);
    const s = parse(stop);
    if (e === undefined || s === undefined) return null;
    return positionSize({
      accountSize: settings.accountSize,
      riskPct: settings.riskPct,
      side,
      entry: e,
      stop: s,
      target: parse(target),
    });
  }, [entry, stop, target, side, settings]);

  const today = new Date();
  const todayKey = localDayKey(today.toISOString());
  const risk = dayRisk(state.trades, settings, todayKey);
  const stats = useMemo(() => journalStats(state.trades), [state.trades]);
  const kelly = stats ? kellyFraction(stats.winRate, stats.avgWin, stats.avgLoss) : null;

  // The working book, marked live — what's at risk beyond the next trade.
  const openSymbols = useMemo(
    () => [...new Set(openTrades(state.trades).map((t) => t.symbol))],
    [state.trades]
  );
  const { quotes } = useVegaQuotes(ready ? openSymbols : []);
  const book = useMemo(() => markOpenBook(state.trades, quotes), [state.trades, quotes]);

  const settingField = (
    label: string,
    key: "accountSize" | "riskPct" | "dailyLossPct" | "orMinutes",
    suffix: string
  ) => (
    <label className="block">
      <span className="eyebrow mb-1 block">{label}</span>
      <div className="flex items-center gap-2">
        <input
          defaultValue={String(settings[key])}
          key={`${key}:${settings[key]}`}
          onBlur={(e) => {
            const v = parse(e.target.value);
            if (v !== undefined) setSettings({ [key]: v });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          inputMode="decimal"
          className="field h-8"
          aria-label={label}
        />
        <span className="font-mono text-[11px] text-faint">{suffix}</span>
      </div>
    </label>
  );

  return (
    <>
      <PageHeader
        eyebrow="Performance"
        title="Risk"
        description="Size off the stop, respect the daily budget — the two rules the rest of the terminal assumes."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Position sizer */}
        <Card i={0} className="p-5 lg:col-span-2">
          <CardHeader
            eyebrow="Position sizing"
            title="The sizer"
            right={
              <Segmented
                value={side}
                onChange={setSide}
                options={[
                  { value: "long", label: "Long" },
                  { value: "short", label: "Short" },
                ]}
              />
            }
          />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              ["Entry", entry, setEntry],
              ["Stop", stop, setStop],
              ["Target (optional)", target, setTarget],
            ].map(([label, value, set]) => (
              <label key={label as string} className="block">
                <span className="eyebrow mb-1 block">{label as string}</span>
                <input
                  value={value as string}
                  onChange={(e) => (set as (v: string) => void)(e.target.value)}
                  inputMode="decimal"
                  className="field h-8"
                />
              </label>
            ))}
          </div>

          {risk.halted && (
            <div className="panel-tinted neg mt-4 px-3 py-2 text-[12px] text-neg">
              The daily circuit breaker is hit — the right size for the next trade is zero.
            </div>
          )}

          {sizing === null || !sizing.valid ? (
            <p className="mt-5 text-[13px] text-mute">
              {sizing?.reason ?? "Enter an entry and a stop to size the trade."}
            </p>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  ["Shares", String(sizing.shares), "text-ink"],
                  ["Notional", fmtUSD(sizing.notional, true), "text-ink"],
                  ["Risk", fmtUSD(sizing.riskDollars), "text-neg"],
                  ["Stop distance", `${fmtNum(sizing.stopPct * 100, 2)}%`, "text-mute"],
                ].map(([label, value, cls]) => (
                  <div key={label}>
                    <div className="eyebrow">{label}</div>
                    <div className={`mt-0.5 font-mono tnum text-[19px] ${cls}`}>{value}</div>
                  </div>
                ))}
              </div>
              {sizing.notional > settings.accountSize && (
                <p className="mt-3 text-[11.5px] leading-relaxed text-warn">
                  Heads up — this size is {fmtNum(sizing.notional / settings.accountSize, 1)}× the
                  account. The stop math holds, but it&apos;s a margin position: the risk budget
                  assumes the fill and the stop both happen.
                </p>
              )}
              <div className="mt-5 rounded-lg border border-edge bg-[var(--surface-2)] p-4">
                <div className="eyebrow mb-2">Scale-out ladder</div>
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 font-mono tnum text-[12.5px]">
                  {sizing.rTargets.map((t) => (
                    <span key={t.r} className="text-mute">
                      +{t.r}R <span className="text-ink">{t.price.toFixed(2)}</span>
                    </span>
                  ))}
                  {sizing.rr !== null && (
                    <span className="ml-auto text-faint">
                      target R:R <span className="text-gold" style={{ color: "var(--color-gold)" }}>{fmtNum(sizing.rr, 1)}</span>
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {/* Circuit breaker */}
          <Card i={1} className="p-5">
            <CardHeader eyebrow="Today" title="Circuit breaker" />
            <div className="mt-3 flex items-baseline justify-between">
              <span className={`font-mono tnum text-[22px] ${risk.realized > 0 ? "text-pos" : risk.realized < 0 ? "text-neg" : "text-mute"}`}>
                {fmtUSD(risk.realized)}
              </span>
              <span className="font-mono text-[11px] text-faint">/ −{fmtUSD(risk.limit, true)}</span>
            </div>
            <div className="mt-2">
              <Meter value={risk.used} color="var(--color-gold)" overColor="var(--color-neg)" />
            </div>
            {risk.halted ? (
              <div className="panel-tinted neg mt-3 px-3 py-2 text-[12px] text-neg">
                Limit hit. The next trade is revenge, not edge — flat until tomorrow.
              </div>
            ) : (
              <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
                {fmtUSD(risk.remaining, true)} of drawdown left today. Realized P&L only — the
                breaker reads closed journal trades.
              </p>
            )}
          </Card>

          {/* Kelly */}
          <Card i={2} className="p-5">
            <CardHeader eyebrow="From the journal" title="Kelly check" />
            {kelly === null ? (
              <p className="mt-3 text-[12.5px] leading-relaxed text-faint">
                Needs closed wins <em>and</em> losses in the journal to estimate a payoff ratio.
              </p>
            ) : (
              <>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="font-mono tnum text-[22px] text-ink">
                    {fmtNum((kelly / 2) * 100, 1)}%
                  </span>
                  <span className="text-[11.5px] text-faint">half-Kelly per trade</span>
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
                  Full Kelly is {fmtNum(kelly * 100, 1)}% — famously over-aggressive on noisy
                  estimates, so the desk convention is half. Your current risk setting is{" "}
                  {fmtNum(settings.riskPct, 1)}%.
                </p>
              </>
            )}
          </Card>

          {/* The working book, marked live. */}
          <PositionsCard book={book} i={3} />
        </div>
      </div>

      {/* Settings */}
      <Card i={3} className="mt-4 p-5">
        <CardHeader eyebrow="Assumptions" title="Risk settings" />
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {settingField("Account size", "accountSize", "USD")}
          {settingField("Risk per trade", "riskPct", "% of account")}
          {settingField("Daily loss limit", "dailyLossPct", "% of account")}
          {settingField("Opening range", "orMinutes", "minutes")}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          These drive the sizer, the circuit breaker, and the chart&apos;s opening-range lines. Edits
          save on blur.
        </p>
      </Card>
    </>
  );
}
