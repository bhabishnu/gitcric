import type { CardStats, Role, StatKey } from "../types/stats.js";
import {
  ABSENT_AXIS_STAT,
  BONUS_MAX,
  greatnessCoeffs,
  GREATNESS_GATE_HI,
  GREATNESS_GATE_LO,
  GREATNESS_OFFSET,
  PEAK_CAP,
  PEAK_WEIGHTS,
  ROLE,
  STAT_CEIL,
  STAT_FLOOR,
} from "../config/calibration.js";
import type { Calibrated } from "./calibrate.js";

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Percentile (0..1) → stat (1..99): p=0 → FLOOR, p=1 → 99. */
export const statFromPct = (p: number) => clamp(Math.round(STAT_FLOOR + (STAT_CEIL - STAT_FLOOR) * p), 1, 99);

export interface OvrResult {
  stats: CardStats;
  role: Role;
  peakOvr: number;
  greatnessBonus: number;
  longevityZ: number;
  peakElitenessZ: number;
  ovr: number;
}

// ── ALLROUNDER bars ──────────────────────────────────────────────────────────
// A genuine all-rounder is MATERIALLY good at BOTH disciplines. These bars are
// deliberately HIGH: a batsman who turns his arm over (Root's off-spin, Smith's
// leg-spin) does NOT clear the bowling bar (too few wickets/match), and a
// tail-ender who can bat a bit (Warne) does NOT clear the batting bar (average
// too low). Only players who are a real threat with both — Kallis, Stokes,
// Jadeja, Shakib, Pollock — qualify.
const AR_BAT_PCT = 0.4; // batting average must be a real contribution
const AR_BAT_BALLS_PER_M = 18; // front/middle-order batting volume
const AR_BAT_INN_PER_M = 0.5; // actually bats in most matches
const AR_BOWL_WKTS_PER_M = 0.9; // a frontline wicket-taker, not a part-timer
const AR_BOWL_QUAL_PCT = 0.4; // and genuinely effective (SR or economy)
const AR_BOWL_BALLS_PER_M = 18; // bowls a real spell (~3+ overs / match)

/**
 * §7 role from career involvement AND effectiveness, judged on the player's
 * DOMINANT discipline by career weight (not their debut role). Keeper wins on the
 * stumping signal. ALLROUNDER is reserved for players materially good at both;
 * everyone else is the discipline they actually make their living from — so a
 * part-time bowler stays a batter and a batting tail-ender stays a bowler.
 */
export function classifyRole(c: Calibrated): Role {
  const a = c.agg;
  const m = Math.max(a.matches, 1);
  // KEEPER requires a SUSTAINED keeping share, not occasional gloves — either a
  // real stumping rate (spin-era keepers) OR heavy dismissal involvement behind
  // the stumps with a minimum stumping floor (pace-era keepers like Rizwan, who
  // stump rarely but keep every match). A part-time gloveman (KL Rahul) clears
  // neither and stays a batter.
  const stumpRate = a.stumpings / m;
  const dismissalRate = (a.stumpings + a.catches) / m;
  if (
    stumpRate >= ROLE.keeperStumpingsPerMatch ||
    (dismissalRate >= ROLE.keeperDismissalsPerMatch && stumpRate >= ROLE.keeperMinStumpRate)
  )
    return "keeper";

  const batBalls = a.ballsFaced / m;
  const bowlBalls = a.ballsBowled / m;
  const wktsPerM = a.wickets / m;
  const bowlQual = Math.max(c.bowlSRPct, c.economyPct);

  // Material contribution to each discipline (the high bar → grants ALLROUNDER).
  const batAllround =
    c.hasBat && c.batAvgPct >= AR_BAT_PCT && batBalls >= AR_BAT_BALLS_PER_M && a.batInnings / m >= AR_BAT_INN_PER_M;
  const bowlAllround =
    c.hasBowl && wktsPerM >= AR_BOWL_WKTS_PER_M && bowlQual >= AR_BOWL_QUAL_PCT && bowlBalls >= AR_BOWL_BALLS_PER_M;
  if (batAllround && bowlAllround) return "allrounder";

  // Not a true all-rounder → classify by dominant discipline. The "primary" bars
  // are the lower involvement bars; a player may clear both (a batsman who bowls
  // part-time) — resolve to whichever discipline they are MORE elite at.
  const batsPrimarily = c.hasBat && batBalls >= ROLE.batsPerMatch && c.batAvgPct >= ROLE.batQualityPct;
  // A "primary bowler" must actually take wickets, not just bowl tidy part-time
  // overs — otherwise an old-school batsman who rolled his arm over economically
  // (Border, Viv Richards) reads as a bowler off a high economy percentile alone.
  const bowlsPrimarily =
    c.hasBowl && bowlBalls >= ROLE.bowlsPerMatch && bowlQual >= ROLE.bowlQualityPct && wktsPerM >= ROLE.bowlerWktsPerMatch;

  if (batsPrimarily && bowlsPrimarily) return c.batAvgPct >= bowlQual ? "batter" : "bowler";
  if (bowlsPrimarily) return "bowler";
  if (batsPrimarily) return "batter";
  // neither clears a primary bar → go with career-weight volume
  return a.ballsBowled > a.ballsFaced ? "bowler" : "batter";
}

