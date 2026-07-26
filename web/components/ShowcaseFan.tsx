import Link from "next/link";
import { SHOWCASE } from "../lib/showcase";
import { PlayerCard } from "./PlayerCard";

/**
 * The hero spread — four pre-scouted cards fanned FUT-style, each linking to its
 * own /[username] page. Server component, zero client JS: static JSON in, links
 * out. Every card renders in its default first-paint state (the YOU segment);
 * there's no format toggle on the landing page.
 *
 * Nothing here styles the card FACE. The slot wrapper carries the fan transform
 * (rotation / offset / scale) and the inner wrapper carries the float, so the
 * two transforms can't clobber each other. All of it is tunable from the
 * .gc-fan block in globals.css.
 */
export function ShowcaseFan() {
  return (
    <div className="gc-fan">
      {SHOWCASE.map((c, i) => (
        <Link
          key={c.login}
          href={`/${c.login}`}
          data-slot={i}
          className="gc-fan-slot"
          aria-label={`Scouting card for ${c.login} — overall ${c.face.ovr}`}
        >
          <div className="gc-fan-float">
            <PlayerCard face={c.face} avatarUrl={c.avatar} />
          </div>
        </Link>
      ))}
    </div>
  );
}
