/** vega nav icons — same hand-drawn minimal line set as the alpha/theta
    icons: 20×20 viewBox, stroke inherits currentColor. */

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** The cockpit — a gauge mid-sweep. */
export const IconCockpit = () => (
  <svg {...base}>
    <path d="M3.2 13.5 a7 7 0 0 1 13.6 0" />
    <path d="M10 12.8 L13.4 8.2" />
    <circle cx="10" cy="13.5" r="1.3" />
    <path d="M3.4 16.5 H16.6" opacity="0.5" />
  </svg>
);

/** Candlesticks. */
export const IconCandles = () => (
  <svg {...base}>
    <path d="M5 3.4 V6" opacity="0.6" />
    <rect x="3.6" y="6" width="2.8" height="6" rx="0.7" />
    <path d="M5 12 V15" opacity="0.6" />
    <path d="M10.5 5 V7.6" opacity="0.6" />
    <rect x="9.1" y="7.6" width="2.8" height="4.4" rx="0.7" />
    <path d="M10.5 12 V16.6" opacity="0.6" />
    <path d="M16 2.8 V5.2" opacity="0.6" />
    <rect x="14.6" y="5.2" width="2.8" height="7.2" rx="0.7" />
    <path d="M16 12.4 V14.4" opacity="0.6" />
  </svg>
);

/** The scanner — a radar sweep with a hot contact. */
export const IconScanner = () => (
  <svg {...base}>
    <circle cx="10" cy="10" r="7.2" />
    <circle cx="10" cy="10" r="3.6" opacity="0.45" />
    <path d="M10 10 L15.2 5.4" />
    <circle cx="12.9" cy="12.5" r="1.15" fill="currentColor" stroke="none" />
  </svg>
);

/** The journal — a ledger page with entries. */
export const IconJournal = () => (
  <svg {...base}>
    <rect x="4" y="3" width="12" height="14" rx="1.8" />
    <path d="M7.2 7 H12.8" />
    <path d="M7.2 10 H12.8" opacity="0.6" />
    <path d="M7.2 13 H10.6" opacity="0.6" />
  </svg>
);

/** Performance — an equity curve stepping up. */
export const IconPerformance = () => (
  <svg {...base}>
    <path d="M3 16.5 V3.5" opacity="0.55" />
    <path d="M3 16.5 H16.8" opacity="0.55" />
    <path d="M4.5 13.5 L8 10.5 L10.5 12 L15.5 5.5" />
    <path d="M12.6 5.5 H15.5 V8.4" />
  </svg>
);

/** Risk — a shield with a center line. */
export const IconShield = () => (
  <svg {...base}>
    <path d="M10 2.8 L16 5 V9.6 C16 13.6 13.5 16.2 10 17.4 C6.5 16.2 4 13.6 4 9.6 V5 Z" />
    <path d="M10 6.5 V10.5" />
    <circle cx="10" cy="13" r="0.4" fill="currentColor" stroke="none" />
  </svg>
);

/** The Edge Engine — a turbine hub with a needle mid-sweep. */
export const IconEngine = () => (
  <svg {...base}>
    <circle cx="10" cy="10" r="7.2" strokeDasharray="2.4 2.6" opacity="0.55" />
    <circle cx="10" cy="10" r="4.2" />
    <path d="M10 10 L12.6 6.6" />
    <circle cx="10" cy="10" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

