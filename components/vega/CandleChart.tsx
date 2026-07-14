"use client";

import { m, useReducedMotion } from "framer-motion";
import { useId, useMemo, useState } from "react";
import { AxisX, AxisY, type AxisTick } from "@/components/charts/Axis";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useElementWidth } from "@/lib/useElementWidth";
import { fmtCompact, fmtNum } from "@/lib/format";
import type { BollingerResult, Series, VwapResult } from "@/lib/vega/indicators";
import type { TradeMarker } from "@/lib/vega/markers";
import { etStamp, sessionKey } from "@/lib/vega/session";
import type { VolumeProfile } from "@/lib/vega/profile";
import type { Bar, Interval } from "@/lib/vega/types";

/**
 * The chart terminal's centerpiece: a hand-built SVG candlestick chart with a
 * volume lane, session-anchored VWAP ± σ bands, EMA/Bollinger overlays, key
 * price levels, an in-plot volume profile, session boundaries, a crosshair
 * with a full OHLCV readout, and a live last-price line. No chart library —
 * house rule — and every mark enters by the shared chart grammar (lines draw,
 * bars rise, the candle field wipes in once).
 */

export interface ChartLevel {
  label: string;
  price: number;
  color: string;
  /** Dash pattern, e.g. "4 4"; solid when omitted. */
  dash?: string;
  /** Emphasis line (POC, VWAP anchor) — slightly thicker. */
  strong?: boolean;
}

export interface ChartOverlays {
  vwap?: VwapResult | null;
  emaFast?: Series | null;
  emaSlow?: Series | null;
  bollinger?: BollingerResult | null;
}

/** Shared plot padding — the indicator pane below the chart uses the same
 *  gutters so its x-scale lines up bar-for-bar with the candles. */
export const CHART_PAD = { top: 14, right: 62, bottom: 22, left: 8 };
const PAD = CHART_PAD;
const VOLUME_FRAC = 0.16; // bottom slice of the plot given to the volume lane

const POS = "var(--color-pos)";
const NEG = "var(--color-neg)";
const GOLD = "var(--color-gold)";

/** Round-number ticks covering [lo, hi]. */
function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (!(hi > lo)) return [lo];
  const span = hi - lo;
  const step0 = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
  return out;
}

/** Price label matched to the symbol's scale. */
const fmtPrice = (v: number): string =>
  v >= 1000 ? v.toFixed(0) : v >= 10 ? v.toFixed(2) : v.toFixed(3);

const ET_DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
});

/** ET clock label for a bar; multi-session charts prefix the weekday so
 *  "10:30" on Wednesday and Thursday stop reading as the same tick. Daily
 *  bars label by date instead. */
