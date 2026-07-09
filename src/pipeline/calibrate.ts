import type { FormatBucket } from "../types/stats.js";
import { GATES } from "../config/competitions.js";
import { MIN_BAT_BALLS, MIN_BOWL_BALLS, SHRINKAGE_K } from "../config/calibration.js";
import type { AggMap, RawAgg } from "./aggregate.js";

/** Everything stage 5 derives for one (player, bucket), carried into OVR + equate. */
export interface Calibrated {
  agg: RawAgg;
  gated: boolean;
  spanYears: number;

  // raw metrics
  batAvg: number;
  batSR: number;
  boundaryPct: number;
  bowlAvg: number;
  economy: number;
  bowlSR: number;

  // shrunk metrics
  batAvgShrunk: number;
  batSRShrunk: number;
  bowlSRShrunk: number;
  economyShrunk: number;

  // percentiles (0..1, higher = better)
  batAvgPct: number;
  batSRPct: number;
  bowlSRPct: number;
  economyPct: number;
  fldPct: number;
  impPct: number;

  sampleBallsBat: number;
  sampleBallsBowl: number;

  // has enough sample for the discipline to count
  hasBat: boolean;
  hasBowl: boolean;

  fieldingPerMatch: number;
  impactRaw: number;
}

export interface Distribution {
  bucket: FormatBucket;
  metric: string;
  popMedian: number;
  popN: number;
  breakpoints: { p: number; v: number }[];
}

const log10 = (x: number) => Math.log10(Math.max(0, x) + 1);

function spanYears(first: string, last: string): number {
  if (!first || !last) return 0;
  const a = new Date(first).getTime();
  const b = new Date(last).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return (b - a) / (365.25 * 24 * 3600 * 1000);
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Percentile-rank each value in `values` (0..1). higherBetter flips direction. */
function percentileMap(values: { id: string; v: number }[], higherBetter: boolean): Map<string, number> {
  const out = new Map<string, number>();
  const n = values.length;
  if (n === 0) return out;
  if (n === 1) {
    out.set(values[0]!.id, 0.5);
    return out;
  }
  const sorted = [...values].sort((a, b) => a.v - b.v);
  // assign by index; average ranks for ties so equal values share a percentile
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && sorted[j + 1]!.v === sorted[i]!.v) j++;
    const rank = (i + j) / 2; // average index of the tie block
    const pct = rank / (n - 1);
    for (let kk = i; kk <= j; kk++) out.set(sorted[kk]!.id, higherBetter ? pct : 1 - pct);
    i = j + 1;
  }
  return out;
}

function breakpointsOf(values: number[], higherBetter: boolean): { p: number; v: number }[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const ps = [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99];
  return ps.map((p) => {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
    return { p: higherBetter ? p : 1 - p, v: sorted[idx]! };
  });
}

const shrink = (raw: number, n: number, median: number) => (n * raw + SHRINKAGE_K * median) / (n + SHRINKAGE_K);

/** Career midpoint year, used as a player's "era" anchor. */
function midYear(c: Calibrated): number | null {
  const fy = c.agg.firstDate ? Number.parseInt(c.agg.firstDate.slice(0, 4), 10) : NaN;
  const ly = c.agg.lastDate ? Number.parseInt(c.agg.lastDate.slice(0, 4), 10) : NaN;
  const okF = Number.isFinite(fy);
  const okL = Number.isFinite(ly);
  if (!okF && !okL) return null;
  if (!okF) return ly;
  if (!okL) return fy;
  return (fy + ly) / 2;
}

/**
 * ERA-RELATIVE percentile for an environment-sensitive rate metric. Instead of
 * ranking a player's raw (shrunk) rate against everyone across all history —
 * which penalises pre-2015 batters for the low-scoring era they played in and
 * flatters modern bowlers who bowl in a high-scoring one — we:
 *   1. anchor each player to their era (career midpoint year),
 *   2. compute the era baseline = median of the metric among players active in a
 *      rolling window around that year (window WIDENS until it holds enough
 *      players; falls back to the global median if the era is too sparse),
 *   3. take the RATIO of the player's value to their era baseline (oriented so
 *      higher = better for both higher-better and lower-better metrics),
 *   4. percentile the RATIOS across the whole population.
 * A batter who out-scored their contemporaries now ranks with the modern greats
 * WITHOUT anyone's raw numbers being lowered — the ratio just removes the era tax.
 */
