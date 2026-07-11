import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-4xl font-[800] uppercase tracking-tight">
        No such player
      </h1>
      <p className="mt-3 text-[15px] text-[var(--color-muted)]">
        We couldn&apos;t find that GitHub username. Check the spelling and try again.
      </p>
      <Link
        href="/"
        className="pressable mx-auto mt-6 rounded-md border border-[var(--color-hairline)] bg-[var(--color-panel-2)] px-5 py-2.5 text-sm font-medium"
      >
        Scout another username
      </Link>
    </main>
  );
}
