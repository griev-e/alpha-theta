"use client";

import { m } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { useTheta } from "@/lib/theta/store";
import { CATEGORIZE_RULES } from "@/lib/theta/categorize";
import { useThetaAssumptions, type ThetaFieldKey } from "@/lib/theta/assumptionsStore";
import { ASSUMPTION_PRESETS } from "@/lib/theta/assumptions";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 ${
        on ? "bg-vio/70" : "bg-white/[0.1]"
      }`}
    >
      <m.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 34 }}
        className="absolute top-1/2 h-[16px] w-[16px] -translate-y-1/2 rounded-full bg-ink shadow"
        style={{ left: on ? 19 : 3 }}
      />
    </button>
  );
}

function Row({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-[13px] text-ink">{title}</div>
        <div className="mt-0.5 text-[12px] text-faint">{desc}</div>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { ledger, isSample } = useTheta();
  const accountCount = ledger?.accounts.length ?? 0;
  const [toggles, setToggles] = useState({
    billReminders: true,
    weeklyDigest: true,
    overspend: true,
    largeCharge: false,
    roundUp: true,
    hideBalances: false,
  });
  const flip = (k: keyof typeof toggles) =>
    setToggles((t) => ({ ...t, [k]: !t[k] }));

  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Preferences for how theta tracks and notifies you."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="px-5 py-5" i={0}>
          <CardHeader eyebrow="Profile" title="Account" className="mb-4" />
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-vio/30 to-sky/20 font-display text-[18px] font-medium text-ink">
              K
            </div>
            <div>
              <div className="text-[14px] font-medium text-ink">Kevin Nguyen</div>
              <div className="text-[12px] text-faint">kevinnguyen313@icloud.com</div>
            </div>
          </div>
          <div className="mt-5 flex flex-col divide-y divide-edge/60 border-t border-edge pt-1">
            <Row title="Base currency" desc="Used across every balance and chart">
              <span className="font-mono text-[12px] text-mute">USD ($)</span>
            </Row>
            <Row title="Hide balances" desc="Blur dollar amounts until you tap">
              <Toggle on={toggles.hideBalances} onClick={() => flip("hideBalances")} />
            </Row>
          </div>
        </Card>

        <Card className="px-5 py-5" i={1}>
          <CardHeader eyebrow="Notifications" title="Alerts" className="mb-4" />
          <div className="flex flex-col divide-y divide-edge/60">
            <Row title="Bill reminders" desc="A nudge before recurring charges hit">
              <Toggle on={toggles.billReminders} onClick={() => flip("billReminders")} />
            </Row>
            <Row title="Weekly digest" desc="Sunday summary of the week's money">
              <Toggle on={toggles.weeklyDigest} onClick={() => flip("weeklyDigest")} />
            </Row>
            <Row title="Overspend warnings" desc="Ping when a budget tips over its limit">
              <Toggle on={toggles.overspend} onClick={() => flip("overspend")} />
            </Row>
            <Row title="Large charge alerts" desc="Flag any single charge over $250">
              <Toggle on={toggles.largeCharge} onClick={() => flip("largeCharge")} />
            </Row>
          </div>
        </Card>

        <Card className="px-5 py-5" i={2}>
          <CardHeader eyebrow="Automation" title="Saving rules" className="mb-4" />
          <div className="flex flex-col divide-y divide-edge/60">
            <Row title="Round-up savings" desc="Round each purchase up and sweep the change">
              <Toggle on={toggles.roundUp} onClick={() => flip("roundUp")} />
            </Row>
            <Row title="Auto-categorize" desc="Sort new transactions by merchant rules">
              <span className="font-mono text-[12px] text-mute">{CATEGORIZE_RULES.length} rules</span>
            </Row>
          </div>
        </Card>

        <Card className="px-5 py-5" i={3}>
          <CardHeader eyebrow="Security & data" title="Privacy" className="mb-4" />
          <div className="flex flex-col divide-y divide-edge/60">
            <Row title="App lock" desc="Shared PIN gate with alpha at the portal">
              <span className="font-mono text-[11px] text-pos">Enabled</span>
            </Row>
            <Row title="Accounts" desc="Balances you track in theta">
              <span className="font-mono text-[12px] text-mute">{accountCount} accounts</span>
            </Row>
            <Row title="Your data" desc="Connect a bank, load the sample, or clear it">
              <Link href="/theta/import" className="font-mono text-[12px] text-vio/80 transition-colors hover:text-vio">
                Manage →
              </Link>
            </Row>
          </div>
          <p className="mt-4 rounded-lg border border-edge bg-white/[0.02] px-3 py-2.5 text-[11.5px] leading-relaxed text-faint">
            {isSample
              ? "theta is showing illustrative sample data. Everything you change is saved to this browser only — nothing is sent anywhere."
              : "Your theta ledger lives in this browser's local storage only — nothing is sent anywhere."}
          </p>
        </Card>
      </div>

      <AssumptionsCard />
    </div>
  );
}

/** Editable, preset-anchored planning assumptions — theta's parallel of alpha's
 *  Benchmark page assumptions. Feeds the projection, goals and debt engines. */
const FIELDS: { key: ThetaFieldKey; label: string; hint: string }[] = [
  { key: "investReturn", label: "Invested return", hint: "Annual nominal return on brokerage / retirement balances" },
  { key: "investVol", label: "Invested volatility", hint: "Annualized swing of invested assets — sets the projection fan width" },
  { key: "cashYield", label: "Cash yield", hint: "Annual yield on checking / savings" },
  { key: "inflation", label: "Inflation", hint: "Used for the real (today's-dollars) projection" },
  { key: "incomeGrowth", label: "Income growth", hint: "Annual rise in take-home pay — grows your contribution capacity" },
  { key: "creditApr", label: "Credit APR (default)", hint: "Fallback rate for credit cards with no rate set" },
  { key: "loanApr", label: "Loan APR (default)", hint: "Fallback rate for loans with no rate set" },
];

function AssumptionsCard() {
  const { assumptions, preset, setField, applyPreset, reset } = useThetaAssumptions();
  const activePreset = ASSUMPTION_PRESETS.find((p) => p.id === preset);

  return (
    <Card className="mt-5 px-5 py-5" i={4}>
      <CardHeader eyebrow="Planning" title="Assumptions" className="mb-3" />

      {/* Preset selector — each anchored to its basis, with a Custom marker when
          the values have been hand-edited away from every preset and a reset
          ghost back to base (mirrors the Benchmark page's provenance, §100). */}
      <div className="flex flex-wrap items-center gap-2">
        {ASSUMPTION_PRESETS.map((p) => {
          const active = preset === p.id;
          return (
            <m.button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              whileTap={{ scale: 0.96 }}
              title={p.blurb}
              className={`relative rounded-lg border px-3 py-1.5 text-[12px] transition-colors ${
                active
                  ? "border-vio/40 text-vio"
                  : "border-edge bg-panel text-mute hover:border-edge2 hover:text-ink"
              }`}
            >
              {active && (
                <m.span
                  layoutId="theta-preset-active"
                  className="absolute inset-0 -z-0 rounded-lg bg-vio/[0.08]"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative z-10">{p.label}</span>
            </m.button>
          );
        })}
        <m.span
          animate={{ opacity: preset === null ? 1 : 0.55 }}
          className={`rounded-lg border px-3 py-1.5 text-[12px] ${
            preset === null
              ? "border-warn/35 bg-warn/[0.07] text-warn"
              : "border-transparent text-faint"
          }`}
        >
          Custom
        </m.span>
        <button
          type="button"
          onClick={reset}
          className="ml-auto font-mono text-[11px] text-faint underline decoration-dotted underline-offset-2 transition-colors hover:text-mute"
        >
          Reset to base
        </button>
      </div>

      <p className="mb-4 mt-3 text-[12px] leading-relaxed text-faint">
        The forward inputs behind the projection, goal-feasibility and debt
        engines — editable views, not facts.{" "}
        {activePreset
          ? `Currently "${activePreset.label}" — ${activePreset.blurb}`
          : "Hand-edited from a preset."}
      </p>
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-4 border-b border-edge/60 py-3">
            <div className="min-w-0">
              <div className="text-[13px] text-ink">{f.label}</div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-faint">{f.hint}</div>
            </div>
            <PercentField key={`${f.key}-${assumptions[f.key]}`} value={assumptions[f.key]} onCommit={(v) => setField(f.key, v)} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** A percent input storing a fraction (7% ⇄ 0.07). Commits on blur / Enter. */
function PercentField({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState((value * 100).toFixed(1));
  const commit = () => {
    const n = Number(text.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n)) onCommit(n / 100);
  };
  return (
    <div className="flex shrink-0 items-center gap-1">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        inputMode="decimal"
        className="field h-8 w-16 text-right font-mono tnum text-[13px]"
      />
      <span className="text-[12px] text-faint">%</span>
    </div>
  );
}
