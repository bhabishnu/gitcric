/**
 * GitCric — SHARED DATA CONTRACT.
 *
 * This module is the ONLY thing the future scoring engine / web app is allowed
 * to import from the pipeline. It depends on the TYPE, never on pipeline
 * internals. Keep it free of runtime/db imports so it can be pulled into any TS
 * surface (engine, API route, React component) without dragging better-sqlite3
 * along.
 */

/** Format buckets are decided by SOURCE COMPETITION (which zip), not match_type. */
export type FormatBucket = "test" | "odi" | "t20i" | "ipl";

export type Role = "batter" | "bowler" | "allrounder" | "keeper";

/** The six FUT-style card stats (cricket analog of PAC/SHO/PAS/DRI/DEF/PHY). */
export type StatKey = "BAT" | "POW" | "BWL" | "ECO" | "FLD" | "IMP";
export type CardStats = Record<StatKey, number>; // each 1..99

/** One metric's calibration trail: raw value, shrunk value, population percentile. */
export interface MetricCalib {
  /** Raw career value (e.g. batting average 52.1). */
  raw: number;
  /** Balls-weighted shrinkage toward the format-bucket population median. */
  shrunk: number;
  /** Percentile rank (0..1) of the SHRUNK value among gated players; higher = better. */
  percentile: number;
  /** Sample size in BALLS that backed this metric (faced or bowled). */
  sampleBalls: number;
}

export interface EquatedLegend {
  id: string;
  name: string;
  /** Weighted distance in (6-stat profile + OVR); lower = closer. */
  distance: number;
  source: "computed" | "seeded";
}

/**
 * The fully-typed object the accessor returns for a (playerId, formatBucket).
 * This is the scoring engine's input contract.
 */
export interface PlayerCardData {
  playerId: string;
  name: string;
  gender: string;
  formatBucket: FormatBucket;

  /** The six card stats, 1..99. */
  stats: CardStats;
  role: Role;

  /** Final reference overall out of 99. */
  ovr: number;
  /** Band breakdown so the engine (and verify) can explain a rating. */
  bands: {
    /** Peak band: position-weighted six stats, capped at 88. */
    peakOvr: number;
    /** Greatness band contribution (0..11), the longevity/eliteness bonus. */
    greatnessBonus: number;
    /** z-scored longevity used by the greatness band. */
    longevityZ: number;
    /** z-scored peak-eliteness used by the greatness band. */
    peakElitenessZ: number;
  };

  /** raw + shrunk + percentile trail for each calibration driver. */
  metrics: {
    battingAvg: MetricCalib;
    battingSR: MetricCalib;
    bowlingSR: MetricCalib;
    economy: MetricCalib;
    fielding: MetricCalib;
    impact: MetricCalib;
  };

  sampleSizes: {
    battingBalls: number;
    bowlingBalls: number;
    matches: number;
  };

  career: {
    matches: number;
    spanYears: number;
    firstDate: string;
    lastDate: string;
    fifties: number;
    hundreds: number;
    fourFers: number;
    fiveFers: number;
  };

  equatedLegend: EquatedLegend | null;
}

/** A benchmark legend anchor (computed from the pipeline, or hand-seeded). */
export interface LegendAnchor {
  id: string;
  name: string;
  formatBucket: FormatBucket;
  role: Role;
  profile: CardStats;
  ovr: number;
  source: "computed" | "seeded";
}
