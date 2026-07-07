"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Donut, PALETTE } from "@/components/charts/Donut";
import { Legend } from "@/components/charts/Legend";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { StatusDot } from "@/components/ui/StatusDot";
import { TickerLogo } from "@/components/ui/TickerLogo";
import { Money } from "@/components/ui/Money";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { usePortfolio, usePortfolioActions } from "@/lib/store";
import { fmtPct, fmtUSD, fmtUSDCompact, symbolColorIndex } from "@/lib/format";

const TOP_HOLDINGS = 10;

export default function HouseholdPage() {
  const { ready, household } = usePortfolio();
  const { selectPortfolio } = usePortfolioActions();
  const router = useRouter();

  const slices = useMemo(() => {
    if (!household) return [];
    const top = household.holdings.slice(0, TOP_HOLDINGS).map((h, i) => ({
      id: h.symbol,
      label: h.symbol,
      value: h.value,
      color: PALETTE[i % PALETTE.length],
    }));
    const restValue = household.holdings
      .slice(TOP_HOLDINGS)
      .reduce((s, h) => s + h.value, 0);
    const rest =
      restValue > 0
        ? [{ id: "others", label: "Others", value: restValue, color: "color-mix(in srgb, var(--color-track) 70%, transparent)" }]
        : [];
    const cash =
      household.cash > 0
        ? [{ id: "cash", label: "Cash", value: household.cash, color: "color-mix(in srgb, var(--color-track) 45%, transparent)" }]
        : [];
    return [...top, ...rest, ...cash];
  }, [household]);

  if (!ready) return <PageSkeleton />;
  if (!household || household.books.length === 0)
    return <EmptyState page="The household view" />;

  const { total, cash, invested, books, holdings, anyLastKnown } = household;

  return (
    <div>
      <PageHeader
        eyebrow="Household"
        title="All portfolios"
        description={`Everything across ${books.length} ${books.length === 1 ? "book" : "books"}, blended into one read.`}
      />

      <Card className="panel-rim relative mb-5 overflow-hidden px-6 py-6 sm:px-8" i={0}>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full blur-[90px]"
          style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }}
        />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-stretch lg:gap-8">
          <div className="lg:w-[260px] lg:shrink-0">
            <div className="eyebrow">Household value</div>
            <div className="mt-1.5 font-mono tnum text-[34px] font-medium leading-none text-ink sm:text-[40px]">
              {fmtUSD(total, true)}
            </div>
            {anyLastKnown && (
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-faint">
                <StatusDot tone="stale" size={6} />
                Non-active books at last-known prices
              </div>
            )}
          </div>
          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4 lg:self-center lg:border-l lg:border-edge lg:pl-8">
            <Stat label="Books" value={books.length} format={(v) => String(v)} sub="portfolios" />
            <Stat label="Invested" value={invested} format={fmtUSDCompact} sub={`${fmtPct(total > 0 ? invested / total : 0, 0)} deployed`} dim />
            <Stat label="Cash" value={cash} format={fmtUSDCompact} sub={`${fmtPct(total > 0 ? cash / total : 0, 0)} of household`} dim />
            <Stat label="Positions" value={holdings.length} format={(v) => String(v)} sub="distinct names" />
          </div>
        </div>
      </Card>

      <div className="mb-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        {/* Per-book contribution */}
        <Card className="px-5 py-5" i={1}>
          <CardHeader eyebrow="Contribution" title="By portfolio" className="mb-4" />
          <div className="flex flex-col gap-3.5">
            {books.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  selectPortfolio(b.id);
                  router.push("/");
                }}
                className="group w-full text-left"
                title={`Open ${b.name}`}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <StatusDot tone={b.live ? "live" : "stale"} size={6} />
                    <span className="truncate text-mute group-hover:text-ink">{b.name}</span>
                    {b.isDemo && <span className="font-mono text-[10px] uppercase text-faint">demo</span>}
                  </span>
                  <span className="shrink-0 font-mono tnum text-ink">
                    {fmtUSD(b.value, true)}{" "}
                    <span className="text-faint">({fmtPct(b.weight, 0)})</span>
                  </span>
                </div>
                <div className="h-[6px] w-full overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${Math.max(2, b.weight * 100)}%`,
                      background: b.live
                        ? "var(--color-accent)"
                        : "color-mix(in srgb, var(--color-accent) 45%, transparent)",
                    }}
                  />
                </div>
                <div className="mt-1 font-mono text-[10px] text-faint">
                  {b.count} {b.count === 1 ? "holding" : "holdings"} ·{" "}
                  {b.live ? "live" : "last-known"}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Blended allocation */}
        <Card className="px-5 py-5" i={2}>
          <CardHeader
            eyebrow="Blended allocation"
            title="Household mix"
            right={
              <Legend
                items={[
                  { label: "held", color: "color-mix(in srgb, var(--color-accent) 55%, transparent)" },
                ]}
              />
            }
            className="mb-4"
          />
          <ErrorBoundary label="The blended allocation">
            <Donut
              slices={slices}
              centerLabel="Household"
              centerValue={fmtUSDCompact(total)}
            />
          </ErrorBoundary>
        </Card>
      </div>

      {/* Blended top holdings */}
      <Card className="overflow-hidden" i={3}>
        <CardHeader
          eyebrow="Holdings"
          title="Blended positions"
          right={
            <span className="font-mono text-[10px] text-faint">
              a name held in two books reads as one line
            </span>
          }
          className="px-6 pt-5 mb-1"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="border-b border-edge text-left">
                <th className="px-6 py-3 text-[11.5px] font-medium uppercase tracking-[0.04em] text-faint">Asset</th>
                <th className="px-6 py-3 text-right text-[11.5px] font-medium uppercase tracking-[0.04em] text-faint">Value</th>
                <th className="px-6 py-3 text-right text-[11.5px] font-medium uppercase tracking-[0.04em] text-faint">Weight</th>
                <th className="px-6 py-3 text-right text-[11.5px] font-medium uppercase tracking-[0.04em] text-faint">Books</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const accent = PALETTE[symbolColorIndex(h.symbol, PALETTE.length)];
                return (
                  <tr
                    key={h.symbol}
                    onClick={() => router.push(`/research?symbol=${encodeURIComponent(h.symbol)}`)}
                    className="group cursor-pointer border-b border-edge/60 transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <TickerLogo symbol={h.symbol} accent={accent} size={30} peek peekName={h.name} />
                        <div className="min-w-0">
                          <div className="font-mono text-[13px] font-medium text-ink">{h.symbol}</div>
                          <div className="max-w-[220px] truncate text-[11px] text-faint">{h.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right font-mono tnum text-ink">
                      <Money value={h.value} />
                    </td>
                    <td className="px-6 py-3 text-right font-mono tnum text-mute">{fmtPct(h.weight, 1)}</td>
                    <td className="px-6 py-3 text-right font-mono tnum text-faint">
                      {h.bookCount > 1 ? `${h.bookCount} books` : "1"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
