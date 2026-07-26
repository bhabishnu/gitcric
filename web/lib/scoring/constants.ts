import type { Family, Role, StatKey, Stats } from "./types";

export const STATS: StatKey[] = ["BAT", "POW", "BWL", "ECO", "FLD", "IMP"];

/** Cohesion groups: axes within a discipline share sub-skills and shouldn't gap
 *  randomly; the two disciplines are free to diverge (that's what makes a
 *  specialist card). Batting = {BAT,POW}, Bowling = {BWL,ECO}. */
export const BAT_GROUP: StatKey[] = ["BAT", "POW"];
export const BOWL_GROUP: StatKey[] = ["BWL", "ECO"];

/**
 * THE calibration dials. Seeded from GitFut's constants (which already produce
 * the compressed scale the cricketer DB shares: cap 88, legacy band 11) and
 * then tuned in the calibration loop to hit the target user distribution.
 */
export const K = {
  // §3.1 magnitude → gravity-well center the six stats sit around. GitFut's
  // constants (lo 47 vs its 48 to keep a genuinely empty account under 50).
  // `temp` widens the sigmoid's active zone. At 1 (GitFut's shape) the well
  // saturates at `hi` for anyone past ~10k stars, so a 2.7k-star account and a
  // 252k-star account landed on the same center — the root of the top-end
  // pile-up. >1 keeps reach separating accounts all the way up.
  magnitude: { wStars: 0.5, wFollowers: 0.4, wLifetime: 0.5, wAge: 0.08, b: -2.8, temp: 1, lo: 40, hi: 82 },
  // §3.3 antagonist pairs — batsman vs bowler, aggression vs control.
  tension: {
    alpha: 0.7,
    pairs: [
      ["BAT", "BWL"],
      ["POW", "ECO"],
    ] as [StatKey, StatKey][],
  },
  // §3.4 spike spread + within-discipline cohesion pull.
  // flatSpan/flatFloor damp the spike for near-flat (empty) raw profiles so
  // z-scoring can't manufacture a fake specialist; real specialists (raw spread
  // ≥ flatSpan) spike fully.
  spike: { base: 8, cohesion: 0.6, flatSpan: 18, flatFloor: 0.35 },
  // ECO focus: 40 + gain·focus(0..1). Kept in a fair band (never punitive) —
  // scattered work reads lower than focused work, but no card craters.
  eco: { base: 38, gain: 40, wConc: 0.4, wLang: 0.3, wMerge: 0.3, langSpan: 12 },
  // §4 the greatness band — the climb from the stats-alone cap to the ceiling.
  //
  // GitFut's own constants (aAge 1.0, bActive 0.7, f 6.0, no temp) made this an
  // AGE GATE rather than a greatness gate: 0.7 × 15 active years alone clears
  // the offset, so every account past ~10 years saturated the sigmoid at L=1.00
  // and collected the full bonus. torvalds (252k★) and a solid 2.7k★ maintainer
  // both scored 1.00, which is why the top end piled up at 97-98.
  //
  // Reshaped so REACH buys the climb and tenure only qualifies for it:
  //   - age/activity weights cut hard (they gate, they no longer dominate)
  //   - followers/stars/flagship weights raised, offset re-centred
  //   - `temp` widens the sigmoid so L actually spreads (0.11 → 0.83 across the
  //     calibration panel) instead of pinning at 1.00
  //   - `floor` is the entry to the band: below it an account is scored on its
  //     stats alone, which leaves the whole mid/low distribution untouched
  // Fitted against a panel anchored on ShivaBhattacharjee ≈ 90 (GitFut ref).
  legacy: { aAge: 0.32, bActive: 0.035, cFoll: 0.82, dStars: 0.6, eMax: 0.6, f: 7.1, temp: 3.4, activeCap: 15, bonusMax: 14, floor: 0.14, gamma: 0.8 },
  // Stats alone cap here. Lowered from GitFut's 88: every account past ~15k
  // stars pinned at 88, so the six axes had no headroom left to separate anyone
  // and the entire top end depended on a legacy score that was itself saturated.
  // This bounds weightedOVR only — the six stat VALUES are untouched by it.
  ovrCap: 84,
  ovrMax: 98,
  // Editorial: these logins are always crowned regardless of the math landing.
  iconAllowlist: ["torvalds"],
  tier: { immortalMin: 91, goldMin: 84, silverMin: 70 },
  eyebrow: { generational: 91, captainsPick: 84, squad: 70 },
};

/**
 * OVR weights by shape family. Format-agnostic (the user has no format); tuned to
 * an ODI-like balance so a specialist reaches the same ceiling on their craft
 * alone, mirroring the DB's PEAK_WEIGHTS philosophy. Each vector sums to 1.
 */
export const WEIGHTS: Record<Family, Stats> = {
  Batting: { BAT: 0.34, POW: 0.28, BWL: 0.03, ECO: 0.03, FLD: 0.12, IMP: 0.2 },
  Bowling: { BAT: 0.03, POW: 0.03, BWL: 0.36, ECO: 0.34, FLD: 0.04, IMP: 0.2 },
  AllRound: { BAT: 0.2, POW: 0.18, BWL: 0.2, ECO: 0.16, FLD: 0.06, IMP: 0.2 },
};

export const FAMILY_ROLE: Record<Family, Role> = {
  Batting: "batter",
  Bowling: "bowler",
  AllRound: "allrounder",
};
