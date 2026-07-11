import type { Metadata } from "next";

// Overrides the root "alpha" metadata for every /vega route: the browser tab
// reads "vega" and the favicon swaps to vega's mark (app/vega/icon.svg is
// picked up by the file convention for this segment). The VegaProvider that
// backs these routes is mounted in AppShell's /vega delegation.
export const metadata: Metadata = {
  title: "vega",
  description:
    "Day trading terminal — intraday charts, momentum scanner, risk manager, and trade journal analytics.",
};

export default function VegaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
