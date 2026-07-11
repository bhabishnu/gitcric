import { UsernameForm } from "./username-form";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
      <p className="tabular text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
        The scouting report
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-6xl font-[800] uppercase leading-[0.92] tracking-tight sm:text-7xl">
        Your GitHub,
        <br />
        as a cricket card.
      </h1>
      <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--color-muted)]">
        We scout your commits, stars, and reviews into a six-stat card — then show
        you the real cricketer of your equal in Tests, ODIs, T20Is and the IPL.
      </p>
      <div className="mt-8">
        <UsernameForm />
      </div>
    </main>
  );
}
