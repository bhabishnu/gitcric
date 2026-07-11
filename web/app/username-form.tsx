"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UsernameForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const clean = value.trim().replace(/^@/, "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (clean) router.push(`/${encodeURIComponent(clean)}`);
      }}
      className="flex items-stretch gap-2"
    >
      <div className="flex flex-1 items-center rounded-md border border-[var(--color-hairline)] bg-[var(--color-panel)] px-3 transition-colors focus-within:border-[var(--color-crimson)]">
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
        disabled={!clean}
        className="pressable rounded-md border border-[var(--color-hairline)] bg-[var(--color-panel-2)] px-5 text-sm font-medium text-[var(--color-text)] disabled:opacity-40"
      >
        Scout me
      </button>
    </form>
  );
}
