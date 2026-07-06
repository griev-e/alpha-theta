"use client";

import { m } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";
import { PATCH_NOTES } from "@/lib/data/patchNotes";

export default function PatchNotesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Data"
        title="Patch Notes"
        description="What's changed in alpha, release by release."
      />

      {/* The changelog as a timeline: releases hang off a single hairline spine,
          each marked with the serif α as a period stamp. */}
      <div className="relative">
        <div
          aria-hidden
          className="absolute bottom-2 left-[11px] top-3 w-px bg-edge"
        />
        <div className="space-y-8">
          {PATCH_NOTES.map((note, i) => (
            <m.div
              key={note.version}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="relative pl-9"
            >
              {/* period mark — the serif α on the spine */}
              <span
                aria-hidden
                className="absolute left-0 top-0 flex h-[23px] w-[23px] items-center justify-center rounded-full border border-edge bg-panel"
              >
                <span
                  className="text-[13px] italic leading-none text-faint"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  α
                </span>
              </span>

              <div className="flex items-baseline gap-2.5">
                <span className="rounded-md border border-edge2 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[11.5px] font-medium text-ink">
                  v{note.version}
                </span>
                <span className="font-mono text-[11px] text-faint">{note.date}</span>
              </div>
              <h2 className="mt-2 text-[15px] font-medium tracking-[-0.01em] text-ink text-balance">
                {note.title}
              </h2>
              <ul className="mt-3 space-y-1.5">
                {note.changes.map((change) => (
                  <li key={change} className="flex gap-2 text-[13px] leading-relaxed text-mute">
                    <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-faint" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </m.div>
          ))}
        </div>
      </div>
    </div>
  );
}
