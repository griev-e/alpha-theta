/**
 * A drawn up/down triangle — the crisp replacement for the "▲"/"▼" text glyphs,
 * which rasterize inconsistently across platforms and fonts. Inherits
 * `currentColor`, so it takes the tone class (pos/neg) of whatever wraps it.
 */
export function DeltaArrow({
  up,
  size = 8,
  className = "",
}: {
  up: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      aria-hidden
      className={`inline-block ${className}`}
      style={{ verticalAlign: "middle" }}
    >
      <path
        d={up ? "M4 1.2 L7 6.2 L1 6.2 Z" : "M4 6.8 L1 1.8 L7 1.8 Z"}
        fill="currentColor"
      />
    </svg>
  );
}
