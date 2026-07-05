"use client";

import { useState } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { EditableMoney } from "@/components/theta/EditableMoney";
import { InstitutionLogo } from "@/components/theta/InstitutionLogo";
import { ThetaEmpty, IconButton, TrashIcon } from "@/components/theta/ui";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { ACCOUNT_KIND_LABEL, type Account, type AccountKind } from "@/lib/theta/data";
import { isInvested } from "@/lib/theta/assumptions";
import { ledgerHasData, useTheta } from "@/lib/theta/store";
import { fmtPct, fmtUSD, fmtUSDCompact } from "@/lib/format";
import { PageSkeleton } from "@/components/ui/Skeleton";

type LinkOption = { id: string; name: string; live: boolean };

const KINDS: AccountKind[] = ["checking", "savings", "brokerage", "retirement", "credit", "loan"];

export default function AccountsPage() {
  const {
    ready,
    ledger,
    view,
    updateAccountBalance,
    removeAccount,
    setAccountApr,
    setAccountLimit,
    setAccountLink,
    setAccountKind,
    toggleAccountHidden,
    linkOptions,
  } = useTheta();

  if (!ready) return <PageSkeleton />;
  if (!ledger || !view || !ledgerHasData(ledger)) return <ThetaEmpty page="Accounts" />;

  const accounts = ledger.accounts;
  const assets = accounts.filter((a) => a.balance >= 0);
  const liabilities = accounts.filter((a) => a.balance < 0);
  const hiddenSet = new Set(ledger.hiddenAccounts ?? []);

  const rowProps = {
    onEdit: updateAccountBalance,
    onRemove: removeAccount,
    onSetApr: setAccountApr,
    onSetLimit: setAccountLimit,
    onSetLink: setAccountLink,
    onSetKind: setAccountKind,
    onToggleHidden: toggleAccountHidden,
    hiddenSet,
    linkOptions,
  };

  return (
    <div>
      <PageHeader
        eyebrow="Money"
        title="Accounts"
        description={`${accounts.length} accounts · click any balance to edit, or link an investment account to an alpha portfolio`}
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Card className="px-5 py-4" i={0} hover={false}>
          <Stat label="Assets" value={view.totalAssets} format={fmtUSDCompact} size="sm" toneClass="text-pos" />
        </Card>
        <Card className="px-5 py-4" i={1} hover={false}>
          <Stat label="Liabilities" value={view.totalLiabilities} format={fmtUSDCompact} size="sm" toneClass="text-neg" />
        </Card>
        <Card className="px-5 py-4" i={2} hover={false}>
          <Stat label="Net worth" value={view.netWorth} format={fmtUSDCompact} size="sm" />
        </Card>
      </div>

      {assets.length > 0 && (
        <Card className="mb-5 px-5 py-5" i={3}>
          <CardHeader eyebrow="Assets" title="What you own" className="mb-4" />
          <div className="flex flex-col divide-y divide-edge/60">
            {assets.map((a) => (
              <AccountRow key={a.id} a={a} {...rowProps} />
            ))}
          </div>
        </Card>
      )}

      {liabilities.length > 0 && (
        <Card className="px-5 py-5" i={4}>
          <CardHeader eyebrow="Liabilities" title="What you owe" className="mb-4" />
          <div className="flex flex-col divide-y divide-edge/60">
            {liabilities.map((a) => (
              <AccountRow key={a.id} a={a} {...rowProps} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function AccountRow({
  a,
  onEdit,
  onRemove,
  onSetApr,
  onSetLimit,
  onSetLink,
  onSetKind,
  onToggleHidden,
  hiddenSet,
  linkOptions,
}: {
  a: Account;
  onEdit: (id: string, balance: number) => void;
  onRemove: (id: string) => void;
  onSetApr: (id: string, apr: number | null) => void;
  onSetLimit: (id: string, limit: number | null) => void;
  onSetLink: (id: string, portfolioId: string | null) => void;
  onSetKind: (id: string, kind: AccountKind) => void;
  onToggleHidden: (id: string) => void;
  hiddenSet: Set<string>;
  linkOptions: LinkOption[];
}) {
  const [open, setOpen] = useState(false);
  const liability = a.balance < 0;
  const color = liability ? "var(--color-neg)" : "var(--color-mint)";
  const linkable = isInvested(a.kind) && linkOptions.length > 0;
  const linked = !!a.linkedPortfolioId;
  const hidden = hiddenSet.has(a.id);
  // The settings panel is available for every account now — excluding an
  // account's transactions is a universal control (not just for the accounts
  // that also have a link / APR / credit-limit field).
  const editable = true;

  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <div className="group flex items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <InstitutionLogo institution={a.institution} domain={a.domain} accent={color} size={36} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-medium text-ink">{a.name}</span>
              {linked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-vio/12 px-1.5 py-0.5 text-[10px] text-vio">
                  <span className="h-1 w-1 rounded-full bg-vio" /> alpha
                </span>
              )}
              {hidden && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-faint"
                  title="This account's transactions are excluded from your spending, budgets, and the transactions log."
                >
                  <svg width="9" height="9" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3l14 14M8.5 4.6A6.8 6.8 0 0 1 10 4.4c4 0 7 3.6 8 5.6a13 13 0 0 1-2.2 3M6 6.3C4 7.5 2.7 9 2 10c1 2 4 5.6 8 5.6 1.2 0 2.3-.3 3.3-.8" />
                  </svg>
                  Excluded
                </span>
              )}
            </div>
            <div className="text-[11px] text-faint">
              {a.institution} · {ACCOUNT_KIND_LABEL[a.kind]} ···· {a.mask}
              {liability && ` · ${fmtPct(a.apr ?? 0, 1)} APR${a.apr ? "" : " (default)"}`}
            </div>
          </div>
        </div>

        <div className="hidden w-28 sm:block">
          <Sparkline values={a.trend} height={34} color={color} />
        </div>

        <div className="flex items-center gap-1 text-right text-[14px] text-ink">
          {linked ? (
            <span className="font-mono tnum" title="Live value from the linked alpha portfolio">
              {fmtUSD(a.balance, false)}
            </span>
          ) : (
            <EditableMoney value={a.balance} onCommit={(v) => onEdit(a.id, v)} allowNegative whole={false} />
          )}
          {editable && (
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label="Account settings"
              title="Link / rate settings"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/[0.06] ${open ? "text-ink" : "text-faint hover:text-ink"}`}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="10" cy="10" r="2.2" />
                <path d="M10 3.4V5M10 15v1.6M3.4 10H5M15 10h1.6" opacity="0.7" />
              </svg>
            </button>
          )}
          <span className="opacity-0 transition-opacity group-hover:opacity-100">
            <IconButton label="Remove account" danger onClick={() => onRemove(a.id)}>
              <TrashIcon />
            </IconButton>
          </span>
        </div>
      </div>

      {open && editable && (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-edge bg-white/[0.02] px-4 py-3 text-[12px]">
          <label className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-mute">Account type</span>
            <select
              value={a.kind}
              onChange={(e) => onSetKind(a.id, e.target.value as AccountKind)}
              className="field h-8 cursor-pointer pr-7 text-[12px]"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>{ACCOUNT_KIND_LABEL[k]}</option>
              ))}
            </select>
            <span className="w-full text-[11px] text-faint sm:w-auto sm:flex-1 sm:pl-1">
              Drives the liquid-vs-invested split behind net worth, projection, and your health score.
            </span>
          </label>
          {(linkable || liability || a.kind === "credit") && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {linkable && (
                <label className="flex items-center gap-2">
                  <span className="text-mute">Link to alpha portfolio</span>
                  <select
                    value={a.linkedPortfolioId ?? ""}
                    onChange={(e) => onSetLink(a.id, e.target.value || null)}
                    className="field h-8 cursor-pointer pr-7 text-[12px]"
                  >
                    <option value="">Not linked</option>
                    {linkOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                        {o.live ? " (live)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {liability && (
                <PctEdit label="APR" value={a.apr ?? 0} onCommit={(v) => onSetApr(a.id, v > 0 ? v : null)} />
              )}
              {a.kind === "credit" && (
                <LimitEdit value={a.creditLimit ?? 0} onCommit={(v) => onSetLimit(a.id, v)} />
              )}
            </div>
          )}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-mute">Exclude from transactions</div>
              <p className="mt-0.5 max-w-md text-[11px] leading-relaxed text-faint">
                Keeps this account in net worth, but leaves its transactions — like
                brokerage buys and sells — out of your spending, budgets, cash flow, and
                the transactions log. Applies to future synced activity too.
              </p>
            </div>
            <Toggle on={hidden} onChange={() => onToggleHidden(a.id)} label="Exclude this account's transactions" />
          </div>
        </div>
      )}
    </div>
  );
}

/** A small accessible on/off switch. */
function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        on ? "bg-vio/70" : "bg-white/[0.12]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function PctEdit({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState((value * 100).toFixed(1));
  return (
    <label className="flex items-center gap-2">
      <span className="text-mute">{label}</span>
      <span className="flex items-center gap-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const n = Number(text.replace(/[^0-9.]/g, ""));
            if (Number.isFinite(n)) onCommit(n / 100);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          inputMode="decimal"
          className="field h-8 w-16 text-right font-mono tnum text-[12px]"
        />
        <span className="text-faint">%</span>
      </span>
    </label>
  );
}

function LimitEdit({ value, onCommit }: { value: number; onCommit: (v: number | null) => void }) {
  const [text, setText] = useState(value ? String(Math.round(value)) : "");
  return (
    <label className="flex items-center gap-2">
      <span className="text-mute">Credit limit</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text.replace(/[^0-9.]/g, ""));
          onCommit(Number.isFinite(n) && n > 0 ? n : null);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        inputMode="numeric"
        placeholder="none"
        className="field h-8 w-24 text-right font-mono tnum text-[12px]"
      />
    </label>
  );
}
