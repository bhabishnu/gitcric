/**
 * Cricket scoring contract — a re-axing of GitFut's football engine. Same
 * signal set, same pipeline (raw → z-score → tension → spike → weighted OVR →
 * legacy gate); the six axes are cricket's, and the OVR lands on the SAME
 * compressed 40–99 scale the cricketer DB uses (peak cap 88 + legacy band 11).
 */

/** The exact GitHub signals GitFut scouts (verbatim field set). */
export interface Signals {
  login: string;
  name: string;
  avatarUrl: string;
  location: string | null;
  followers: number;
  account_age_years: number;
  public_repos: number;
  total_stars_owned: number;
  max_repo_stars: number;
  /** Per-repo star counts (owned, non-fork) — drives ECO's focus/concentration. */
  repo_stars: number[];
  languages: number;
  rankedLanguages: string[];
  topLanguage: string | null;
  recent_contributions: number;
  active_days_recent: number;
  active_years: number;
  total_contributions_lifetime: number;
  prs_to_others: number;
  prs_merged_lifetime: number;
  prs_opened_lifetime: number;
  reviews: number;
  issues_closed: number;
  recent_commits: number;
  recent_spike: boolean;
}

/** The six FUT-style cricket axes (shared with the cricketer DB). */
export type StatKey = "BAT" | "POW" | "BWL" | "ECO" | "FLD" | "IMP";
export type Stats = Record<StatKey, number>;
export type Profile = Record<StatKey, number>;

/** Shape family → drives OVR weighting and the role label. */
export type Family = "Batting" | "Bowling" | "AllRound";
export type Role = "batter" | "bowler" | "allrounder" | "keeper";

export type Tier = "bronze" | "silver" | "gold" | "immortal";

export interface Archetype {
  key: string;
  name: string;
  /** Cricket-vernacular commentary one-liner. */
  blurb: string;
}

export interface UserCard {
  login: string;
  name: string;
  avatarUrl: string;
  location: string | null;
  stats: Stats;
  role: Role;
  family: Family;
  /** Peak band before the legacy bonus (stats alone, capped at 88). */
  baseOVR: number;
  ovr: number;
  tier: Tier;
  archetype: Archetype;
  /** The selector eyebrow ("IN THE SQUAD" / "CAPTAIN'S PICK" / "GENERATIONAL"). */
  eyebrow: string;
  topLanguage: string | null;
  legacy: number;
  /** Which axis each GitHub metric feeds — for the scout report bars. */
  scout: ScoutLine[];
}

export interface ScoutLine {
  label: string;
  value: string;
  /** 0..1 fill for the bar. */
  fill: number;
  axis: StatKey;
}
