/**
 * Single-key navigation chords (§39) — Linear-style `g` then a letter jumps
 * straight to a route. Shared so the shell's key handler, the keyboard map, and
 * the command palette's empty state all read from one list. Keys are mnemonic
 * and unique; the leader `g` is handled in AppShell.
 */
export interface NavChord {
  /** The second key, pressed after the `g` leader. */
  key: string;
  href: string;
  label: string;
}

export const NAV_CHORDS: NavChord[] = [
  { key: "o", href: "/", label: "Overview" },
  { key: "i", href: "/intelligence", label: "Intelligence" },
  { key: "k", href: "/risk", label: "Risk" },
  { key: "r", href: "/research", label: "Research" },
  { key: "d", href: "/dividends", label: "Dividends" },
  { key: "b", href: "/rebalance", label: "Rebalance" },
  { key: "m", href: "/market", label: "Market Analysis" },
  { key: "q", href: "/quality", label: "Quality" },
  { key: "f", href: "/benchmark", label: "Benchmark & Factors" },
  { key: "c", href: "/correlation", label: "Correlation" },
  { key: "s", href: "/scenarios", label: "Scenarios" },
  { key: "n", href: "/montecarlo", label: "Monte Carlo" },
];
