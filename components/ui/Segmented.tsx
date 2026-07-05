"use client";

/**
 * Small pill-group toggle — the "Holdings / Sector" switcher shape, reused
 * anywhere a page needs to pick one of a few short-labeled views (chart mode,
 * chart range, …) instead of restating the same bordered button row per page.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex gap-0.5 rounded-md border border-edge p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded px-2 py-0.5 font-mono text-[10.5px] transition-colors ${
            value === o.value
              ? "bg-white/[0.08] text-ink"
              : "text-faint hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