function eraRelativePercentile(
  pop: Calibrated[],
  getVal: (c: Calibrated) => number,
  lowerBetter: boolean,
): Map<string, number> {
  const items = pop.map((c) => ({ id: c.agg.playerId, year: midYear(c), v: getVal(c) }));
  const globalMed = median(items.map((o) => o.v).sort((a, b) => a - b));

  const ratios = items.map((o) => {
    let base = globalMed;
    if (o.year != null) {
      let sample: number[] = [];
      for (let w = 3; w <= 40; w += 3) {
        sample = items.filter((x) => x.year != null && Math.abs((x.year as number) - (o.year as number)) <= w).map((x) => x.v);
        if (sample.length >= 30) break; // enough contemporaries → stop widening
      }
      if (sample.length >= 8) base = median([...sample].sort((a, b) => a - b)); // graceful fallback below 8
    }
    let ratio = 1;
    if (base > 0 && o.v > 0) ratio = lowerBetter ? base / o.v : o.v / base;
    return { id: o.id, v: ratio };
  });
  return percentileMap(ratios, true);
}

/**
 * Stage 5 — CALIBRATION. Per format bucket (each its own population):
 *  a. apply the hard qualification gate,
 *  b. GENTLE balls-weighted shrinkage toward the population median,
 *  c/d. strike rate is the primary impact metric; average/economy the secondary,
 *  e. percentile-rank every metric across GATED players on the SHRUNK value,
 *  f. record per-format breakpoints.
 */
