import type { FormatBucket } from "../types/stats.js";

/**
 * Competition registry. Adding a new league later is a ONE-LINE entry here.
 *
 * The format bucket is decided by the SOURCE COMPETITION (which zip), NOT by
 * match_type — IPL and T20Is are both "T20" but are SEPARATE buckets with
 * SEPARATE percentile populations. A player therefore gets a distinct IPL card
 * and T20I card.
 */
export interface CompetitionConfig {
  /** Cricsheet download key; the zip is `${key}_json.zip`. */
  formatBucket: FormatBucket;
  displayLabel: string;
  /** Hard qualification gate (min matches) for a card in this bucket. */
  qualifyingMatches: number;
  /** Filename of the Cricsheet zip. */
  zip: string;
}

export const COMPETITIONS: Record<string, CompetitionConfig> = {
  tests: { formatBucket: "test", displayLabel: "Test", qualifyingMatches: 8, zip: "tests_json.zip" },
  odis: { formatBucket: "odi", displayLabel: "ODI", qualifyingMatches: 17, zip: "odis_json.zip" },
  t20s: { formatBucket: "t20i", displayLabel: "T20I", qualifyingMatches: 25, zip: "t20s_json.zip" },
  ipl: { formatBucket: "ipl", displayLabel: "IPL", qualifyingMatches: 20, zip: "ipl_json.zip" },
  // Add a league later, e.g.:
  // bbl: { formatBucket: "bbl", displayLabel: "Big Bash", qualifyingMatches: 20, zip: "bbl_json.zip" },
};

export const CRICSHEET_BASE = "https://cricsheet.org/downloads";
export const PEOPLE_REGISTER_URL = "https://cricsheet.org/register/people.csv";

/** Per-bucket qualification gate, derived from the competition registry. */
export const GATES: Record<FormatBucket, number> = Object.fromEntries(
  Object.values(COMPETITIONS).map((c) => [c.formatBucket, c.qualifyingMatches]),
) as Record<FormatBucket, number>;

export const ALL_BUCKETS: FormatBucket[] = [...new Set(Object.values(COMPETITIONS).map((c) => c.formatBucket))];
