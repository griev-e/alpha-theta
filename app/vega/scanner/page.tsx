"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusDot } from "@/components/ui/StatusDot";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Money } from "@/components/ui/Money";
import { ChangePct, RangeBar, RvolText, ScanTag, ScoreChip } from "@/components/vega/bits";
import { ScanMap } from "@/components/vega/ScanMap";
import { SymbolSearch } from "@/components/vega/SymbolSearch";
import { rankScans, scanQuote, type ScanRow } from "@/lib/vega/scan";
import { useVega } from "@/lib/vega/store";
import { WATCHLIST_MAX, WATCHLIST_PRESETS } from "@/lib/vega/types";
import { useVegaQuotes } from "@/lib/vega/useVegaQuotes";

/**
 * The momentum scanner — the watchlist ranked cross-sectionally by heat
 * (gap, relative volume, range, move off the open), with setup tags. One
 * batched quote call per poll covers the whole board; the ranking principle
 * is the regime engine's — percentiles within the scanned set, no hand-tuned
 * thresholds.
 */
export default function ScannerPage() {
  const { state, ready, setFocus, addToWatchlist, addManyToWatchlist, removeFromWatchlist } =
    useVega();
  const router = useRouter();
  const { quotes, asOf, degraded } = useVegaQuotes(ready ? state.watchlist : []);

  const scans = useMemo(() => {
    const now = asOf ?? new Date().toISOString();
    return rankScans(
      state.watchlist
        .map((s) => quotes[s])
        .filter((q): q is NonNullable<typeof q> => Boolean(q))
        .map((q) => scanQuote(q, now))
    );
  }, [quotes, state.watchlist, asOf]);

  const missing = state.watchlist.filter((s) => !quotes[s]);

  const columns = useMemo<TableColumn<ScanRow>[]>(
    () => [
      {
        key: "score",
        header: "Heat",
        align: "left",
        sortable: true,
        sortValue: (r) => r.score ?? -1,
        width: "w-[72px]",
        cell: (r) => <ScoreChip score={r.score} />,
      },
      {
        key: "symbol",
        header: "Symbol",
        align: "left",
        sortable: true,
        sortValue: (r) => r.symbol,
        cell: (r) => (
          <span>
            <span className="font-mono text-[12.5px] text-ink">{r.symbol}</span>
            {r.name && (
              <span className="ml-2 hidden text-[11px] text-faint lg:inline">
                {r.name.length > 26 ? `${r.name.slice(0, 25)}…` : r.name}
              </span>
            )}
          </span>
        ),
      },
      {
        key: "price",
        header: "Last",
        align: "right",
        sortable: true,
        sortValue: (r) => r.price,
        cell: (r) => <Money value={r.price} className="text-[12.5px]" />,
      },
      {
        key: "chg",
        header: "Chg",
        align: "right",
        sortable: true,
        sortValue: (r) => r.changePct ?? -Infinity,
        cell: (r) => <ChangePct value={r.changePct} />,
      },
      {
        key: "gap",
        header: "Gap",
        align: "right",
        sortable: true,
        sortValue: (r) => r.gapPct ?? -Infinity,
        cell: (r) => <ChangePct value={r.gapPct} digits={1} />,
      },
      {
        key: "open",
        header: "Off open",
        align: "right",
        sortable: true,
        sortValue: (r) => r.fromOpenPct ?? -Infinity,
        cell: (r) => <ChangePct value={r.fromOpenPct} digits={1} />,
      },
      {
        key: "rvol",
        header: "RVOL",
        align: "right",
        sortable: true,
        sortValue: (r) => r.rvol ?? -Infinity,
        cell: (r) => <RvolText rvol={r.rvol} />,
      },
      {
        key: "range",
        header: "Range",
        align: "right",
        cell: (r) => (
          <span className="flex justify-end">
            <RangeBar pos={r.rangePos} />
          </span>
        ),
      },
      {
        key: "tags",
        header: "Setups",
        align: "left",
        cell: (r) => (
          <span className="flex flex-wrap gap-1">
            {r.tags.length > 0 ? r.tags.map((t) => <ScanTag key={t} label={t} />) : (
              <span className="text-[11px] text-faint">—</span>
            )}
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        align: "right",
        width: "w-[44px]",
        cell: (r) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeFromWatchlist(r.symbol);
            }}
            title={`Remove ${r.symbol} from the watchlist`}
            aria-label={`Remove ${r.symbol}`}
            className="btn-ghost danger h-6 w-6"
          >
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M5 5 L15 15 M15 5 L5 15" />
            </svg>
          </button>
        ),
      },
    ],
    [removeFromWatchlist]
  );

  return (
    <>
      <PageHeader
        eyebrow="Trade"
        title="Scanner"
        description="Cross-sectional heat over everything you're watching — ranked against today's set, not a magic threshold."
        right={
          <SymbolSearch
            onSelect={addToWatchlist}
            buttonLabel="Watch"
            placeholder="Add symbol or name…"
            disabled={state.watchlist.length >= WATCHLIST_MAX}
          />
        }
      />

      {/* The battle map — gap × rvol, sized by heat. Same data as the board,
          zero extra provider calls. */}
      <Card i={0} className="mb-4 overflow-hidden p-5 pb-2">
        <CardHeader
          eyebrow="Positioning"
          title="Gap × volume map"
          right={
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              size = heat · color = off the open
            </span>
          }
        />
        <ScanMap
          rows={scans}
          onSelect={(sym) => {
            setFocus(sym);
            router.push("/vega/chart");
          }}
        />
      </Card>

      <Card i={1} className="overflow-hidden">
        <CardHeader
          eyebrow={`${state.watchlist.length} of ${WATCHLIST_MAX} symbols`}
          title="The board"
          className="px-5 pt-5"
          right={
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
              <StatusDot tone={degraded ? "stale" : asOf ? "live" : "idle"} />
              {degraded ? "feed stalled" : asOf ? "live · 30s" : "connecting"}
            </span>
          }
        />
        <div className="mt-3">
          {scans.length === 0 ? (
            <div className="px-5 pb-5 text-[13px] text-faint">
              {degraded ? (
                "Quotes unreachable — the board lights back up when the feed returns."
              ) : state.watchlist.length === 0 ? (
                <span className="flex flex-wrap items-center gap-2">
                  The watchlist is empty — add a symbol above, or load a board:
                  {WATCHLIST_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => addManyToWatchlist([...p.symbols])}
                      title={p.symbols.join(" · ")}
                      className="btn-secondary h-7 px-2.5 text-[12px]"
                    >
                      {p.label}
                    </button>
                  ))}
                </span>
              ) : (
                "Loading the board…"
              )}
            </div>
          ) : (
            <Table
              columns={columns}
              rows={scans}
              rowKey={(r) => r.symbol}
              defaultSort={{ key: "score", asc: false }}
              onRowClick={(r) => {
                setFocus(r.symbol);
                router.push("/vega/chart");
              }}
              density="compact"
              minWidth="min-w-[860px]"
            />
          )}
        </div>
        {missing.length > 0 && scans.length > 0 && (
          <p className="border-t border-edge px-5 py-2.5 text-[11.5px] text-faint">
            No quote for {missing.join(", ")} — unknown to the provider or momentarily unpriced;
            shown again the moment data returns.
          </p>
        )}
      </Card>

      <p className="mt-4 max-w-3xl text-[11.5px] leading-relaxed text-faint">
        Heat is the mean percentile of |gap|, relative volume, day range and |move off the open|
        within this board — each symbol is ranked against what you&apos;re watching today, so the score
        adapts to the session instead of leaning on fixed cutoffs. RVOL pro-rates the 10-day average
        volume to the elapsed session.
      </p>
    </>
  );
}
