import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DB } from "../db/db.js";
import type { FormatBucket } from "../types/stats.js";
import { COMPETITIONS } from "../config/competitions.js";
import { GENDERS } from "../config/calibration.js";
import { extractedDir } from "./download.js";
import { parseMatch, type PlayerDelta } from "./parse.js";

/** Mutable per-(player, bucket) accumulator. */
export interface RawAgg {
  playerId: string;
  bucket: FormatBucket;
  gender: string;
  matches: number;
  batInnings: number;
  runs: number;
  ballsFaced: number;
  dismissals: number;
  notOuts: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  fourFers: number;
  fiveFers: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  firstDate: string;
  lastDate: string;
}

export type AggMap = Map<string, RawAgg>;

const key = (playerId: string, bucket: FormatBucket) => `${playerId}|${bucket}`;

function blank(playerId: string, bucket: FormatBucket, gender: string): RawAgg {
  return {
    playerId,
    bucket,
    gender,
    matches: 0,
    batInnings: 0,
    runs: 0,
    ballsFaced: 0,
    dismissals: 0,
    notOuts: 0,
    fours: 0,
    sixes: 0,
    fifties: 0,
    hundreds: 0,
    ballsBowled: 0,
    runsConceded: 0,
    wickets: 0,
    fourFers: 0,
    fiveFers: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0,
    firstDate: "",
    lastDate: "",
  };
}

function applyDelta(agg: RawAgg, d: PlayerDelta): void {
  agg.matches += d.matches;
  agg.batInnings += d.batInnings;
  agg.runs += d.runs;
  agg.ballsFaced += d.ballsFaced;
  agg.dismissals += d.dismissals;
  agg.notOuts += d.notOuts;
  agg.fours += d.fours;
  agg.sixes += d.sixes;
  agg.fifties += d.fifties;
  agg.hundreds += d.hundreds;
  agg.ballsBowled += d.ballsBowled;
  agg.runsConceded += d.runsConceded;
  agg.wickets += d.wickets;
  agg.fourFers += d.fourFers;
  agg.fiveFers += d.fiveFers;
  agg.catches += d.catches;
  agg.stumpings += d.stumpings;
  agg.runOuts += d.runOuts;
  if (d.date) {
    if (!agg.firstDate || d.date < agg.firstDate) agg.firstDate = d.date;
    if (!agg.lastDate || d.date > agg.lastDate) agg.lastDate = d.date;
  }
}

/** Load existing raw counters from the DB so re-runs accumulate incrementally. */
function loadExisting(db: DB): AggMap {
  const map: AggMap = new Map();
  const rows = db
    .prepare(
      `SELECT player_id, format_bucket, matches, bat_innings, runs, balls_faced, dismissals, not_outs,
              fours, sixes, fifties, hundreds, balls_bowled, runs_conceded, wickets, four_fers, five_fers,
              catches, stumpings, run_outs, first_date, last_date FROM player_format_stats`,
    )
    .all() as any[];
  for (const r of rows) {
    const genderRow = db.prepare("SELECT gender FROM players WHERE id = ?").get(r.player_id) as any;
    const a = blank(r.player_id, r.format_bucket, genderRow?.gender ?? "male");
    a.matches = r.matches;
    a.batInnings = r.bat_innings;
    a.runs = r.runs;
    a.ballsFaced = r.balls_faced;
    a.dismissals = r.dismissals;
    a.notOuts = r.not_outs;
    a.fours = r.fours;
    a.sixes = r.sixes;
    a.fifties = r.fifties;
    a.hundreds = r.hundreds;
    a.ballsBowled = r.balls_bowled;
    a.runsConceded = r.runs_conceded;
    a.wickets = r.wickets;
    a.fourFers = r.four_fers;
    a.fiveFers = r.five_fers;
    a.catches = r.catches;
    a.stumpings = r.stumpings;
    a.runOuts = r.run_outs;
    a.firstDate = r.first_date ?? "";
    a.lastDate = r.last_date ?? "";
    map.set(key(r.player_id, r.format_bucket), a);
  }
  return map;
}

/**
 * Stages 2 + 3 — parse each NEW match once and fold its deltas into the running
 * per-(player, bucket) aggregate. Incremental: matches already in
 * processed_matches are skipped. Returns the full aggregate map.
 */
export function aggregate(db: DB): AggMap {
  const map = loadExisting(db);
  const seen = new Set(
    (db.prepare("SELECT match_id, format_bucket FROM processed_matches").all() as any[]).map(
      (r) => `${r.match_id}|${r.format_bucket}`,
    ),
  );
  const markProcessed = db.prepare(
    "INSERT OR IGNORE INTO processed_matches (match_id, format_bucket, ingested_at) VALUES (?, ?, ?)",
  );
  const now = new Date(0).toISOString(); // deterministic; overwritten per-run in run.ts meta

  let parsed = 0;
  let skipped = 0;
  for (const [compKey, cfg] of Object.entries(COMPETITIONS)) {
    const dir = extractedDir(compKey);
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    } catch {
      console.warn(`[aggregate] no extracted dir for ${compKey}; run download first`);
      continue;
    }
    console.log(`[aggregate] ${compKey}: ${files.length} files`);
    for (const file of files) {
      const matchId = file.replace(/\.json$/, "");
      if (seen.has(`${matchId}|${cfg.formatBucket}`)) {
        skipped++;
        continue;
      }
      let json: unknown;
      try {
        json = JSON.parse(readFileSync(join(dir, file), "utf8"));
      } catch {
        continue; // corrupt/partial file — skip gracefully
      }
      const result = parseMatch(json, cfg.formatBucket, GENDERS);
      // Mark processed even when filtered out (wrong gender) so re-runs skip it.
      markProcessed.run(matchId, cfg.formatBucket, now);
      if (!result) continue;
      for (const d of result.deltas) {
        const k = key(d.playerId, cfg.formatBucket);
        let a = map.get(k);
        if (!a) {
          a = blank(d.playerId, cfg.formatBucket, d.gender);
          map.set(k, a);
        }
        applyDelta(a, d);
      }
      parsed++;
    }
  }
  console.log(`[aggregate] parsed ${parsed} new matches, skipped ${skipped} already-processed`);
  return map;
}
