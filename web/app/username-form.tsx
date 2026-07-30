"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UsernameForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  // The scout is a server round-trip that can take a second or two, so the
  // button has to acknowledge the press rather than sit there looking unclicked.
  const [busy, setBusy] = useState(false);
  const clean = value.trim().replace(/^@/, "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!clean || busy) return;
        setBusy(true);
        router.push(`/${encodeURIComponent(clean)}`);
      }}
      className="flex items-stretch gap-2"
    >
      {/* Crimson ring on focus, not just a border colour change — it has to read
          as "you are here" from across the page, matching the CTA beside it. */}
      <div className="gc-field flex flex-1 items-center rounded-md border border-[var(--color-hairline)] bg-[var(--color-panel)] px-3">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="github username"
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full bg-transparent px-1 py-3 text-[15px] text-[var(--color-text)] placeholder:text-[var(--color-faint)] outline-none focus:outline-none focus-visible:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={!clean || busy}
        data-busy={busy ? "" : undefined}
        aria-busy={busy}
        className="gc-cta pressable rounded-md px-5 text-sm"
      >
        <span>{busy ? "Scouting…" : "Scout me"}</span>
      </button>
    </form>
  );
}
