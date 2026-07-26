import Link from "next/link";
import { UsernameForm } from "./username-form";
import { ShowcaseFan } from "../components/ShowcaseFan";

/** Secondary entry points — one tap to a card, for anyone not ready to type
 *  their own handle. GitHub logins are case-insensitive; the route canonicalises. */
const TRY = ["soumith", "theprimeagen"];

export default function Home() {
  // No overflow clipping on <main>: the fan is a transform, so it can spill past
  // the 6xl column without affecting layout — and clipping would cut the outer
  // cards off the moment the spread is widened in .gc-fan.
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col justify-center gap-14 px-6 py-16 lg:grid lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:py-0">
      <div>
        <p className="tabular text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
          The scouting report
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-6xl font-[800] uppercase leading-[0.92] tracking-tight sm:text-7xl lg:text-6xl">
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
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="tabular text-[11px] uppercase tracking-[0.16em] text-[var(--color-faint)]">
            or try
          </span>
          {TRY.map((login) => (
            <Link key={login} href={`/${login}`} className="gc-chip tabular">
              @{login}
            </Link>
          ))}
        </div>
      </div>

      <ShowcaseFan />
    </main>
  );
}