export function calibrate(map: AggMap): { calibrated: Map<string, Calibrated>; distributions: Distribution[] } {
  // 1) base raw metrics + gating
  const items: Calibrated[] = [];
  const byKey = new Map<string, Calibrated>();
  for (const [k, agg] of map) {
    const gate = GATES[agg.bucket];
    const gated = agg.matches >= gate;
    const denomDis = Math.max(agg.dismissals, 1);
    const denomWkt = Math.max(agg.wickets, 1);
    const c: Calibrated = {
      agg,
      gated,
      spanYears: spanYears(agg.firstDate, agg.lastDate),
      batAvg: agg.runs / denomDis,
      batSR: agg.ballsFaced > 0 ? (agg.runs / agg.ballsFaced) * 100 : 0,
      boundaryPct: agg.ballsFaced > 0 ? ((agg.fours + agg.sixes) / agg.ballsFaced) * 100 : 0,
      bowlAvg: agg.runsConceded / denomWkt,
      economy: agg.ballsBowled > 0 ? agg.runsConceded / (agg.ballsBowled / 6) : 0,
      bowlSR: agg.ballsBowled / denomWkt,
      batAvgShrunk: 0,
      batSRShrunk: 0,
      bowlSRShrunk: 0,
      economyShrunk: 0,
      batAvgPct: 0,
      batSRPct: 0,
      bowlSRPct: 0,
      economyPct: 0,
      fldPct: 0,
      impPct: 0,
      sampleBallsBat: agg.ballsFaced,
      sampleBallsBowl: agg.ballsBowled,
      hasBat: agg.ballsFaced >= MIN_BAT_BALLS,
      hasBowl: agg.ballsBowled >= MIN_BOWL_BALLS,
      fieldingPerMatch: (agg.catches + agg.stumpings + agg.runOuts) / Math.max(agg.matches, 1),
      impactRaw:
        2.0 * log10(agg.matches) +
        0.15 * spanYears(agg.firstDate, agg.lastDate) +
        1.2 * log10(agg.fifties + agg.hundreds + agg.fourFers + agg.fiveFers),
    };
    items.push(c);
    byKey.set(k, c);
  }

  const distributions: Distribution[] = [];
  const buckets = [...new Set(items.map((c) => c.agg.bucket))];

  for (const bucket of buckets) {
    const inBucket = items.filter((c) => c.agg.bucket === bucket);
    const gated = inBucket.filter((c) => c.gated);
    const batPop = gated.filter((c) => c.hasBat);
    const bowlPop = gated.filter((c) => c.hasBowl);

    // 2) population medians for shrinkage (over gated players with sample)
    const medBatAvg = median(batPop.map((c) => c.batAvg).sort((a, b) => a - b));
    const medBatSR = median(batPop.map((c) => c.batSR).sort((a, b) => a - b));
    const medBowlSR = median(bowlPop.map((c) => c.bowlSR).sort((a, b) => a - b));
    const medEconomy = median(bowlPop.map((c) => c.economy).sort((a, b) => a - b));

    // 3) shrink every item in the bucket (even non-gated, for display consistency)
    for (const c of inBucket) {
      c.batAvgShrunk = shrink(c.batAvg, c.sampleBallsBat, medBatAvg || c.batAvg);
      c.batSRShrunk = shrink(c.batSR, c.sampleBallsBat, medBatSR || c.batSR);
      c.bowlSRShrunk = shrink(c.bowlSR, c.sampleBallsBowl, medBowlSR || c.bowlSR);
      c.economyShrunk = shrink(c.economy, c.sampleBallsBowl, medEconomy || c.economy);
    }

    // 4) percentiles over GATED players, on the SHRUNK value.
    //    batting AVERAGE and fielding/impact are era-stable → global percentile.
    //    The three environment-sensitive RATE metrics (batting SR → POW, bowling
    //    SR → BWL, economy → ECO) are percentiled ERA-RELATIVE, so a pre-2015
    //    accumulator is judged against their own scoring era, not the modern one.
    const batAvgPct = percentileMap(batPop.map((c) => ({ id: c.agg.playerId, v: c.batAvgShrunk })), true);
    const batSRPct = eraRelativePercentile(batPop, (c) => c.batSRShrunk, false);
    const bowlSRPct = eraRelativePercentile(bowlPop, (c) => c.bowlSRShrunk, true);
    const economyPct = eraRelativePercentile(bowlPop, (c) => c.economyShrunk, true);
    const fldPct = percentileMap(gated.map((c) => ({ id: c.agg.playerId, v: c.fieldingPerMatch })), true);
    const impPct = percentileMap(gated.map((c) => ({ id: c.agg.playerId, v: c.impactRaw })), true);

    for (const c of inBucket) {
      const id = c.agg.playerId;
      c.batAvgPct = batAvgPct.get(id) ?? 0;
      c.batSRPct = batSRPct.get(id) ?? 0;
      c.bowlSRPct = bowlSRPct.get(id) ?? 0;
      c.economyPct = economyPct.get(id) ?? 0;
      c.fldPct = fldPct.get(id) ?? 0;
      c.impPct = impPct.get(id) ?? 0;
    }

    // 5) breakpoints for the distributions table
    const push = (metric: string, vals: number[], higherBetter: boolean, pop: Calibrated[], med: number) =>
      distributions.push({
        bucket,
        metric,
        popMedian: med,
        popN: pop.length,
        breakpoints: breakpointsOf(vals, higherBetter),
      });
    push("bat_avg", batPop.map((c) => c.batAvgShrunk), true, batPop, medBatAvg);
    push("bat_sr", batPop.map((c) => c.batSRShrunk), true, batPop, medBatSR);
    push("bowl_sr", bowlPop.map((c) => c.bowlSRShrunk), false, bowlPop, medBowlSR);
    push("economy", bowlPop.map((c) => c.economyShrunk), false, bowlPop, medEconomy);
    push("fielding", gated.map((c) => c.fieldingPerMatch), true, gated, median(gated.map((c) => c.fieldingPerMatch).sort((a, b) => a - b)));
    push("impact", gated.map((c) => c.impactRaw), true, gated, median(gated.map((c) => c.impactRaw).sort((a, b) => a - b)));
  }

  return { calibrated: byKey, distributions };
}