function buildStats(c: Calibrated): CardStats {
  return {
    BAT: c.hasBat ? statFromPct(c.batAvgPct) : ABSENT_AXIS_STAT,
    POW: c.hasBat ? statFromPct(c.batSRPct) : ABSENT_AXIS_STAT,
    BWL: c.hasBowl ? statFromPct(c.bowlSRPct) : ABSENT_AXIS_STAT,
    ECO: c.hasBowl ? statFromPct(c.economyPct) : ABSENT_AXIS_STAT,
    FLD: statFromPct(c.fldPct),
    IMP: statFromPct(c.impPct),
  };
}

const STAT_KEYS: StatKey[] = ["BAT", "POW", "BWL", "ECO", "FLD", "IMP"];

// ── graded secondary-contribution blend (fixes the binary role cliff) ─────────
// A batter/bowler who narrowly MISSES the allrounder bar but has a MATERIAL
// secondary skill (a real lower-order batting record, or genuine part-time
// wickets) shouldn't have it weighted away — blend their role weights toward the
// allrounder vector, graded by how strong the secondary is. Pure specialists
// (no secondary volume, or a weak secondary) get λ=0 and are untouched.
const BLEND_MAX = 0.6;
const BLEND_PCT_LO = 0.32; // secondary percentile where credit starts
const BLEND_PCT_HI = 0.8; //  ...and where it saturates
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** How much to blend a primary role toward allrounder (0 = pure specialist). */
function secondaryBlend(c: Calibrated, role: Role): number {
  const a = c.agg;
  const m = Math.max(a.matches, 1);
  let strength = 0;
  if (role === "bowler" && c.hasBat && a.ballsFaced / m >= ROLE.batsPerMatch) {
    // a bowler's genuine lower-order batting (volume gated, graded by average)
    strength = clamp01((c.batAvgPct - BLEND_PCT_LO) / (BLEND_PCT_HI - BLEND_PCT_LO));
  } else if (role === "batter" && c.hasBowl && a.ballsBowled / m >= ROLE.bowlsPerMatch && a.wickets / m >= ROLE.bowlerWktsPerMatch) {
    // a batter's genuine part-time wickets (volume + wicket-rate gated)
    strength = clamp01((Math.max(c.bowlSRPct, c.economyPct) - BLEND_PCT_LO) / (BLEND_PCT_HI - BLEND_PCT_LO));
  }
  return BLEND_MAX * strength;
}

function weightedPeak(stats: CardStats, weights: Record<StatKey, number>): number {
  const raw = STAT_KEYS.reduce((s, k) => s + stats[k] * weights[k], 0);
  return Math.min(PEAK_CAP, Math.round(raw));
}

/**
 * Peak OVR crediting a graded secondary contribution: the higher of the pure
 * role weighting and a partial-allrounder blend. Taking the MAX means the blend
 * only ever ADDS a genuine secondary skill (Jadeja's batting) — it can never
 * dilute a specialist whose secondary is weaker than their primary (a batsman
 * who bowls a bit keeps his batting weighting). Pure specialists (λ=0) are
 * unchanged.
 */
