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
 * Sources are loaded in order; later sources OVERRIDE earlier ones for the same
 * (player, format). The curated seed ships in-repo; drop a fuller Kaggle export
 * at data/historical/careers.csv (with a columnMap here) to supersede it later.
 */
export const HISTORICAL_SOURCES: HistoricalSource[] = [
  { path: join(__dirname, "..", "pipeline", "historical", "careers.seed.csv") },
  // Example for a future Kaggle export (uncomment + adjust headers when present):
  // {
  //   path: join(__dirname, "..", "..", "data", "historical", "careers.csv"),
  //   columnMap: { name: "Player", cricinfoId: "cricinfo_id", bucket: "format",
  //     spanStart: "debut", spanEnd: "final", matches: "Mat", innings: "Inn",
  //     notOuts: "NO", runs: "Runs", hundreds: "100", fifties: "50",
  //     ballsBowled: "Balls", runsConceded: "Conc", wickets: "Wkts" },
  // },
];
