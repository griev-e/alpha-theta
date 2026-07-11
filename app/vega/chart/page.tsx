"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { Money } from "@/components/ui/Money";
import { CandleChart, type ChartLevel, type ChartOverlays } from "@/components/vega/CandleChart";
import { IndicatorPane, type IndicatorKind } from "@/components/vega/IndicatorPane";
import { AlertPopover } from "@/components/vega/AlertPopover";
import { SymbolForm } from "@/components/vega/SymbolForm";
import { ChangePct, RvolText, ScanTag } from "@/components/vega/bits";
import { fmtNum } from "@/lib/format";
import { armedAlerts } from "@/lib/vega/alerts";
import { atr, bollinger, ema, rsi, sessionVwap } from "@/lib/vega/indicators";
import {
  floorPivots,
  openingRange,
  premarketRange,
  priorDayFromDaily,
  priorDayFromIntraday,
  swingLevels,
} from "@/lib/vega/levels";
import { volumeProfile } from "@/lib/vega/profile";
import { displayWindow, latestSession, regularBars, replayStart } from "@/lib/vega/session";
import { scanQuote } from "@/lib/vega/scan";
import { useVega } from "@/lib/vega/store";
import { ALERTS_MAX, type Bar, type Interval } from "@/lib/vega/types";
import { useIntraday } from "@/lib/vega/useIntraday";
import { useVegaQuotes } from "@/lib/vega/useVegaQuotes";

/** Frozen tape for bar replay: the full fetched span (levels need the prior
 *  session) plus the display window, both captured the moment replay starts
 *  so live polls can't shift the scrubber underfoot. */
interface ReplayState {
  all: Bar[];
  win: Bar[];
  cursor: number;
  playing: boolean;
  speed: number;
}

const REPLAY_SPEEDS = [1, 2, 4, 8];
/** Bars advanced per second at 1× — one bar every ~400ms reads as a tape. */
const REPLAY_BASE_HZ = 2.5;

type OverlayKey = "vwap" | "ema" | "bb" | "levels" | "profile";

const OVERLAY_LABEL: Record<OverlayKey, string> = {
  vwap: "VWAP σ",
  ema: "EMA 9/20",
  bb: "Bollinger",
  levels: "Levels",
  profile: "Profile",
};

/**
 * The chart terminal — intraday candles with the full day-trading overlay
 * stack: session-anchored VWAP with deviation bands, EMA 9/20, Bollinger,
 * prior-day / pivot / opening-range levels, and the day's volume profile,
 * plus an RSI/MACD pane. All indicator math is the pure lib/vega engine.
 */
