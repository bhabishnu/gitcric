"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-4xl font-[800] uppercase tracking-tight">
        Innings interrupted
      </h1>
      <p className="mt-3 text-[15px] text-[var(--color-muted)]">
        We couldn&apos;t scout that profile just now — GitHub may be rate-limiting the scout.
        Give it a moment and try again.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <button
          onClick={reset}
          className="pressable rounded-md border border-[var(--color-hairline)] bg-[var(--color-panel-2)] px-5 py-2.5 text-sm font-medium"
        >
          Retry
        </button>
        <Link
          href="/"
          className="pressable rounded-md border border-[var(--color-hairline)] px-5 py-2.5 text-sm font-medium text-[var(--color-muted)]"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
