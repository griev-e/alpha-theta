import type { ReactNode } from "react";

type Tone = "warn" | "neg" | "info";

const DOT: Record<Tone, string> = {
  warn: "border-warn/70",
  neg: "border-neg/70",
  info: "border-sky/70",
};

const TITLE: Record<Tone, string> = {
  warn: "text-warn",
  neg: "text-neg",
  info: "text-sky",
};

/**
 * The canonical degraded-state banner: a `.panel-tinted` box with a ringed
 * status dot, a mono title, and explanatory body — the shape the coverage-gap
 * and provider-down notices around the app each re-spelled by hand. Honest by
 * construction: the title names what's degraded, `children` says what still
 * works. Pass `onRetry` to surface a retry affordance on the right.
 *
 * `className` carries sibling margins only; the tinted padding is owned here so
 * every degraded surface reads the same.
 */
export function DegradedNotice({
  tone = "warn",
  title,
  children,
  onRetry,
  retryLabel = "Retry",
  className = "",
}: {
  tone?: Tone;
  title: ReactNode;
  children?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div className={`panel-tinted ${tone} px-6 py-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span
          className={`mt-[5px] inline-block h-[7px] w-[7px] shrink-0 rounded-full border ${DOT[tone]}`}
        />
        <div className="min-w-0 flex-1">
          <div className={`font-mono text-[12px] ${TITLE[tone]}`}>{title}</div>
          {children && (
            <div className="mt-1 text-[12.5px] leading-relaxed text-mute">
              {children}
            </div>
          )}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 self-center rounded-md border border-edge px-2.5 py-1 font-mono text-[11px] text-mute transition-colors hover:text-ink"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
