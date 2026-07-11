"use client";

import { useState } from "react";

/**
 * The "focus a symbol" affordance shared by the chart and engine page
 * headers — one home so symbol handling can't drift between pages. The
 * store's setFocus already normalizes (trim/uppercase/charset) via
 * cleanSymbol; this just owns the input state and clears it on submit.
 */
export function SymbolForm({
  onSubmit,
  buttonLabel,
}: {
  onSubmit: (raw: string) => void;
  buttonLabel: string;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onSubmit(value);
        setValue("");
      }}
      className="flex items-center gap-2"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Symbol…"
        aria-label="Focus a symbol"
        className="field h-8 w-28 uppercase"
      />
      <button type="submit" className="btn-secondary h-8">
        {buttonLabel}
      </button>
    </form>
  );
}
