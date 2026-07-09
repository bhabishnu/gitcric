import type { CardStats, FormatBucket, LegendAnchor, Role, StatKey } from "../types/stats.js";
import { EQUATE } from "../config/calibration.js";
import { SEEDED_ANCHORS } from "../legends/anchors.seed.js";
import type { Calibrated } from "./calibrate.js";
import type { OvrResult } from "./ovr.js";

const STAT_KEYS: StatKey[] = ["BAT", "POW", "BWL", "ECO", "FLD", "IMP"];

/** How many top-OVR players per (bucket, role) become COMPUTED legend anchors. */
const COMPUTED_ANCHORS_PER_GROUP = 6;

export interface EquateResult {
  anchorId: string;
  distance: number;
}

function distance(stats: CardStats, ovr: number, anchor: LegendAnchor): number {
  let d = 0;
  for (const k of STAT_KEYS) d += EQUATE.statWeight * (stats[k] - anchor.profile[k]) ** 2;
  d += EQUATE.ovrWeight * (ovr - anchor.ovr) ** 2;
  return d;
}

/**
 * Stage 7 — EQUATE each card to its nearest benchmark legend via weighted
 * distance in (6-stat profile + OVR) within the SAME format bucket and SAME
 * role. Modern legends become computed anchors (top OVRs per group); pre-2000s
 * greats are the seeded anchors. Returns per-key equate results plus the full
 * anchor table to persist.
 */
export function equate(
  calibrated: Map<string, Calibrated>,
  ovr: Map<string, OvrResult>,
): { equated: Map<string, EquateResult>; anchors: LegendAnchor[] } {
  // 1) build computed anchors: top-N OVR per (bucket, role)
  const groups = new Map<string, { key: string; playerId: string; name: string; bucket: FormatBucket; role: Role; stats: CardStats; ovr: number }[]>();
  for (const [key, o] of ovr) {
    const c = calibrated.get(key)!;
    const g = `${c.agg.bucket}|${o.role}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push({ key, playerId: c.agg.playerId, name: c.agg.playerId, bucket: c.agg.bucket, role: o.role, stats: o.stats, ovr: o.ovr });
  }
  const computed: LegendAnchor[] = [];
  const computedKeys = new Set<string>();
  for (const list of groups.values()) {
    list.sort((a, b) => b.ovr - a.ovr);
    for (const p of list.slice(0, COMPUTED_ANCHORS_PER_GROUP)) {
      computed.push({ id: p.playerId, name: p.name, formatBucket: p.bucket, role: p.role, profile: p.stats, ovr: p.ovr, source: "computed" });
      computedKeys.add(p.key);
    }
  }

  const anchors: LegendAnchor[] = [...SEEDED_ANCHORS, ...computed];

  // index anchors by bucket|role and by bucket for fallback
  const byBucketRole = new Map<string, LegendAnchor[]>();
  const byBucket = new Map<string, LegendAnchor[]>();
  for (const a of anchors) {
    const br = `${a.formatBucket}|${a.role}`;
    (byBucketRole.get(br) ?? byBucketRole.set(br, []).get(br)!).push(a);
    (byBucket.get(a.formatBucket) ?? byBucket.set(a.formatBucket, []).get(a.formatBucket)!).push(a);
  }

  // 2) equate every gated card
  const equated = new Map<string, EquateResult>();
  for (const [key, o] of ovr) {
    const c = calibrated.get(key)!;
    const bucket = c.agg.bucket;
    const pool = byBucketRole.get(`${bucket}|${o.role}`) ?? byBucket.get(bucket) ?? [];
    let best: EquateResult | null = null;
    for (const anchor of pool) {
      if (anchor.id === c.agg.playerId) continue; // don't equate a player to themselves
      const d = distance(o.stats, o.ovr, anchor);
      if (!best || d < best.distance) best = { anchorId: anchor.id, distance: d };
    }
    if (best) equated.set(key, best);
  }

  return { equated, anchors };
}
