"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "framer-motion";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { parsePortfolioCSV, toCSV, type ParseResult } from "@/lib/csv";
import { fmtUSD } from "@/lib/format";
import { usePortfolio, usePortfolioActions } from "@/lib/store";

const EXPECTED_HEADER = "name,symbol,shares,price,averageCost,totalReturn,equity";

export default function ImportPage() {
  const router = useRouter();
  const { ready, portfolio, hasData, isDemo, portfolios, activeId } = usePortfolio();
  const {
    importHoldings,
    loadDemo,
    setCash,
    createPortfolio,
    renamePortfolio,
    deletePortfolio,
  } = usePortfolioActions();
  const [dragOver, setDragOver] = useState(false);
  const [pasted, setPasted] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [cashInput, setCashInput] = useState<string>("");
  const [confirmClear, setConfirmClear] = useState(false);
  // Where a committed import lands: replace the active portfolio, or create a
  // new one (e.g. an individual account alongside a Roth IRA).
  const [importAsNew, setImportAsNew] = useState(false);
  const [newName, setNewName] = useState("");
  // Inline rename state, keyed by portfolio id.
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeName =
    portfolios.find((p) => p.id === activeId)?.name ?? "portfolio";

  const handleText = useCallback((text: string, name: string | null) => {
    setFileName(name);
    setParsed(parsePortfolioCSV(text));
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      file.text().then((t) => handleText(t, file.name));
    },
    [handleText]
  );

  const commit = () => {
    if (!parsed || parsed.errors.length > 0 || parsed.holdings.length === 0) return;
    const asNew = importAsNew || !hasData;
    importHoldings(parsed.holdings, parsed.cash, {
      asNew,
      name: newName.trim() || fileName?.replace(/\.csv$/i, "") || "Portfolio",
    });
    setParsed(null);
    setPasted("");
    setFileName(null);
    setImportAsNew(false);
    setNewName("");
    // Land on the Overview once holdings are in.
    router.push("/");
  };

  const downloadCurrent = () => {
    if (!portfolio) return;
    const blob = new Blob(
      [
        toCSV(
          portfolio.positions.map((p) => ({
            name: p.name,
            symbol: p.symbol,
            shares: p.shares,
            price: p.price,
            averageCost: p.averageCost,
            totalReturn: p.totalReturn,
            equity: p.equity,
          })),
          portfolio.cash
        ),
      ],
      { type: "text/csv" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alpha-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!ready) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Data"
        title="Import & Data"
        description="Bring in your holdings as CSV, manage the cash position, and control stored data. Everything stays in this browser — nothing is uploaded anywhere."
      />

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          {/* Dropzone */}
          <Card className="px-6 py-6" i={0}>
            <CardHeader eyebrow="Import" title="Load a portfolio CSV" className="mb-4" />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              onClick={() => fileRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200 ${
                dragOver
                  ? "border-mint/60 bg-mint/[0.06] scale-[1.01]"
                  : "border-edge2 hover:border-mint/30 hover:bg-white/[0.015]"
              }`}
            >
              <m.div
                animate={dragOver ? { y: [-2, 2, -2] } : { y: 0 }}
                transition={dragOver ? { repeat: Infinity, duration: 1 } : {}}
                className="mb-3 text-mint"
              >
                <svg width="36" height="36" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 3.5 V12.2 M6.6 9 L10 12.4 L13.4 9" />
                  <path d="M4 13.6 V15.4 C4 16 4.5 16.5 5.1 16.5 H14.9 C15.5 16.5 16 16 16 15.4 V13.6" />
                </svg>
              </m.div>
              <div className="text-[14px] font-medium text-ink">
                Drop your CSV here, or click to browse
              </div>
              <div className="mt-1.5 font-mono text-[11px] text-faint">
                {EXPECTED_HEADER}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="mt-4">
              <div className="eyebrow mb-2">…or paste CSV text</div>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder={`${EXPECTED_HEADER}\nApple,AAPL,10,291.48,250.00,414.80,2914.80`}
                rows={4}
                className="field resize-y !font-mono !text-[12px] leading-relaxed placeholder:text-faint/60"
              />
              {pasted.trim() && (
                <button
                  onClick={() => handleText(pasted, null)}
                  className="btn-secondary mt-2"
                >
                  Parse pasted text
                </button>
              )}
            </div>

            {/* Parse preview */}
            <AnimatePresence>
              {parsed && (
                <m.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 rounded-xl border border-edge bg-void/40 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[12px] text-mute">
                        {fileName ?? "pasted text"}
                      </div>
                      {parsed.errors.length === 0 ? (
                        <span className="font-mono text-[11px] text-pos">
                          ✓ {parsed.holdings.length} holdings
                          {parsed.cash !== null && ` · ${fmtUSD(parsed.cash)} cash`}
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-neg">parse failed</span>
                      )}
                    </div>

                    {parsed.errors.map((e) => (
                      <div key={e} className="mt-2 text-[12px] text-neg">
                        ✕ {e}
                      </div>
                    ))}
                    {parsed.warnings.map((w) => (
                      <div key={w} className="mt-2 text-[11.5px] text-warn/90">
                        ⚠ {w}
                      </div>
                    ))}

                    {parsed.holdings.length > 0 && (
                      <>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {parsed.holdings.map((h) => (
                            <span
                              key={h.symbol}
                              className="rounded-md border border-edge bg-panel px-2 py-0.5 font-mono text-[11px] text-mute"
                              title="Fundamentals are fetched live after import, where the provider has them."
                            >
                              {h.symbol}
                            </span>
                          ))}
                        </div>
                        {hasData && (
                          <div className="mt-4 space-y-2">
                            <div className="eyebrow">Import into</div>
                            <div className="flex flex-col gap-1.5 sm:flex-row">
                              <button
                                onClick={() => setImportAsNew(false)}
                                className={`flex-1 rounded-lg border px-3 py-2 text-left text-[12px] transition ${
                                  !importAsNew
                                    ? "border-mint/40 bg-mint/[0.06] text-ink"
                                    : "border-edge text-mute hover:text-ink"
                                }`}
                              >
                                <span className="font-medium">Replace “{activeName}”</span>
                                <span className="mt-0.5 block text-[11px] text-faint">
                                  overwrites the active portfolio
                                </span>
                              </button>
                              <button
                                onClick={() => setImportAsNew(true)}
                                className={`flex-1 rounded-lg border px-3 py-2 text-left text-[12px] transition ${
                                  importAsNew
                                    ? "border-mint/40 bg-mint/[0.06] text-ink"
                                    : "border-edge text-mute hover:text-ink"
                                }`}
                              >
                                <span className="font-medium">New portfolio</span>
                                <span className="mt-0.5 block text-[11px] text-faint">
                                  keeps existing portfolios
                                </span>
                              </button>
                            </div>
                            {importAsNew && (
                              <input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Portfolio name (e.g. Roth IRA)"
                                className="field !text-[12.5px]"
                              />
                            )}
                          </div>
                        )}
                        <div className="mt-4 flex items-center gap-3">
                          <button
                            onClick={commit}
                            className="btn-primary"
                          >
                            Import {parsed.holdings.length} holdings
                          </button>
                          <button
                            onClick={() => setParsed(null)}
                            className="rounded-lg border border-edge px-4 py-2 text-[12.5px] text-mute transition hover:text-ink"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </Card>

        </div>

        {/* Right rail */}
        <div className="space-y-5">
          <Card className="px-6 py-5" i={1}>
            <div className="mb-4 flex items-center justify-between">
              <CardHeader eyebrow="Portfolios" title="Your portfolios" />
              <button
                onClick={() => createPortfolio()}
                className="flex items-center gap-1 rounded-md border border-edge px-2.5 py-1 text-[11.5px] text-mute transition hover:border-mint/30 hover:text-ink"
              >
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 4 V16 M4 10 H16" />
                </svg>
                New
              </button>
            </div>
            {portfolios.length === 0 ? (
              <div className="text-[12px] text-faint">
                No portfolios yet — import a CSV or load the demo to create one.
              </div>
            ) : (
              <div className="space-y-1.5">
                {portfolios.map((p) => {
                  const active = p.id === activeId;
                  return (
                    <div
                      key={p.id}
                      className={`rounded-lg border px-3 py-2 transition ${
                        active ? "border-mint/30 bg-mint/[0.04]" : "border-edge"
                      }`}
                    >
                      {renaming === p.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                renamePortfolio(p.id, renameValue);
                                setRenaming(null);
                              }
                              if (e.key === "Escape") setRenaming(null);
                            }}
                            className="h-7 min-w-0 flex-1 rounded-md border border-edge bg-white/[0.03] px-2 text-[12px] text-ink outline-none focus:border-edge2"
                          />
                          <button
                            onClick={() => {
                              renamePortfolio(p.id, renameValue);
                              setRenaming(null);
                            }}
                            className="h-7 rounded-md bg-accent px-2.5 text-[11px] font-semibold text-void"
                          >
                            Save
                          </button>
                        </div>
                      ) : confirmDelete === p.id ? (
                        <div className="flex items-center gap-2">
                          <span className="flex-1 text-[12px] text-neg">
                            Delete “{p.name}”?
                          </span>
                          <button
                            onClick={() => {
                              deletePortfolio(p.id);
                              setConfirmDelete(null);
                            }}
                            className="rounded-md bg-neg px-2.5 py-1 text-[11px] font-semibold text-void"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-md border border-edge px-2.5 py-1 text-[11px] text-mute"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-accent">
                            {active && (
                              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 10.5 L8 14.5 L16 5.5" />
                              </svg>
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] text-ink">
                              {p.name}
                              {p.isDemo && (
                                <span className="ml-1.5 rounded border border-warn/30 bg-warn/10 px-1 py-px text-[9px] font-medium text-warn">
                                  Demo
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[10.5px] text-faint">
                              {p.count} {p.count === 1 ? "holding" : "holdings"}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setRenameValue(p.name);
                              setRenaming(p.id);
                            }}
                            title="Rename"
                            className="rounded-md p-1 text-faint transition hover:text-ink"
                          >
                            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M13.5 3.5 L16.5 6.5 L7 16 L4 16 L4 13 Z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setConfirmDelete(p.id)}
                            title="Delete"
                            className="rounded-md p-1 text-faint transition hover:text-neg"
                          >
                            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 5.5 H16 M8 5.5 V4 H12 V5.5 M6 5.5 L6.7 16 H13.3 L14 5.5" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="px-6 py-5" i={2}>
            <CardHeader eyebrow="Cash" title="Cash position" className="mb-4" />
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-faint">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  placeholder={portfolio ? portfolio.cash.toFixed(2) : "0.00"}
                  className="field !pl-7"
                />
              </div>
              <button
                onClick={() => {
                  const v = Number(cashInput);
                  if (Number.isFinite(v) && v >= 0) {
                    setCash(v);
                    setCashInput("");
                  }
                }}
                disabled={!hasData || cashInput === ""}
                className="btn-primary"
              >
                Set
              </button>
            </div>
            <div className="mt-3 font-mono text-[11px] text-faint">
              current: {portfolio ? fmtUSD(portfolio.cash) : "—"} · counts toward
              allocation & dry powder
            </div>
          </Card>

          <Card className="px-6 py-5" i={3}>
            <CardHeader eyebrow="Quick actions" title="Data controls" className="mb-4" />
            <div className="space-y-2.5">
              <button
                onClick={() => {
                  loadDemo();
                  router.push("/");
                }}
                className="w-full rounded-lg border border-edge bg-void/40 px-4 py-2.5 text-left text-[13px] text-ink transition hover:border-mint/30"
              >
                <span className="font-medium">Load demo portfolio</span>
                <span className="mt-0.5 block text-[11px] text-faint">
                  13 positions seeded from a real Roth IRA
                  {isDemo && " · currently loaded"}
                </span>
              </button>
              <a
                href="/sample-portfolio.csv"
                download
                className="block w-full rounded-lg border border-edge bg-void/40 px-4 py-2.5 text-left text-[13px] text-ink transition hover:border-mint/30"
              >
                <span className="font-medium">Download sample CSV</span>
                <span className="mt-0.5 block text-[11px] text-faint">
                  template with the exact expected format
                </span>
              </a>
              <button
                onClick={downloadCurrent}
                disabled={!hasData}
                className="w-full rounded-lg border border-edge bg-void/40 px-4 py-2.5 text-left text-[13px] text-ink transition enabled:hover:border-mint/30 disabled:opacity-40"
              >
                <span className="font-medium">Export current portfolio</span>
                <span className="mt-0.5 block text-[11px] text-faint">
                  CSV incl. cash row — re-importable backup
                </span>
              </button>
              {!confirmClear ? (
                <button
                  onClick={() => setConfirmClear(true)}
                  disabled={!activeId}
                  className="w-full rounded-lg border border-edge bg-void/40 px-4 py-2.5 text-left text-[13px] text-neg/90 transition enabled:hover:border-neg/40 disabled:opacity-40"
                >
                  <span className="font-medium">Delete active portfolio</span>
                  <span className="mt-0.5 block text-[11px] text-faint">
                    removes “{activeName}” — other portfolios stay
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-neg/40 bg-neg/[0.06] px-4 py-2.5">
                  <span className="flex-1 text-[12px] text-neg">
                    Delete “{activeName}”?
                  </span>
                  <button
                    onClick={() => {
                      if (activeId) deletePortfolio(activeId);
                      setConfirmClear(false);
                    }}
                    className="rounded-md bg-neg px-3 py-1 text-[12px] font-semibold text-void"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="rounded-md border border-edge px-3 py-1 text-[12px] text-mute"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