function timeLabel(iso: string, interval: Interval, withDay = false): string {
  if (interval === "1d") {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  const { minutes } = etStamp(iso);
  const h = Math.floor(minutes / 60);
  const mm = String(minutes % 60).padStart(2, "0");
  const t = `${h}:${mm}`;
  return withDay ? `${ET_DAY.format(new Date(iso))} ${t}` : t;
}

/** Map a nullable overlay series to an SVG path over defined stretches.
 *  Exported: IndicatorPane shares it so the two panes can't drift apart. */
export function seriesPath(
  s: Series,
  x: (i: number) => number,
  y: (v: number) => number
): string {
  let d = "";
  let pen = false;
  for (let i = 0; i < s.length; i++) {
    const v = s[i];
    if (v === null || !Number.isFinite(v)) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`;
    pen = true;
  }
  return d;
}

/** One candle's wick + body — shared by the memoized field and the hovered
 *  candle redrawn at full opacity above the dimmed group. */
function candleMark(
  b: Bar,
  i: number,
  x: (i: number) => number,
  y: (v: number) => number,
  bodyW: number
) {
  const up = b.c >= b.o;
  const color = up ? POS : NEG;
  const cx = x(i);
  const top = y(Math.max(b.o, b.c));
  const bot = y(Math.min(b.o, b.c));
  return (
    <g key={i}>
      <line x1={cx} x2={cx} y1={y(b.h)} y2={y(b.l)} stroke={color} strokeWidth="1" strokeOpacity="0.9" />
      <rect
        x={cx - bodyW / 2}
        y={top}
        width={bodyW}
        height={Math.max(1, bot - top)}
        fill={up ? color : "transparent"}
        stroke={color}
        strokeWidth="1"
        fillOpacity={up ? 0.85 : 1}
      />
    </g>
  );
}

export function CandleChart({
  bars,
  interval,
  height = 420,
  overlays = {},
  levels = [],
  profile = null,
  markers = [],
  live = false,
}: {
  bars: Bar[];
  interval: Interval;
  height?: number;
  overlays?: ChartOverlays;
  levels?: ChartLevel[];
  profile?: VolumeProfile | null;
  /** Journaled fills on this tape — entry/exit glyphs with a connector. */
  markers?: TradeMarker[];
  /** Pulse the last close as a live tape. */
  live?: boolean;
}) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const clipId = useId();

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = Math.max(0, height - PAD.top - PAD.bottom);
  const priceH = plotH * (1 - VOLUME_FRAC) - 8;
  const volTop = PAD.top + priceH + 8;
  const volH = plotH - priceH - 8;
  const n = bars.length;

  const scale = useMemo(() => {
    if (n === 0 || plotW <= 0) return null;
    let lo = Infinity;
    let hi = -Infinity;
    for (const b of bars) {
      if (b.l < lo) lo = b.l;
      if (b.h > hi) hi = b.h;
    }
    // Overlay series can stretch past the bar range (Bollinger, VWAP bands).
    const stretch = (s?: Series | null) => {
      if (!s) return;
      for (const v of s) {
        if (v === null) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    };
    stretch(overlays.bollinger?.upper);
    stretch(overlays.bollinger?.lower);
    stretch(overlays.vwap?.upper2);
    stretch(overlays.vwap?.lower2);
    if (!(hi > lo)) {
      hi = lo + 1;
    }
    const padPx = (hi - lo) * 0.06;
    lo -= padPx;
    hi += padPx;
    let maxVol = 0;
    for (const b of bars) if (b.v > maxVol) maxVol = b.v;
    const step = plotW / n;
    return {
      lo,
      hi,
      maxVol,
      step,
      x: (i: number) => PAD.left + (i + 0.5) * step,
      y: (v: number) => PAD.top + ((hi - v) / (hi - lo)) * priceH,
      vy: (v: number) => volTop + volH - (maxVol > 0 ? (v / maxVol) * volH : 0),
    };
  }, [bars, n, plotW, priceH, volTop, volH, overlays.bollinger, overlays.vwap]);

  // First index of each new session — the day separators on intraday charts.
  const sessionStarts = useMemo(() => {
    if (interval === "1d") return [];
    const out: number[] = [];
    let key = "";
    bars.forEach((b, i) => {
      const k = sessionKey(b.t);
      if (k !== key) {
        key = k;
        if (i > 0) out.push(i);
      }
    });
    return out;
  }, [bars, interval]);

  // Heavy mark arrays are memoized on the DATA, not the crosshair: hover
  // renders reuse the same element references so React bails out of
  // reconciling hundreds of candles/volume bars per mousemove/replay tick.
  const draw = !reduce;
  const bodyW = scale ? Math.max(1, Math.min(11, scale.step * 0.66)) : 1;
  const candleField = useMemo(
    () => (scale ? bars.map((b, i) => candleMark(b, i, scale.x, scale.y, bodyW)) : null),
    [bars, scale, bodyW]
  );
  const volumeField = useMemo(() => {
    if (!scale) return null;
    const { x: vx, vy: vvy } = scale;
    return bars.map((b, i) => (
      <m.rect
        key={`v${i}`}
        initial={draw ? { scaleY: 0 } : false}
        animate={{ scaleY: 1 }}
        style={{ transformOrigin: `${vx(i)}px ${volTop + volH}px` }}
        transition={{ duration: 0.5, delay: Math.min(0.5, i * 0.002), ease: [0.22, 1, 0.36, 1] }}
        x={vx(i) - bodyW / 2}
        y={vvy(b.v)}
        width={bodyW}
        height={Math.max(0, volTop + volH - vvy(b.v))}
        fill={b.c >= b.o ? POS : NEG}
        fillOpacity="0.28"
      />
    ));
  }, [bars, scale, bodyW, draw, volTop, volH]);
  const profileMax = useMemo(
    () => (profile ? Math.max(...profile.bins.map((q) => q.volume), 0) : 0),
    [profile]
  );

  if (!scale || n === 0) {
    return <div ref={wrapRef} style={{ height }} className="w-full" />;
  }

  const { lo, hi, step, x, y, vy } = scale;
  const last = bars[n - 1];
  const lastUp = last.c >= last.o;
  const priceTicks: AxisTick[] = niceTicks(lo, hi).map((v) => ({
    pos: y(v),
    label: fmtPrice(v),
  }));
  // ~6 time labels across the plot.
  const timeTickIdx = Array.from(
    { length: Math.min(6, n) },
    (_, i) => Math.round((i * (n - 1)) / Math.max(1, Math.min(6, n) - 1))
  );
  const inRange = (p: number) => p >= lo && p <= hi;
  const hoverBar = hover !== null ? bars[hover] : null;

  const band = (upper?: Series | null, lower?: Series | null): string => {
    if (!upper || !lower) return "";
    const up = seriesPath(upper, x, y);
    if (!up) return "";
    // Close the band by tracing the lower series backwards.
    let back = "";
    for (let i = lower.length - 1; i >= 0; i--) {
      const v = lower[i];
      if (v === null) continue;
      back += `L${x(i).toFixed(2)},${y(v).toFixed(2)}`;
    }
    return up + back + "Z";
  };

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        className="block"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - rect.left - PAD.left;
          const idx = Math.round(px / step - 0.5);
          setHover(idx >= 0 && idx < n ? idx : null);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id={`${clipId}-plot`}>
            <rect x={PAD.left} y={0} width={plotW} height={height} />
          </clipPath>
          <linearGradient id={`${clipId}-profile`} x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.16" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Price gridlines + right axis */}
        <AxisY
          ticks={priceTicks}
          gridFrom={PAD.left}
          gridTo={PAD.left + plotW}
          labelX={PAD.left + plotW + 8}
          labelSide="right"
        />
        <AxisX
          ticks={timeTickIdx.map((i) => ({
            pos: x(i),
            label: timeLabel(bars[i].t, interval, sessionStarts.length > 0),
          }))}
          y={height - 6}
        />

        {/* Session boundaries — faint verticals where a new ET day begins. */}
        {sessionStarts.map((i) => (
          <line
            key={`s${i}`}
            x1={x(i) - step / 2}
            x2={x(i) - step / 2}
            y1={PAD.top}
            y2={volTop + volH}
            stroke="rgba(255,255,255,0.07)"
            strokeDasharray="2 5"
          />
        ))}

        <g clipPath={`url(#${clipId}-plot)`}>
          {/* Volume profile — the day's traded-volume shape, right-aligned. */}
          {profile && (
            <g>
              {profile.bins.map((b, i) => {
                if (!inRange(b.price)) return null;
                const w = profile.totalVolume > 0 && profileMax > 0
                  ? (b.volume / profileMax) * plotW * 0.2
                  : 0;
                const binH = Math.max(1, (profile.binSize / (hi - lo)) * priceH - 1);
                return (
                  <m.rect
                    key={i}
                    initial={draw ? { width: 0 } : false}
                    animate={{ width: w }}
                    transition={{ duration: 0.7, delay: 0.3 + i * 0.012, ease: [0.22, 1, 0.36, 1] }}
                    x={PAD.left + plotW - w}
                    y={y(b.price) - binH / 2}
                    height={binH}
                    fill={`url(#${clipId}-profile)`}
                  />
                );
              })}
              {/* Value area edges + POC */}
              {inRange(profile.poc) && (
                <line
                  x1={PAD.left + plotW * 0.78}
                  x2={PAD.left + plotW}
                  y1={y(profile.poc)}
                  y2={y(profile.poc)}
                  stroke={GOLD}
                  strokeWidth="1.4"
                  strokeOpacity="0.75"
                />
              )}
            </g>
          )}

          {/* Bollinger band fill */}
          {overlays.bollinger && (
            <m.path
              initial={draw ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.25 }}
              d={band(overlays.bollinger.upper, overlays.bollinger.lower)}
              fill="rgba(255,255,255,0.045)"
              stroke="none"
            />
          )}

          {/* VWAP σ bands */}
          {overlays.vwap && (
            <m.path
              initial={draw ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.25 }}
              d={band(overlays.vwap.upper1, overlays.vwap.lower1)}
              fill="rgba(250,204,21,0.05)"
              stroke="none"
            />
          )}

          {/* Candles — the field wipes in left→right once. The marks are a
              memoized element array and dimming is a single group opacity
              (hovered candle redrawn on top), so crosshair movement never
              rebuilds or re-reconciles hundreds of bars. */}
          <m.g
            initial={draw ? { clipPath: "inset(0 100% 0 0)" } : false}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <g opacity={hover === null ? 1 : 0.55} style={{ transition: "opacity 120ms" }}>
              {candleField}
            </g>
            {hoverBar && hover !== null && candleMark(hoverBar, hover, x, y, bodyW)}
          </m.g>

          {/* Overlay lines — each draws in. */}
          {overlays.emaFast && (
            <m.path
              initial={draw ? { pathLength: 0 } : false}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              d={seriesPath(overlays.emaFast, x, y)}
              fill="none"
              stroke="var(--color-sky)"
              strokeWidth="1.3"
              strokeOpacity="0.9"
            />
          )}
          {overlays.emaSlow && (
            <m.path
              initial={draw ? { pathLength: 0 } : false}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              d={seriesPath(overlays.emaSlow, x, y)}
              fill="none"
              stroke="var(--color-vio)"
              strokeWidth="1.3"
              strokeOpacity="0.9"
            />
          )}
          {overlays.vwap && (
            <m.path
              initial={draw ? { pathLength: 0 } : false}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              d={seriesPath(overlays.vwap.vwap, x, y)}
              fill="none"
              stroke={GOLD}
              strokeWidth="1.6"
            />
          )}

          {/* Trade markers — the journal's fills on this tape. Entry glyphs
              point with the trade (▲ long / ▼ short), exits are squares toned
              by the result, and closed round trips get a connector. */}
          {markers.map((mk, mi) => {
            const tone = mk.pnl === null ? "var(--color-sky)" : mk.pnl >= 0 ? POS : NEG;
            const title = `${mk.side.toUpperCase()} ${mk.trade.qty} ${mk.trade.symbol} @ ${fmtPrice(mk.entryPrice)}${
              mk.exitPrice !== null ? ` → ${fmtPrice(mk.exitPrice)}` : " (open)"
            }`;
            const entryOk = mk.entryIdx !== null && inRange(mk.entryPrice);
            const exitOk = mk.exitIdx !== null && mk.exitPrice !== null && inRange(mk.exitPrice);
            return (
              <g key={`mk${mi}`} pointerEvents="bounding-box">
                <title>{title}</title>
                {entryOk && exitOk && (
                  <line
                    x1={x(mk.entryIdx as number)}
                    y1={y(mk.entryPrice)}
                    x2={x(mk.exitIdx as number)}
                    y2={y(mk.exitPrice as number)}
                    stroke={tone}
                    strokeWidth="1"
                    strokeOpacity="0.5"
                    strokeDasharray="2 3"
                  />
                )}
                {entryOk && (
                  <path
                    d={
                      mk.side === "long"
                        ? `M${x(mk.entryIdx as number) - 4},${y(mk.entryPrice) + 4} h8 l-4,-7 Z`
                        : `M${x(mk.entryIdx as number) - 4},${y(mk.entryPrice) - 4} h8 l-4,7 Z`
                    }
                    fill={mk.side === "long" ? POS : NEG}
                    stroke="rgba(0,0,0,0.55)"
                    strokeWidth="0.75"
                  />
                )}
                {exitOk && (
                  <rect
                    x={x(mk.exitIdx as number) - 3}
                    y={y(mk.exitPrice as number) - 3}
                    width={6}
                    height={6}
                    rx={1}
                    fill={tone}
                    stroke="rgba(0,0,0,0.55)"
                    strokeWidth="0.75"
                  />
                )}
              </g>
            );
          })}

          {/* Volume lane — memoized; the hovered bar gets a brighter overlay. */}
          {volumeField}
          {hoverBar && hover !== null && (
            <rect
              x={x(hover) - bodyW / 2}
              y={vy(hoverBar.v)}
              width={bodyW}
              height={Math.max(0, volTop + volH - vy(hoverBar.v))}
              fill={hoverBar.c >= hoverBar.o ? POS : NEG}
              fillOpacity="0.65"
              pointerEvents="none"
            />
          )}
        </g>

        {/* Key levels — drawn over the clip so their tags can sit in the axis gutter. */}
        {levels.filter((l) => inRange(l.price)).map((l, i) => (
          <g key={`${l.label}${i}`}>
            <m.line
              initial={draw ? { pathLength: 0, opacity: 0 } : false}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.35 + i * 0.04 }}
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={y(l.price)}
              y2={y(l.price)}
              stroke={l.color}
              strokeWidth={l.strong ? 1.3 : 1}
              strokeOpacity="0.55"
              strokeDasharray={l.dash ?? "5 4"}
            />
            <m.text
              initial={draw ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.04 }}
              x={PAD.left + 4}
              y={y(l.price) - 3}
              fill={l.color}
              fillOpacity="0.85"
              className="font-mono"
              style={{ fontSize: 9 }}
            >
              {l.label}
            </m.text>
          </g>
        ))}

        {/* Last price — the live tape line with an axis tag. */}
        <g>
          <line
            x1={PAD.left}
            x2={PAD.left + plotW}
            y1={y(last.c)}
            y2={y(last.c)}
            stroke={lastUp ? POS : NEG}
            strokeWidth="1"
            strokeOpacity="0.5"
            strokeDasharray="2 3"
          />
          <rect
            x={PAD.left + plotW + 2}
            y={y(last.c) - 9}
            width={PAD.right - 6}
            height={18}
            rx={4}
            fill={lastUp ? POS : NEG}
            fillOpacity="0.14"
            stroke={lastUp ? POS : NEG}
            strokeOpacity="0.4"
          />
          <text
            x={PAD.left + plotW + 2 + (PAD.right - 6) / 2}
            y={y(last.c) + 3.5}
            textAnchor="middle"
            fill={lastUp ? POS : NEG}
            className="font-mono tnum"
            style={{ fontSize: 10.5 }}
          >
            {fmtPrice(last.c)}
          </text>
          {live && (
            <>
              <circle cx={x(n - 1)} cy={y(last.c)} r={2.6} fill={lastUp ? POS : NEG} />
              <circle
                className="price-pulse"
                cx={x(n - 1)}
                cy={y(last.c)}
                r={3}
                fill="none"
                stroke={lastUp ? POS : NEG}
                strokeWidth="1"
              />
            </>
          )}
        </g>

        {/* Crosshair */}
        {hoverBar && hover !== null && (
          <g pointerEvents="none">
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={volTop + volH}
              stroke="rgba(255,255,255,0.22)"
              strokeDasharray="3 3"
            />
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={y(hoverBar.c)}
              y2={y(hoverBar.c)}
              stroke="rgba(255,255,255,0.14)"
              strokeDasharray="3 3"
            />
          </g>
        )}
      </svg>

      {/* OHLCV readout — floats near the crosshair. */}
      {hoverBar && hover !== null && (
        <ChartTooltip
          left={Math.min(Math.max(x(hover), 110), width - 110)}
          top={PAD.top + 6}
          place="bottom"
        >
          <div className="font-mono text-[10.5px] leading-relaxed">
            <div className="text-faint">
              {timeLabel(hoverBar.t, interval)}
              {interval !== "1d" && (
                <span className="ml-1.5 text-[9.5px]">{sessionKey(hoverBar.t)}</span>
              )}
            </div>
            <div className="tnum flex gap-2.5">
              <span>O <span className="text-ink">{fmtPrice(hoverBar.o)}</span></span>
              <span>H <span className="text-pos">{fmtPrice(hoverBar.h)}</span></span>
              <span>L <span className="text-neg">{fmtPrice(hoverBar.l)}</span></span>
              <span>C <span className={hoverBar.c >= hoverBar.o ? "text-pos" : "text-neg"}>{fmtPrice(hoverBar.c)}</span></span>
            </div>
            <div className="tnum text-faint">
              Vol {fmtCompact(hoverBar.v)}
              {hover > 0 && (
                <span className={`ml-2 ${hoverBar.c >= bars[hover - 1].c ? "text-pos" : "text-neg"}`}>
                  {fmtNum(((hoverBar.c - bars[hover - 1].c) / bars[hover - 1].c) * 100, 2)}%
                </span>
              )}
            </div>
          </div>
        </ChartTooltip>
      )}
    </div>
  );
}
