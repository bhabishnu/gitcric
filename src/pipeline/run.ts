import type { DB } from "../db/db.js";
import { openDb } from "../db/db.js";
import type { LegendAnchor } from "../types/stats.js";
import { download } from "./download.js";
import { aggregate, type AggMap } from "./aggregate.js";
import { loadRegister, type Person } from "./register.js";
import { calibrate, type Calibrated, type Distribution } from "./calibrate.js";
import { mergeHistorical } from "./historical/merge.js";
import { computeOvr, type OvrResult } from "./ovr.js";
import { equate, type EquateResult } from "./equate.js";

const PFS_COLS = [
  "player_id", "format_bucket",
  "matches", "bat_innings", "runs", "balls_faced", "dismissals", "not_outs", "fours", "sixes", "fifties", "hundreds",
  "balls_bowled", "runs_conceded", "wickets", "four_fers", "five_fers",
  "catches", "stumpings", "run_outs",
  "first_date", "last_date", "span_years",
  "bat_avg", "bat_sr", "boundary_pct", "bowl_avg", "economy", "bowl_sr",
  "bat_avg_shrunk", "bat_sr_shrunk", "bowl_sr_shrunk", "economy_shrunk",
  "bat_avg_pct", "bat_sr_pct", "bowl_sr_pct", "economy_pct", "fld_pct", "imp_pct",
  "sample_balls_bat", "sample_balls_bowl",
  "stat_bat", "stat_pow", "stat_bwl", "stat_eco", "stat_fld", "stat_imp",
  "peak_ovr", "greatness_bonus", "longevity_z", "peak_elite_z", "ovr",
  "role", "gated", "equated_legend_id",
];

function persistPlayers(db: DB, map: AggMap, register: Map<string, Person>): void {
  const seen = new Set<string>();
  const stmt = db.prepare("INSERT OR REPLACE INTO players (id, name, cricinfo_id, gender) VALUES (?, ?, ?, ?)");
  const tx = db.transaction(() => {
    for (const agg of map.values()) {
      if (seen.has(agg.playerId)) continue;
      seen.add(agg.playerId);
      const person = register.get(agg.playerId);
      stmt.run(agg.playerId, person?.name ?? agg.playerId, person?.cricinfoId ?? null, agg.gender);
    }
  });
  tx();
}

function persistStats(
  db: DB,
  calibrated: Map<string, Calibrated>,
  ovr: Map<string, OvrResult>,
  equated: Map<string, EquateResult>,
): void {
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO player_format_stats (${PFS_COLS.join(", ")}) VALUES (${PFS_COLS.map(() => "?").join(", ")})`,
  );
  const round2 = (x: number | null | undefined) => (x == null ? null : Math.round(x * 100) / 100);
  const tx = db.transaction(() => {
    for (const [key, c] of calibrated) {
      const a = c.agg;
      const o = ovr.get(key) ?? null;
      const eq = equated.get(key) ?? null;
      stmt.run([
        a.playerId, a.bucket,
        a.matches, a.batInnings, a.runs, a.ballsFaced, a.dismissals, a.notOuts, a.fours, a.sixes, a.fifties, a.hundreds,
        a.ballsBowled, a.runsConceded, a.wickets, a.fourFers, a.fiveFers,
        a.catches, a.stumpings, a.runOuts,
        a.firstDate || null, a.lastDate || null, round2(c.spanYears),
        round2(c.batAvg), round2(c.batSR), round2(c.boundaryPct), round2(c.bowlAvg), round2(c.economy), round2(c.bowlSR),
        round2(c.batAvgShrunk), round2(c.batSRShrunk), round2(c.bowlSRShrunk), round2(c.economyShrunk),
        round2(c.batAvgPct), round2(c.batSRPct), round2(c.bowlSRPct), round2(c.economyPct), round2(c.fldPct), round2(c.impPct),
        c.sampleBallsBat, c.sampleBallsBowl,
        o?.stats.BAT ?? null, o?.stats.POW ?? null, o?.stats.BWL ?? null, o?.stats.ECO ?? null, o?.stats.FLD ?? null, o?.stats.IMP ?? null,
        o?.peakOvr ?? null, o?.greatnessBonus ?? null, o ? round2(o.longevityZ) : null, o ? round2(o.peakElitenessZ) : null, o?.ovr ?? null,
        o?.role ?? null, c.gated ? 1 : 0, eq?.anchorId ?? null,
      ]);
    }
  });
  tx();
}

function persistDistributions(db: DB, distributions: Distribution[]): void {
  db.prepare("DELETE FROM format_distributions").run();
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO format_distributions (format_bucket, metric, pop_median, pop_n, breakpoints) VALUES (?, ?, ?, ?, ?)",
  );
  const tx = db.transaction(() => {
    for (const d of distributions) stmt.run(d.bucket, d.metric, d.popMedian, d.popN, JSON.stringify(d.breakpoints));
  });
  tx();
}

function persistAnchors(db: DB, anchors: LegendAnchor[]): void {
  db.prepare("DELETE FROM legend_anchors").run();
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO legend_anchors (id, name, format_bucket, role, bat, pow, bwl, eco, fld, imp, ovr, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  // computed anchors carry the playerId as id + name; resolve their display name
  const nameOf = db.prepare("SELECT name FROM players WHERE id = ?");
  const tx = db.transaction(() => {
    for (const a of anchors) {
      const name = a.source === "computed" ? ((nameOf.get(a.id) as any)?.name ?? a.name) : a.name;
      stmt.run(a.id, name, a.formatBucket, a.role, a.profile.BAT, a.profile.POW, a.profile.BWL, a.profile.ECO, a.profile.FLD, a.profile.IMP, a.ovr, a.source);
    }
  });
  tx();
}

export async function run(): Promise<void> {
  const t0 = Date.now();
  const db = openDb();

  console.log("── Stage 1: download ──");
  const { peopleCsv } = await download();

  console.log("── Stages 2-3: parse + aggregate ──");
  const map = aggregate(db);
  console.log(`  aggregate holds ${map.size} (player, bucket) rows`);

  console.log("── Stage 4: register join ──");
  const register = loadRegister(peopleCsv);
  console.log(`  register: ${register.size} people`);

  console.log("── Stage 4b: merge pre-2000 historical layer ──");
  const mergeReport = mergeHistorical(map, register);
  const merged = mergeReport.filter((r) => r.action === "spanning-merge").length;
  const created = mergeReport.filter((r) => r.action === "new-pre2000").length;
  const skipped = mergeReport.filter((r) => r.action.startsWith("skip") || r.action === "unmatched");
  console.log(`  merged ${merged} spanning careers, added ${created} pre-2000 players, skipped ${skipped.length}`);
  for (const s of skipped) console.log(`    · ${s.action}: ${s.name} (${s.bucket})${s.note ? " — " + s.note : ""}`);

  persistPlayers(db, map, register);

  console.log("── Stage 5: calibrate ──");
  const { calibrated, distributions } = calibrate(map);

  console.log("── Stage 6: reference OVR ──");
  const ovr = computeOvr(calibrated);
  console.log(`  ${ovr.size} gated cards scored`);

  console.log("── Stage 7: equate to legend ──");
  const { equated, anchors } = equate(calibrated, ovr);

  console.log("── Stage 8: persist ──");
  persistStats(db, calibrated, ovr, equated);
  persistDistributions(db, distributions);
  persistAnchors(db, anchors);
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run("last_run", new Date().toISOString());

  db.close();
  console.log(`✔ ingest complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
