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
    // The wrapper owns the viewport height so <main> can centre on the space
    // that's left; appending the footer to a min-h-dvh main would push the page
    // past the fold and add a scrollbar.
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-14 px-6 py-16 xl:grid xl:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] xl:items-center xl:gap-12 xl:py-0">
        <div>
          <p className="tabular text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
            The scouting report
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-6xl font-[800] uppercase leading-[0.92] tracking-tight sm:text-7xl xl:text-6xl">
            Your GitHub,
            <br />
            as a cricket card.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--color-muted)]">
            We scout your commits, stars, and reviews into a six-stat card — then show
            you the real cricketer of your equal in Tests, ODIs, T20Is and the IPL.
          </p>
          {/* Capped measure: in the two-column layout the 32rem track is already
              narrower than this, but in the stacked layout the field would
              otherwise run the full width of a 1279px viewport. */}
          <div className="mt-8 max-w-xl">
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

      {/* Credit, not navigation — the scoring engine is derived from GitFut.
          See NOTICE for the licence notice this line is the human half of. */}
      <footer className="w-full px-6 pb-5 text-center">
        <p className="tabular text-[11px] text-[var(--color-faint)]">
          Inspired by{" "}
          <a
            href="https://github.com/Younesfdj/gitfut"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-[var(--color-crimson)]"
          >
            GitFut by @Younesfdj
          </a>
        </p>
      </footer>
    </div>
  );
}
