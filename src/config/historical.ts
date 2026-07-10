import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FormatBucket } from "../types/stats.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Pre-2000 historical data layer — a SECOND data source, separate from Cricsheet.
 * Cricsheet ball-by-ball starts ~2000, so era-spanning greats are scored on only
 * the tail of their careers. This layer supplies full-career totals and merges
 * the PRE-Cricsheet portion in (see src/pipeline/historical/merge.ts), never
 * double-counting the overlap years.
 */

export const HISTORICAL_ENABLED = true;

/**
 * Only players whose career STARTS before this year are merged — anyone who
 * debuted later has a complete Cricsheet record already, so we never touch them.
 * This is the primary guard protecting modern players from any drift.
 */
export const DEBUT_GATE_YEAR = 2002;

/**
 * When a historical row lacks balls-faced / balls-bowled (older records don't
 * track strike rate), we estimate the missing balls from runs and an era-typical
 * rate so the merged average AND strike rate both stay coherent (adding runs
 * without balls would otherwise inflate SR). Era-relative percentiling downstream
 * further normalises these estimates.
 */
export const ERA_BAT_SR: Record<FormatBucket, number> = { test: 46, odi: 70, t20i: 120, ipl: 125 };
export const ERA_BOWL_ECON: Record<FormatBucket, number> = { test: 2.6, odi: 4.5, t20i: 7.5, ipl: 8 };

/** A column mapping lets a foreign CSV (e.g. a Kaggle dataset) map onto our
 * canonical fields without code changes. `null`/identity map = headers already
 * canonical (our curated seed). */
export interface ColumnMap {
  [canonical: string]: string; // canonicalField -> csvHeader
}

export interface HistoricalSource {
  path: string;
  /** Omit for a CSV whose headers already match the canonical field names. */
  columnMap?: ColumnMap;
}

/**
 * Sources are loaded in order; EARLIER sources take precedence (first-wins), so
 * the curated seed's rows win over any later file's duplicate. Fields the CSV
 * lacks are derived from mapped rate columns (batting avg → innings/dismissals,
 * strike rate → balls faced, bowling avg → runs conceded, economy → balls
 * bowled); spans/stumpings a CSV doesn't carry come from HISTORICAL_META.
 */
export const HISTORICAL_SOURCES: HistoricalSource[] = [
  { path: join(__dirname, "..", "pipeline", "historical", "careers.seed.csv") },
  {
    path: join(__dirname, "..", "..", "data", "historical", "careers.csv"),
    columnMap: {
      name: "Player",
      bucket: "Format",
      matches: "Matches",
      runs: "Runs",
      hundreds: "100s",
      fifties: "50s",
      wickets: "Wickets",
      fiveFers: "5_Wicket_Hauls",
      catches: "Catches",
      // rate columns → the loader derives innings/ballsFaced/runsConceded/ballsBowled.
      battingAvg: "Batting_Avg",
      strikeRate: "Strike_Rate",
      bowlingAvg: "Bowling_Avg",
      economy: "Economy",
      // Highest_Score, Best_Bowling, Sixes intentionally unmapped (ignored).
    },
  },
];

/**
 * Hand-authored per-player metadata for CSV rows that don't carry it: the
 * Cricinfo id (the DEFINITIVE identity key — Cricsheet's initials-names and the
 * dozens of same-surname homonyms make name matching unreliable), career spans
 * (debut/namesake gates + longevity), and the rare keeper's stumpings. Keyed by
 * lowercased player name; only fills what a CSV omits.
 */
export const HISTORICAL_META: Record<
  string,
  {
    cricinfoId?: string;
    spans?: Partial<Record<FormatBucket, [number, number]>>;
    stumpings?: Partial<Record<FormatBucket, number>>;
  }
> = {
  "alec stewart": { cricinfoId: "20372", spans: { test: [1990, 2003], odi: [1989, 2003] }, stumpings: { test: 14, odi: 15 } },
  "allan donald": { cricinfoId: "44716", spans: { test: [1992, 2002], odi: [1991, 2003] } },
  "aravinda de silva": { cricinfoId: "48462", spans: { test: [1984, 2002], odi: [1984, 2003] } },
  "arjuna ranatunga": { cricinfoId: "50244", spans: { test: [1982, 2000], odi: [1982, 2000] } },
  "carl hooper": { cricinfoId: "52066", spans: { test: [1987, 2002], odi: [1987, 2003] } },
  "chris cairns": { cricinfoId: "36597", spans: { test: [1989, 2004], odi: [1991, 2006] } },
  "desmond haynes": { cricinfoId: "52047", spans: { test: [1978, 1994], odi: [1978, 1994] } },
  "gary kirsten": { cricinfoId: "45813", spans: { test: [1993, 2004], odi: [1993, 2003] } },
  "gordon greenidge": { cricinfoId: "51901", spans: { test: [1974, 1991], odi: [1975, 1991] } },
  "graham gooch": { cricinfoId: "13399", spans: { test: [1975, 1995], odi: [1976, 1995] } },
  "hansie cronje": { cricinfoId: "44485", spans: { test: [1992, 2000], odi: [1992, 2000] } },
  "inzamam-ul-haq": { cricinfoId: "40570", spans: { test: [1992, 2007], odi: [1991, 2007] } },
  "jonty rhodes": { cricinfoId: "46973", spans: { test: [1992, 2000], odi: [1992, 2003] } },
  "mark waugh": { cricinfoId: "8189", spans: { test: [1991, 2002], odi: [1988, 2002] } },
  "mohammad azharuddin": { cricinfoId: "26329", spans: { test: [1984, 2000], odi: [1985, 2000] } },
  "saeed anwar": { cricinfoId: "42605", spans: { test: [1990, 2001], odi: [1989, 2003] } },
  "sourav ganguly": { cricinfoId: "28779", spans: { test: [1996, 2008], odi: [1992, 2007] } },
  "stephen fleming": { cricinfoId: "37000", spans: { test: [1994, 2008], odi: [1994, 2007] } },
  "shaun pollock": { cricinfoId: "46774", spans: { test: [1995, 2008], odi: [1996, 2008] } },
};