export default function ChartPage() {
  const { state, ready, setFocus, addToWatchlist, addAlert, deleteAlert } = useVega();
  const [interval, setInterval] = useState<Interval>("5m");
  const [indicator, setIndicator] = useState<IndicatorKind | "off">("rsi");
  const [on, setOn] = useState<Record<OverlayKey, boolean>>({
    vwap: true,
    ema: true,
    bb: false,
    levels: true,
    profile: true,
  });
  const [replay, setReplay] = useState<ReplayState | null>(null);

  const symbol = state.focus;
  const { series, loading, empty, degraded } = useIntraday(ready ? symbol : "", interval);
  const { quotes, asOf } = useVegaQuotes(ready ? [symbol] : []);
  const quote = quotes[symbol];

  // Bars arrive already repaired by useIntraday; window the display to a
  // fixed session count per interval so candles stay readable.
  const liveAll = useMemo(() => series?.bars ?? [], [series]);
  const liveWin = useMemo(() => displayWindow(liveAll, interval), [liveAll, interval]);

  // Replay mode swaps in the frozen tape, cut at the cursor. Levels/profile
  // read the frozen FULL span cut at the same timestamp, so the prior day
  // stays known while nothing from later in the session leaks back.
  const replaying = replay !== null;
  const bars = useMemo(
    () => (replay ? replay.win.slice(0, replay.cursor + 1) : liveWin),
    [replay, liveWin]
  );
  const allBars = useMemo(() => {
    if (!replay) return liveAll;
    const cutoff = replay.win[replay.cursor]?.t ?? "";
    return replay.all.filter((b) => b.t <= cutoff);
  }, [replay, liveAll]);

  // Drive the transport: advance the cursor while playing, pause at the end.
  // Deps are playing/speed only — depending on the whole replay object would
  // tear down and recreate the interval on every tick, resetting its phase
  // and gating effective speed on render latency.
  const replayPlaying = replay?.playing ?? false;
  const replaySpeed = replay?.speed ?? 1;
  useEffect(() => {
    if (!replayPlaying) return;
    const stepMs = 1000 / (REPLAY_BASE_HZ * replaySpeed);
    const id = window.setInterval(() => {
      setReplay((r) => {
        if (!r || !r.playing) return r;
        if (r.cursor >= r.win.length - 1) return { ...r, playing: false };
        return { ...r, cursor: r.cursor + 1 };
      });
    }, stepMs);
    return () => window.clearInterval(id);
  }, [replayPlaying, replaySpeed]);

  // A new symbol or timeframe is a new tape — drop any replay in progress.
  useEffect(() => setReplay(null), [symbol, interval]);

  const startReplay = () => {
    if (liveWin.length < 20) return;
    setReplay({
      all: liveAll,
      win: liveWin,
      cursor: replayStart(liveWin, interval),
      playing: true,
      speed: 2,
    });
  };

  const computed = useMemo(() => {
    if (bars.length === 0) return null;
    const closes = bars.map((b) => b.c);
    const intraday = interval !== "1d";
    const overlays: ChartOverlays = {
      vwap: on.vwap && intraday ? sessionVwap(bars) : null,
      emaFast: on.ema ? ema(closes, 9) : null,
      emaSlow: on.ema ? ema(closes, 20) : null,
      bollinger: on.bb ? bollinger(closes, 20, 2) : null,
    };

    const levels: ChartLevel[] = [];
    if (on.levels) {
      // Levels derive from the FULL fetched span — the 1m display window is a
      // single session, but "yesterday's high" needs the prior one.
      const prior = intraday ? priorDayFromIntraday(allBars) : priorDayFromDaily(allBars);
      if (prior) {
        levels.push(
          { label: "PDH", price: prior.high, color: "var(--color-pos)" },
          { label: "PDL", price: prior.low, color: "var(--color-neg)" },
          { label: "PDC", price: prior.close, color: "var(--color-track)" }
        );
        if (intraday) {
          const piv = floorPivots(prior.high, prior.low, prior.close);
          levels.push(
            { label: "P", price: piv.p, color: "var(--color-sky)", strong: true },
            { label: "R1", price: piv.r1, color: "var(--color-sky)" },
            { label: "S1", price: piv.s1, color: "var(--color-sky)" },
            { label: "R2", price: piv.r2, color: "var(--color-sky)" },
            { label: "S2", price: piv.s2, color: "var(--color-sky)" }
          );
        }
      }
      if (intraday) {
        const or = openingRange(allBars, state.settings.orMinutes);
        if (or) {
          levels.push(
            { label: `OR↑`, price: or.high, color: "var(--color-gold)", dash: "2 3" },
            { label: `OR↓`, price: or.low, color: "var(--color-gold)", dash: "2 3" }
          );
        }
        const pre = premarketRange(allBars);
        if (pre) {
          levels.push(
            { label: "PM↑", price: pre.high, color: "var(--color-vio)", dash: "1 4" },
            { label: "PM↓", price: pre.low, color: "var(--color-vio)", dash: "1 4" }
          );
        }
        // Data-derived swing S/R — the strongest clustered swing points of
        // the regular-hours tape, ranked by touches.
        for (const sw of swingLevels(regularBars(allBars), 3, 3)) {
          levels.push({
            label: `SR${sw.touches > 1 ? `·${sw.touches}` : ""}`,
            price: sw.price,
            color: "var(--color-track)",
            dash: "3 5",
          });
        }
      }
    }

    const profile =
      on.profile && intraday
        ? volumeProfile(regularBars(latestSession(bars)), 26)
        : null;

    const atr14 = atr(bars, 14);
    const rsi14 = rsi(closes, 14);
    return {
      overlays,
      levels,
      profile,
      lastAtr: atr14[atr14.length - 1],
      lastRsi: rsi14[rsi14.length - 1],
    };
  }, [bars, allBars, interval, on, state.settings.orMinutes]);

  const scan = useMemo(
    () => (quote ? scanQuote(quote, asOf ?? new Date().toISOString()) : null),
    [quote, asOf]
  );

  // Armed alert levels ride on the chart as flagged lines.
  const myAlerts = useMemo(() => armedAlerts(state.alerts, symbol), [state.alerts, symbol]);
  const levelList = useMemo<ChartLevel[]>(
    () => [
      ...(computed?.levels ?? []),
      ...myAlerts.map((a) => ({
        label: `⚑${a.dir === "above" ? "↑" : "↓"}`,
        price: a.price,
        color: "var(--color-warn)",
        dash: "7 3",
      })),
    ],
    [computed, myAlerts]
  );

  return (
    <>
      <PageHeader
        eyebrow="Trade"
        title={`${symbol} · Chart terminal`}
        description="Candles with session VWAP bands, EMAs, key levels and the day's volume profile — the full pre-market markup, drawn live."
        right={<SymbolForm onSubmit={setFocus} buttonLabel="Chart" />}
      />

      {/* Quote strip */}
      <Card i={0} className="mb-4 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {quote ? (
            <>
              <span className="font-display text-[20px] font-semibold tracking-[-0.01em] text-ink">
                <Money value={quote.price} />
              </span>
              <ChangePct value={quote.changePct} />
              {quote.marketState !== "REGULAR" && (
                <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
                  {quote.marketState === "PRE" ? "pre-market" : quote.marketState === "POST" ? "after hours" : "closed"}
                </span>
              )}
              <span className="hidden font-mono text-[11px] text-faint sm:inline">
                O {quote.open?.toFixed(2) ?? "—"} · H{" "}
                <span className="text-pos">{quote.dayHigh?.toFixed(2) ?? "—"}</span> · L{" "}
                <span className="text-neg">{quote.dayLow?.toFixed(2) ?? "—"}</span>
              </span>
              {scan && <span className="hidden items-center gap-1 font-mono text-[11px] text-faint md:flex">RVOL <RvolText rvol={scan.rvol} /></span>}
              <span className="flex flex-wrap gap-1">
                {scan?.tags.map((t) => <ScanTag key={t} label={t} />)}
              </span>
            </>
          ) : (
            <SkeletonBlock className="h-6 w-64" />
          )}
          <span className="ml-auto flex items-center gap-2">
            <AlertPopover
              symbol={symbol}
              currentPrice={quote?.price ?? null}
              alerts={myAlerts}
              onAdd={addAlert}
              onDelete={deleteAlert}
              capReached={
                state.alerts.length >= ALERTS_MAX && state.alerts.every((a) => !a.firedAt)
              }
            />
            {!state.watchlist.includes(symbol) && (
              <button
                onClick={() => addToWatchlist(symbol)}
                className="btn-secondary h-7 px-2.5 text-[12px]"
              >
                + Watch
              </button>
            )}
          </span>
        </div>
      </Card>

      <Card i={1} className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
          <CardHeader eyebrow="Price" title={interval === "1d" ? "Daily bars" : "Intraday tape"} />
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={interval}
              onChange={setInterval}
              options={[
                { value: "1m", label: "1m" },
                { value: "5m", label: "5m" },
                { value: "15m", label: "15m" },
                { value: "1d", label: "D" },
              ]}
            />
            <div className="flex gap-0.5 rounded-md border border-edge p-0.5">
              {(Object.keys(OVERLAY_LABEL) as OverlayKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setOn((o) => ({ ...o, [k]: !o[k] }))}
                  aria-pressed={on[k]}
                  className={`rounded px-2 py-0.5 font-mono text-[10.5px] transition-colors ${
                    on[k] ? "bg-white/[0.08] text-ink" : "text-faint hover:text-ink"
                  }`}
                >
                  {OVERLAY_LABEL[k]}
                </button>
              ))}
            </div>
            <Segmented
              value={indicator}
              onChange={setIndicator}
              options={[
                { value: "rsi", label: "RSI" },
                { value: "macd", label: "MACD" },
                { value: "off", label: "—" },
              ]}
            />
            <button
              onClick={() => (replaying ? setReplay(null) : startReplay())}
              aria-pressed={replaying}
              disabled={!replaying && liveWin.length < 20}
              className={`h-7 rounded-md border px-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] transition-colors disabled:opacity-40 ${
                replaying
                  ? "border-gold/60 bg-gold/10 text-gold"
                  : "border-edge text-faint hover:text-ink"
              }`}
            >
              {replaying ? "Exit replay" : "Replay"}
            </button>
          </div>
        </div>

        {/* Replay transport — scrub the frozen tape bar by bar. */}
        {replay && (
          <div className="mx-5 mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-gold/25 bg-gold/[0.04] px-3 py-2">
            <span className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-gold">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
              Replay
            </span>
            <button
              onClick={() =>
                setReplay((r) =>
                  r
                    ? {
                        ...r,
                        // Replaying past the end restarts the tape.
                        cursor: r.cursor >= r.win.length - 1 ? replayStart(r.win, interval) : r.cursor,
                        playing: !r.playing,
                      }
                    : r
                )
              }
              aria-label={replay.playing ? "Pause replay" : "Play replay"}
              className="btn-secondary h-7 w-7 p-0"
            >
              {replay.playing ? (
                <svg width="12" height="12" viewBox="0 0 10 10" className="text-ink" fill="currentColor"><rect x="1" y="1" width="3" height="8" rx="0.5" /><rect x="6" y="1" width="3" height="8" rx="0.5" /></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 10 10" className="text-ink" fill="currentColor"><path d="M2 1 L9 5 L2 9 Z" /></svg>
              )}
            </button>
            <Segmented
              value={String(replay.speed)}
              onChange={(v) => setReplay((r) => (r ? { ...r, speed: Number(v) } : r))}
              options={REPLAY_SPEEDS.map((s) => ({ value: String(s), label: `${s}×` }))}
            />
            <RangeSlider
              min={5}
              max={Math.max(6, replay.win.length - 1)}
              value={replay.cursor}
              onChange={(v) => setReplay((r) => (r ? { ...r, cursor: Math.round(v), playing: false } : r))}
              format={(v) => `bar ${Math.round(v) + 1}/${replay.win.length}`}
              className="min-w-[140px] flex-1"
            />
            <span className="font-mono tnum text-[10.5px] text-faint">
              {replay.cursor + 1}/{replay.win.length}
            </span>
          </div>
        )}

        <div className="px-2 pb-3 pt-2">
          {loading && bars.length === 0 ? (
            <div className="px-3 py-4">
              <SkeletonBlock className="h-[380px] w-full" />
            </div>
          ) : empty || bars.length === 0 ? (
            <div className="flex h-[380px] flex-col items-center justify-center gap-2 text-center">
              <p className="text-[13px] text-mute">
                {degraded
                  ? "The price feed is unreachable — the tape resumes when it returns."
                  : `No ${interval} bars for ${symbol}.`}
              </p>
              <p className="text-[12px] text-faint">
                Index tickers (^VIX) quote on the cockpit but don&apos;t chart intraday.
              </p>
            </div>
          ) : (
            <>
              <CandleChart
                key={`${symbol}:${interval}`}
                bars={bars}
                interval={interval}
                overlays={computed?.overlays ?? {}}
                levels={levelList}
                profile={computed?.profile ?? null}
                live={interval !== "1d" && !replaying}
                height={430}
              />
              {indicator !== "off" && (
                <IndicatorPane
                  key={`${symbol}:${interval}:${indicator}`}
                  bars={bars}
                  kind={indicator}
                />
              )}
            </>
          )}
        </div>
      </Card>

      {/* Session stats */}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          {
            label: `ATR(14) · ${interval}`,
            value: computed?.lastAtr != null ? fmtNum(computed.lastAtr, 2) : "—",
            hint: "Average true range — the honest unit for stops and targets at this timeframe.",
          },
          {
            label: "RSI(14)",
            value: computed?.lastRsi != null ? fmtNum(computed.lastRsi, 1) : "—",
            hint: "Wilder momentum oscillator; 70/30 mark the stretched zones.",
          },
          {
            label: "Day range",
            value: scan?.rangePct != null ? `${fmtNum(scan.rangePct * 100, 2)}%` : "—",
            hint: "High−low as a share of price — how much it's actually traveling today.",
          },
          {
            label: "Off the open",
            value: scan?.fromOpenPct != null ? `${fmtNum(scan.fromOpenPct * 100, 2)}%` : "—",
            hint: "Move since the 09:30 print, gap excluded — the intraday trend itself.",
          },
        ].map((s, i) => (
          <Card key={s.label} i={2 + i} className="p-4">
            <div className="eyebrow">{s.label}</div>
            <div className="mt-1 font-mono tnum text-[19px] text-ink">{s.value}</div>
            <p className="mt-1 text-[11px] leading-relaxed text-faint">{s.hint}</p>
          </Card>
        ))}
      </div>

      <p className="mt-4 max-w-3xl text-[11.5px] leading-relaxed text-faint">
        Methodology — VWAP anchors at each 09:30 ET session open over regular-hours volume, with
        ±1σ/2σ volume-weighted deviation bands. Pivots are classic floor-trader levels off the prior
        regular session; the opening range spans the first {state.settings.orMinutes} minutes. The
        volume profile bins today&apos;s regular-session volume at typical price — OHLCV resolution, not
        tick data. Bars arrive from the live feed and are never imputed.
      </p>
    </>
  );
}
