import type { DB } from "./db.js";
import { openDb } from "./db.js";
import type { FormatBucket, PlayerCardData, Role } from "../types/stats.js";

/**
 * The TYPED ACCESSOR the future scoring engine imports. It returns a fully-typed
 * {@link PlayerCardData} for a (playerId, formatBucket) — the engine depends on
 * this contract, never on pipeline internals.
 */
export class GitCricStore {
  private db: DB;

  constructor(path?: string) {
    this.db = openDb(path);
  }

  close(): void {
    this.db.close();
  }

  /** Name search (case-insensitive substring) → candidate players. */
  findByName(query: string): { playerId: string; name: string }[] {
    const rows = this.db
      .prepare("SELECT id, name FROM players WHERE name LIKE ? COLLATE NOCASE ORDER BY name LIMIT 25")
      .all(`%${query}%`) as any[];
    return rows.map((r) => ({ playerId: r.id, name: r.name }));
  }

  /** Which format buckets does this player have a (gated) card in? */
  bucketsFor(playerId: string): FormatBucket[] {
    const rows = this.db
      .prepare("SELECT format_bucket FROM player_format_stats WHERE player_id = ? AND gated = 1 ORDER BY format_bucket")
      .all(playerId) as any[];
    return rows.map((r) => r.format_bucket as FormatBucket);
  }

  /**
   * The core contract: (playerId, bucket) → fully typed card data, or null when
   * the player has no gated card in that format.
   */
  getCard(playerId: string, bucket: FormatBucket): PlayerCardData | null {
    const r = this.db
      .prepare("SELECT * FROM player_format_stats WHERE player_id = ? AND format_bucket = ?")
      .get(playerId, bucket) as any;
    if (!r || !r.gated || r.ovr == null) return null;

    const p = this.db.prepare("SELECT name, gender FROM players WHERE id = ?").get(playerId) as any;

    let equatedLegend: PlayerCardData["equatedLegend"] = null;
    if (r.equated_legend_id) {
      const anchor = this.db.prepare("SELECT id, name, source FROM legend_anchors WHERE id = ?").get(r.equated_legend_id) as any;
      if (anchor) {
        equatedLegend = { id: anchor.id, name: anchor.name, distance: 0, source: anchor.source };
      }
    }

    const metric = (raw: number, shrunk: number, percentile: number, sampleBalls: number) => ({
      raw: raw ?? 0,
      shrunk: shrunk ?? 0,
      percentile: percentile ?? 0,
      sampleBalls: sampleBalls ?? 0,
    });

    return {
      playerId,
      name: p?.name ?? playerId,
      gender: p?.gender ?? "male",
      formatBucket: bucket,
      stats: { BAT: r.stat_bat, POW: r.stat_pow, BWL: r.stat_bwl, ECO: r.stat_eco, FLD: r.stat_fld, IMP: r.stat_imp },
      role: r.role as Role,
      ovr: r.ovr,
      bands: {
        peakOvr: r.peak_ovr,
        greatnessBonus: r.greatness_bonus,
        longevityZ: r.longevity_z,
        peakElitenessZ: r.peak_elite_z,
      },
      metrics: {
        battingAvg: metric(r.bat_avg, r.bat_avg_shrunk, r.bat_avg_pct, r.sample_balls_bat),
        battingSR: metric(r.bat_sr, r.bat_sr_shrunk, r.bat_sr_pct, r.sample_balls_bat),
        bowlingSR: metric(r.bowl_sr, r.bowl_sr_shrunk, r.bowl_sr_pct, r.sample_balls_bowl),
        economy: metric(r.economy, r.economy_shrunk, r.economy_pct, r.sample_balls_bowl),
        fielding: metric(
          (r.catches + r.stumpings + r.run_outs) / Math.max(r.matches, 1),
          (r.catches + r.stumpings + r.run_outs) / Math.max(r.matches, 1),
          r.fld_pct,
          0,
        ),
        impact: metric(r.matches, r.matches, r.imp_pct, 0),
      },
      sampleSizes: { battingBalls: r.sample_balls_bat, bowlingBalls: r.sample_balls_bowl, matches: r.matches },
      career: {
        matches: r.matches,
        spanYears: r.span_years,
        firstDate: r.first_date ?? "",
        lastDate: r.last_date ?? "",
        fifties: r.fifties,
        hundreds: r.hundreds,
        fourFers: r.four_fers,
        fiveFers: r.five_fers,
      },
      equatedLegend,
    };
  }
}
