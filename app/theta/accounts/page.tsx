"use client";

import { useState } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { EditableMoney } from "@/components/theta/EditableMoney";
import { InstitutionLogo } from "@/components/theta/InstitutionLogo";
import { ThetaEmpty, IconButton, TrashIcon } from "@/components/theta/ui";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { ACCOUNT_KIND_LABEL, type Account } from "@/lib/theta/data";
import { isInvested } from "@/lib/theta/assumptions";
import { ledgerHasData, useTheta } from "@/lib/theta/store";
import { fmtPct, fmtUSD, fmtUSDCompact } from "@/lib/format";

type LinkOption = { id: string; name: string; live: boolean };

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
    linkOptions,
  } = useTheta();

  if (!ready) return null;
  if (!ledger || !view || !ledgerHasData(ledger)) return <ThetaEmpty page="Accounts" />;

  const accounts = ledger.accounts;
  const assets = accounts.filter((a) => a.balance >= 0);
  const liabilities = accounts.filter((a) => a.balance < 0);

  const rowProps = {
    onEdit: updateAccountBalance,
    onRemove: removeAccount,
    onSetApr: setAccountApr,
    onSetLimit: setAccountLimit,
    onSetLink: setAccountLink,
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
  linkOptions,
}: {
  a: Account;
  onEdit: (id: string, balance: number) => void;
  onRemove: (id: string) => void;
  onSetApr: (id: string, apr: number | null) => void;
  onSetLimit: (id: string, limit: number | null) => void;
  onSetLink: (id: string, portfolioId: string | null) => void;
  linkOptions: LinkOption[];
}) {
  const [open, setOpen] = useState(false);
  const liability = a.balance < 0;
  const color = liability ? "var(--color-neg)" : "var(--color-mint)";
  const linkable = isInvested(a.kind) && linkOptions.length > 0;
  const editable = liability || linkable || a.kind === "credit";
  const linked = !!a.linkedPortfolioId;

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
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-edge bg-white/[0.02] px-4 py-3 text-[12px]">
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
    </div>
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
