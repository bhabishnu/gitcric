import type { FormatBucket, Role, StatKey } from "../types/stats.js";

/**
 * All calibration & scoring knobs live here. These are the tunable dials the
 * README documents. Nothing else in the pipeline should hard-code a magic
 * number that belongs to calibration.
 */

/** Which genders to ingest. Default men's; add "female" to include women's. */
export const GENDERS: string[] = ["male"];

/**
 * GENTLE shrinkage pseudo-count, in BALLS. shrunk = (n·raw + k·popMedian)/(n+k),
 * where n = balls faced (batting metrics) or balls bowled (bowling metrics).
 * Deliberately LIGHT: the qualification gate already guarantees a real sample,
 * so a gated player keeps MOST of their raw signal. Single tunable knob.
 */
export const SHRINKAGE_K = 175;

/**
 * Minimum balls of sample before a discipline's stats are treated as real. A
 * pure batter with near-zero balls bowled gets a low BWL/ECO FLOOR (not the
 * population median) so the card SHAPE tells the story — like a striker's low
 * DEF. Same for a pure bowler's batting.
 */
export const MIN_BAT_BALLS = 60;
export const MIN_BOWL_BALLS = 60;

/** Stat given on an axis the player barely plays (below the min-balls floor). */
export const ABSENT_AXIS_STAT = 15;

/**
 * Percentile → stat (1..99) mapping. p=0 → FLOOR, p=1 → CEIL.
 * COOLED deliberately: the ceiling sits well below 99 so even a 99th-percentile
 * metric lands in the low 90s, not 96-99. This is what stops elite cards from all
 * clustering at the top — the six stats now spread across a wide range, and only
 * the greatness band can carry a card into the high 90s.
 */
export const STAT_FLOOR = 40;
export const STAT_CEIL = 96;

// ─────────────────────────────────────────────────────────────────────────────
// PEAK BAND — position-weighted six stats, capped at 88.
// Weights are keyed by (role × bucket) so a pure bowler is judged on bowling and
// a pure batter on batting (as GitFut weights by family), with a per-format tilt
// layered on top: POW/BWL/ECO lead in t20i/ipl, BAT/BWL technique leads in test.
// Each weight vector sums to 1. IMP weight kept MODEST so longevity colours but
// never dominates the radar shape.
// ─────────────────────────────────────────────────────────────────────────────

export const PEAK_CAP = 88;

type WeightVec = Record<StatKey, number>;

