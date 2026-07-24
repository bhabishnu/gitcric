/**
 * C7 — flags. The artwork is a real asset set (flag-icons v7, MIT, 4x3), baked
 * into flags.data.ts by scripts/gen-flags.ts; the hand-drawn approximations this
 * replaced were wrong often enough to be a bug (Nepal rendered as a red block,
 * i.e. Morocco). Cricketers: keyed on derived nation. GitHub users: best-effort
 * parse of the profile location, shown ONLY on a confident country match.
 */
import { FLAG_ASSETS } from "./flags.data";

export type FlagCode =
  | "IN" | "AU" | "EN" | "PK" | "ZA" | "WI" | "NZ" | "LK" | "BD" | "ZW" | "IE" | "AF"
  | "SC" | "NL" | "NA" | "NP" | "AE" | "OM" | "US" | "CA" | "PG" | "KE";

const NATION_TO_CODE: Record<string, FlagCode> = {
  India: "IN", Australia: "AU", England: "EN", Pakistan: "PK", "South Africa": "ZA",
  "West Indies": "WI", "New Zealand": "NZ", "Sri Lanka": "LK", Bangladesh: "BD",
  Zimbabwe: "ZW", Ireland: "IE", Afghanistan: "AF", Scotland: "SC", Netherlands: "NL",
  Namibia: "NA", Nepal: "NP", "United Arab Emirates": "AE", Oman: "OM",
  "United States of America": "US", Canada: "CA", "Papua New Guinea": "PG", Kenya: "KE",
};

export function flagForNation(nation: string | null): FlagCode | null {
  return nation ? NATION_TO_CODE[nation] ?? null : null;
}

/** Best-effort GitHub location → country. Conservative: unmatched → null. */
export function flagForLocation(location: string | null): FlagCode | null {
  if (!location) return null;
  const s = ` ${location.toLowerCase()} `;
  const has = (...w: string[]) => w.some((x) => s.includes(x));
  if (has("india", "bengaluru", "bangalore", "mumbai", "delhi", "hyderabad", "chennai", "pune", "kolkata")) return "IN";
  if (has("pakistan", "karachi", "lahore", "islamabad")) return "PK";
  if (has("bangladesh", "dhaka")) return "BD";
  if (has("sri lanka", "colombo")) return "LK";
  if (has("nepal", "kathmandu")) return "NP";
  if (has("australia", "sydney", "melbourne", "brisbane", "perth")) return "AU";
  if (has("new zealand", "auckland", "wellington")) return "NZ";
  if (has("scotland", "edinburgh", "glasgow")) return "SC";
  if (has("ireland", "dublin")) return "IE";
  if (has("netherlands", "amsterdam", "holland")) return "NL";
  if (has("south africa", "johannesburg", "cape town")) return "ZA";
  if (has("canada", "toronto", "vancouver", "montreal")) return "CA";
  if (has("united arab emirates", " uae ", "dubai", "abu dhabi")) return "AE";
  if (has("england", "london", "manchester", "united kingdom", " uk ", "britain", "leeds", "bristol")) return "EN";
  if (has("united states", " usa ", " u.s.", "america", "new york", "san francisco", "seattle", "boston", "austin", "california", " ca ", " ny ", " tx ", "washington", "portland", "oregon", "chicago", "los angeles", "denver", "atlanta")) return "US";
  return null;
}

// ── rendering ───────────────────────────────────────────────────────────────

/**
 * A flag at its TRUE proportions. Every asset is drawn with `meet` (never
 * `slice`/stretch) inside its own box, so nothing is cropped or distorted —
 * which is the whole point of Nepal, whose asset box is the pennant's real
 * ~377:480 shape rather than a 4:3 rectangle. The card gives the element a
 * neutral plate to sit on, so a non-rectangular flag reads as itself instead of
 * as a mystery gap.
 */
export function Flag({ code, className }: { code: FlagCode | null; className?: string }) {
  if (!code) return null;
  const asset = FLAG_ASSETS[code];
  if (!asset) return null;
  return (
    <svg
      viewBox={asset.viewBox}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${asset.name} flag`}
      // The asset markup is generated at build time from a vendored library —
      // never user input.
      dangerouslySetInnerHTML={{ __html: asset.inner }}
    />
  );
}
