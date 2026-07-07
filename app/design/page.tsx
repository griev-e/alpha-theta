import { notFound } from "next/navigation";
import { DesignGallery } from "./DesignGallery";

/**
 * §124 — the design gallery. A dev-only route (`/design`) that renders the
 * system's primitives, charts, and states live, so the whole design language
 * is inspectable in one place. Not in the nav; reachable by URL. 404s in
 * production so it never ships to users.
 */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignGallery />;
}