function peakOvr(stats: CardStats, c: Calibrated, role: Role, bucket: Calibrated["agg"]["bucket"]): number {
  const base = PEAK_WEIGHTS[role][bucket];
  const basePeak = weightedPeak(stats, base);
  if (role !== "batter" && role !== "bowler") return basePeak;
  const lambda = secondaryBlend(c, role);
  if (lambda <= 0) return basePeak;
  const allr = PEAK_WEIGHTS.allrounder[bucket];
  const blended = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) blended[k] = base[k] * (1 - lambda) + allr[k] * lambda;
  return Math.max(basePeak, weightedPeak(stats, blended));
}

/** Player's peak-eliteness signal: mean of their TOP-2 rate-stat percentiles. */
function peakElitenessRaw(c: Calibrated): number {
  const rates: number[] = [];
  if (c.hasBat) rates.push(c.batSRPct, c.batAvgPct);
  if (c.hasBowl) rates.push(c.bowlSRPct, c.economyPct);
  if (rates.length === 0) return 0;
  rates.sort((a, b) => b - a);
  const top = rates.slice(0, 2);
  return top.reduce((s, x) => s + x, 0) / top.length;
}

function zscorer(values: number[]): (x: number) => number {
  const n = values.length;
  if (n === 0) return () => 0;
  const mean = values.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(values.reduce((s, x) => s + (x - mean) ** 2, 0) / n) || 1;
  return (x: number) => (x - mean) / sd;
}

/**
 * Stage 6 — REFERENCE OVR, two bands (following GitFut). Operates per bucket
 * over GATED players so the greatness band's z-scores are population-relative.
 * Mutates nothing; returns a result per key. Non-gated players get null (no card).
 */
export function computeOvr(calibrated: Map<string, Calibrated>): Map<string, OvrResult> {
  const out = new Map<string, OvrResult>();
  const entries = [...calibrated.entries()];
  const buckets = [...new Set(entries.map(([, c]) => c.agg.bucket))];

  for (const bucket of buckets) {
    const gated = entries.filter(([, c]) => c.agg.bucket === bucket && c.gated);
    if (gated.length === 0) continue;

    // z-score components across the gated population
    const zMatches = zscorer(gated.map(([, c]) => c.agg.matches));
    const zSpan = zscorer(gated.map(([, c]) => c.spanYears));
    const zMiles = zscorer(gated.map(([, c]) => c.agg.fifties + c.agg.hundreds + c.agg.fourFers + c.agg.fiveFers));

    // combined longevity scalar (balanced across the three components), then re-z
    const longevityScalar = (c: Calibrated) =>
      zMatches(c.agg.matches) + zSpan(c.spanYears) + zMiles(c.agg.fifties + c.agg.hundreds + c.agg.fourFers + c.agg.fiveFers);
    const zLongevity = zscorer(gated.map(([, c]) => longevityScalar(c)));
    const zPeakElite = zscorer(gated.map(([, c]) => peakElitenessRaw(c)));

    const { a, b } = greatnessCoeffs();

    for (const [k, c] of gated) {
      const role = classifyRole(c);
      const stats = buildStats(c);
      const peak = peakOvr(stats, c, role, bucket);

      const longevityZ = zLongevity(longevityScalar(c));
      const peakElitenessZ = zPeakElite(peakElitenessRaw(c));

      // rookie gate: deeply negative longevity → ~0 greatness regardless of peak
      const gate = clamp((longevityZ - GREATNESS_GATE_LO) / (GREATNESS_GATE_HI - GREATNESS_GATE_LO), 0, 1);
      const frac = sigmoid(a * longevityZ + b * peakElitenessZ - GREATNESS_OFFSET);
      const greatnessBonus = Math.round(BONUS_MAX * frac * gate);
      const ovr = Math.min(99, peak + greatnessBonus);

      out.set(k, { stats, role, peakOvr: peak, greatnessBonus, longevityZ, peakElitenessZ, ovr });
    }
  }
  return out;
}