export const PEAK_WEIGHTS: Record<Role, Record<FormatBucket, WeightVec>> = {
  // A specialist batsman's ONE job is to bat, so batting is weighted heavily —
  // heavier than a keeper-batsman's batting, whose card value is split with the
  // gloves. POW leads in t20i/ipl, BAT technique in test.
  batter: {
    test: { BAT: 0.44, POW: 0.22, BWL: 0.03, ECO: 0.03, FLD: 0.12, IMP: 0.16 },
    odi: { BAT: 0.4, POW: 0.28, BWL: 0.02, ECO: 0.02, FLD: 0.08, IMP: 0.2 },
    t20i: { BAT: 0.22, POW: 0.48, BWL: 0.005, ECO: 0.005, FLD: 0.07, IMP: 0.22 },
    ipl: { BAT: 0.22, POW: 0.48, BWL: 0.005, ECO: 0.005, FLD: 0.07, IMP: 0.22 },
  },
  // A bowler's card is almost purely BWL/ECO (+ a little longevity). FLD is
  // negligible — like a striker's low DEF — so a pure specialist bowler can reach
  // the same ceiling as a peak batter on wicket-taking alone. Economy leads more
  // as the format shortens (control/death bowling is the white-ball craft).
  bowler: {
    test: { BAT: 0.02, POW: 0.02, BWL: 0.5, ECO: 0.26, FLD: 0.02, IMP: 0.18 },
    odi: { BAT: 0.01, POW: 0.01, BWL: 0.4, ECO: 0.42, FLD: 0.02, IMP: 0.14 },
    t20i: { BAT: 0.005, POW: 0.005, BWL: 0.24, ECO: 0.48, FLD: 0.01, IMP: 0.26 },
    ipl: { BAT: 0.005, POW: 0.005, BWL: 0.26, ECO: 0.5, FLD: 0.01, IMP: 0.225 },
  },
  allrounder: {
    test: { BAT: 0.22, POW: 0.12, BWL: 0.26, ECO: 0.14, FLD: 0.06, IMP: 0.2 },
    odi: { BAT: 0.2, POW: 0.18, BWL: 0.22, ECO: 0.16, FLD: 0.06, IMP: 0.18 },
    t20i: { BAT: 0.16, POW: 0.24, BWL: 0.18, ECO: 0.22, FLD: 0.06, IMP: 0.14 },
    ipl: { BAT: 0.16, POW: 0.24, BWL: 0.18, ECO: 0.22, FLD: 0.06, IMP: 0.14 },
  },
  // A keeper's batting is weighted LESS than a specialist batsman's (it is one of
  // two jobs), POW is emphasised (modern keeper-batters earn their place with
  // explosive runs), and FLD rewards the glovework.
  keeper: {
    test: { BAT: 0.16, POW: 0.38, BWL: 0.06, ECO: 0.06, FLD: 0.16, IMP: 0.18 },
    odi: { BAT: 0.28, POW: 0.26, BWL: 0.02, ECO: 0.02, FLD: 0.2, IMP: 0.22 },
    t20i: { BAT: 0.22, POW: 0.34, BWL: 0.02, ECO: 0.02, FLD: 0.22, IMP: 0.18 },
    ipl: { BAT: 0.22, POW: 0.34, BWL: 0.02, ECO: 0.02, FLD: 0.22, IMP: 0.18 },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GREATNESS BAND — 88→99, bought with longevity + sustained peak eliteness.
//   bonus = BONUS_MAX · sigmoid(a·longevity_z + b·peakEliteness_z − c) · gate
// where `gate` smoothly zeroes the bonus for a true rookie (deeply negative
// longevity_z) REGARDLESS of peak — so a stratospheric newcomer still gets ≈0
// greatness. Above the gate, a MODEST longevity deficit can be overcome by a
// peak SURPLUS.
// ─────────────────────────────────────────────────────────────────────────────

export const BONUS_MAX = 11; // 88 + 11 = 99

/**
 * THE single peak-vs-longevity knob, in [0,1]. Higher → peak eliteness matters
 * more relative to longevity in the greatness band. a = 2·(1−t), b = 2·t.
 */
export const PEAK_VS_LONGEVITY = 0.82;

/**
 * GAIN on the greatness argument (the a/b coefficient magnitude). Higher = a
 * STEEPER sigmoid = wider separation between the tiers, so the crowd of elite
 * cards fans out (immortal 95+, great 90-94, very-good 84-89) instead of all
 * bunching in the mid-90s. a = GAIN·(1−t), b = GAIN·t.
 */
export const GREATNESS_GAIN = 2.6;

/**
 * Sigmoid offset c: the bar the 88→99 band must clear. Set HIGH — only all-time
 * longevity+peak clears it. Most "very good" internationals now get ~0 bonus and
 * sit in the peak band (75-89); the 90s are earned; 95+ is immortal-only; a live
 * player reaching 99 is essentially impossible (reserved for the seeded anchor
 * and the pinned Kohli ODI card).
 */
export const GREATNESS_OFFSET = 4.4;

/**
 * Rookie gate on the greatness band. gate = clamp((longevity_z − LO)/(HI − LO)).
 * A player with longevity_z ≤ LO gets ZERO greatness no matter how elite their
 * peak; by HI the gate is fully open. This is what keeps a true rookie in the
 * peak band only.
 */
export const GREATNESS_GATE_LO = -0.5;
export const GREATNESS_GATE_HI = 0.7;

export function greatnessCoeffs(): { a: number; b: number } {
  return { a: GREATNESS_GAIN * (1 - PEAK_VS_LONGEVITY), b: GREATNESS_GAIN * PEAK_VS_LONGEVITY };
}

/**
 * PINNED top-of-scale ordering — an EDITORIAL design decision applied to two
 * specific cards' final OVR only (no other player shifts). Kohli's ODI card is
 * the #1 card in the DB; Tendulkar's ODI sits directly behind it. Applied in the
 * runner after OVRs are computed (config data, not a scoring formula).
 */
export const OVR_PINS: { playerId: string; bucket: FormatBucket; ovr: number; who: string }[] = [
  { playerId: "ba607b88", bucket: "odi", ovr: 99, who: "V Kohli" },
  { playerId: "d2c2b2d5", bucket: "odi", ovr: 98, who: "SR Tendulkar" },
];

// ─────────────────────────────────────────────────────────────────────────────
// ROLE classification thresholds (per-match involvement).
// ─────────────────────────────────────────────────────────────────────────────

export const ROLE = {
  /** A player is a SUSTAINED keeper if they stump often OR are involved in many
   * dismissals behind the stumps. Stumping rate catches spin-era keepers; the
   * dismissals-per-match path catches full-time keepers to a PACE attack (few
   * stumpings, lots of catches — Rizwan), with a small stumping floor so a
   * catch-heavy slip fielder never qualifies. Part-time glovemen (KL Rahul) clear
   * neither. */
  keeperStumpingsPerMatch: 0.1,
  keeperDismissalsPerMatch: 1.05,
  keeperMinStumpRate: 0.03,
  /** Balls bowled per match above which the bowling discipline "counts" (volume). */
  bowlsPerMatch: 12,
  /** Wickets per match a "primary bowler" must take — keeps tidy part-time
   * bowlers (who bowl overs but take few wickets) classified as batters. */
  bowlerWktsPerMatch: 0.5,
  /** Balls faced per match above which the batting discipline "counts" (volume). */
  batsPerMatch: 12,
  /**
   * A discipline only counts toward role if it is also EFFECTIVE, not just
   * high-volume — so a genuine No. 11 who faces plenty of balls (Bumrah) is a
   * bowler, not an allrounder. Min percentile in that discipline to "count".
   */
  batQualityPct: 0.3,
  bowlQualityPct: 0.3,
};

// ─────────────────────────────────────────────────────────────────────────────
// EQUATE-TO-LEGEND — weighted distance in (6-stat profile + OVR).
// ─────────────────────────────────────────────────────────────────────────────

export const EQUATE = {
  /** Weight on each stat's squared difference (per stat point). */
  statWeight: 1,
  /** Weight on the OVR squared difference (per OVR point). OVR anchors the tier. */
  ovrWeight: 2.5,
};
