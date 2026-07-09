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

/**
 * §7 role from career involvement AND effectiveness. Keeper wins on the stumping
 * signal. A discipline must be both high-VOLUME and EFFECTIVE to count toward the
 * role, so a genuine tail-ender who faces many balls is still a pure bowler.
 */
export function classifyRole(c: Calibrated): Role {
  const a = c.agg;
  const m = Math.max(a.matches, 1);
  const isKeeper = a.stumpings >= ROLE.keeperStumpings || a.stumpings / m >= ROLE.keeperStumpingsPerMatch;
  if (isKeeper) return "keeper";

  const primaryBatter =
    c.hasBat && a.ballsFaced / m >= ROLE.batsPerMatch && c.batAvgPct >= ROLE.batQualityPct;
  const primaryBowler =
    c.hasBowl &&
    a.ballsBowled / m >= ROLE.bowlsPerMatch &&
    (c.bowlSRPct >= ROLE.bowlQualityPct || c.economyPct >= ROLE.bowlQualityPct);

  if (primaryBatter && primaryBowler) return "allrounder";
  if (primaryBowler) return "bowler";
  if (primaryBatter) return "batter";
  // fallback: whichever discipline the player actually turns up for by volume
  if (c.hasBowl && a.ballsBowled / m >= ROLE.bowlsPerMatch && a.ballsBowled >= a.ballsFaced) return "bowler";
  return "batter";
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

function peakOvr(stats: CardStats, role: Role, bucket: Calibrated["agg"]["bucket"]): number {
  const w = PEAK_WEIGHTS[role][bucket];
  const raw = (Object.keys(stats) as StatKey[]).reduce((s, k) => s + stats[k] * w[k], 0);
  return Math.min(PEAK_CAP, Math.round(raw));
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
      const peak = peakOvr(stats, role, bucket);

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
