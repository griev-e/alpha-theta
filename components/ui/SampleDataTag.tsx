/**
 * The honest "this isn't your real data" tag, shared by both shells so the
 * disclosure reads identically across the two apps — a ringed status dot plus a
 * tracked-mono label in the machine/status voice (see the eyebrow dialect note
 * in globals.css). Only the accent changes per app: alpha's demo book is amber,
 * theta's sample ledger violet.
 */
export function SampleDataTag({
  accent,
  label,
  className = "",
}: {
  /** A CSS color, e.g. `var(--color-warn)`. */
  accent: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.08em] ${className}`}
      style={{ color: `color-mix(in srgb, ${accent} 80%, transparent)` }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: `color-mix(in srgb, ${accent} 70%, transparent)` }}
      />
      {label}
    </span>
  );
}
