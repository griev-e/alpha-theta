/**
 * The one status dot, rendering the documented status-hue family (see the
 * "Status hue family" block in globals.css). Every "is this signal live"
 * indicator across the shells — the top-bar LIVE dot, the status center, the
 * Overview session ribbon — draws this so a hue means the same thing wherever
 * it appears, instead of each surface hand-rolling its own dot with its own
 * green.
 *
 *   live       feed flowing / market open   green + a pulse ring
 *   info       live but off-hours           sky
 *   stale      needs attention (offline)    amber
 *   idle       inactive / imported          faint
 *   synthetic  illustrative sample data     the app accent, ringed (off-axis)
 */

export type StatusTone = "live" | "info" | "stale" | "idle" | "synthetic";

const TONE: Record<Exclude<StatusTone, "synthetic">, string> = {
  live: "var(--status-live)",
  info: "var(--status-info)",
  stale: "var(--status-stale)",
  idle: "var(--status-idle)",
};

export function StatusDot({
  tone,
  ping,
  accent,
  size = 8,
  className = "",
}: {
  tone: StatusTone;
  /** Pulse ring. Defaults on for `live`; suppressed under reduced motion. */
  ping?: boolean;
  /** Required for `synthetic` — the app accent, e.g. `var(--color-warn)`. */
  accent?: string;
  /** Diameter in px. */
  size?: number;
  className?: string;
}) {
  const synthetic = tone === "synthetic";
  const color = synthetic ? (accent ?? "var(--color-mute)") : TONE[tone];
  // synthetic never pings — it's a static "this is illustrative" marker, not a
  // live feed; a pulse would imply the opposite.
  const showPing = !synthetic && (ping ?? tone === "live");

  return (
    <span
      className={`relative flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {showPing && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full motion-reduce:hidden"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 38%, transparent)` }}
        />
      )}
      <span
        className="relative inline-flex rounded-full"
        style={{
          width: size,
          height: size,
          // synthetic reads softer (a mixed fill) so it never competes with a
          // solid feed-status dot for attention.
          background: synthetic ? `color-mix(in srgb, ${color} 70%, transparent)` : color,
        }}
      />
    </span>
  );
}
