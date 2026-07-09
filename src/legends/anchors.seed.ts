import type { LegendAnchor } from "../types/stats.js";

/**
 * HAND-AUTHORED legend anchors (source=seeded) for the pre-limited-overs greats
 * Cricsheet has no ball-by-ball for. Profiles are on the SAME 1..99 scale the
 * pipeline produces, so equate-to-legend can mix them with computed anchors.
 *
 * An OVR-99 Test batter profile is designed to equate to Bradman. The set spans
 * tiers (86→99), formats (test/odi), roles, and archetypes (dominant batter,
 * short-but-stratospheric peak, express bowler, allrounder, keeper).
 */
export const SEEDED_ANCHORS: LegendAnchor[] = [
  { id: "seed-bradman", name: "Don Bradman", formatBucket: "test", role: "batter", ovr: 99, source: "seeded", profile: { BAT: 99, POW: 72, BWL: 12, ECO: 12, FLD: 62, IMP: 96 } },
  { id: "seed-sobers", name: "Garry Sobers", formatBucket: "test", role: "allrounder", ovr: 96, source: "seeded", profile: { BAT: 90, POW: 74, BWL: 82, ECO: 78, FLD: 80, IMP: 93 } },
  { id: "seed-viv-test", name: "Viv Richards", formatBucket: "test", role: "batter", ovr: 94, source: "seeded", profile: { BAT: 88, POW: 90, BWL: 20, ECO: 20, FLD: 74, IMP: 90 } },
  { id: "seed-hadlee", name: "Richard Hadlee", formatBucket: "test", role: "bowler", ovr: 94, source: "seeded", profile: { BAT: 44, POW: 46, BWL: 95, ECO: 88, FLD: 66, IMP: 90 } },
  { id: "seed-barry-richards", name: "Barry Richards", formatBucket: "test", role: "batter", ovr: 92, source: "seeded", profile: { BAT: 90, POW: 82, BWL: 18, ECO: 18, FLD: 66, IMP: 70 } },
  { id: "seed-marshall", name: "Malcolm Marshall", formatBucket: "test", role: "bowler", ovr: 93, source: "seeded", profile: { BAT: 34, POW: 40, BWL: 96, ECO: 86, FLD: 60, IMP: 88 } },
  { id: "seed-gavaskar", name: "Sunil Gavaskar", formatBucket: "test", role: "batter", ovr: 91, source: "seeded", profile: { BAT: 92, POW: 60, BWL: 15, ECO: 15, FLD: 66, IMP: 92 } },
  { id: "seed-imran", name: "Imran Khan", formatBucket: "test", role: "allrounder", ovr: 92, source: "seeded", profile: { BAT: 78, POW: 66, BWL: 90, ECO: 84, FLD: 66, IMP: 90 } },
  { id: "seed-knott", name: "Alan Knott", formatBucket: "test", role: "keeper", ovr: 86, source: "seeded", profile: { BAT: 72, POW: 58, BWL: 10, ECO: 10, FLD: 90, IMP: 82 } },
  { id: "seed-lillee", name: "Dennis Lillee", formatBucket: "test", role: "bowler", ovr: 92, source: "seeded", profile: { BAT: 32, POW: 40, BWL: 94, ECO: 84, FLD: 60, IMP: 88 } },
  { id: "seed-viv-odi", name: "Viv Richards", formatBucket: "odi", role: "batter", ovr: 93, source: "seeded", profile: { BAT: 86, POW: 92, BWL: 24, ECO: 30, FLD: 76, IMP: 88 } },
  { id: "seed-akram-odi", name: "Wasim Akram", formatBucket: "odi", role: "bowler", ovr: 92, source: "seeded", profile: { BAT: 50, POW: 60, BWL: 92, ECO: 86, FLD: 66, IMP: 90 } },
  { id: "seed-kapil-odi", name: "Kapil Dev", formatBucket: "odi", role: "allrounder", ovr: 89, source: "seeded", profile: { BAT: 68, POW: 74, BWL: 82, ECO: 80, FLD: 72, IMP: 88 } },
];
