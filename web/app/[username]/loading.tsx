export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <p className="tabular text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
        Scouting the profile
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-[700] uppercase tracking-tight">
        Reading the tape…
      </h1>
      <div className="mx-auto mt-6 h-1 w-40 overflow-hidden rounded-full bg-[var(--color-hairline)]">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--color-crimson)]" />
      </div>
    </main>
  );
}
