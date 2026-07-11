import type { IndexRow } from "../data";
import type { FormatBucket } from "../data";

/**
 * THE MATCHER. Given a user's single (format-agnostic) OVR and their username,
 * pick the nearest RECOGNIZABLE cricketer in each of the four formats — the twin
 * you'd "be" in Tests / ODIs / T20Is / the IPL.
 *
 *   - Recognizable pool only (the H-Ssenyondo fix): a multi-format international
 *     (gated in ≥2 formats) or a legend anchor. Associate-nation minnows are
 *     gated in t20i only and fall out.
 *   - ±3 OVR window; if empty (very low/high user OVR), take the nearest by OVR.
 *   - Tiebreak toward role variety across the four slots, then more career
 *     matches, then a deterministic per-username hash.
 *   - Deterministic: the same username always yields the same four twins.
 */

export const BUCKETS: FormatBucket[] = ["test", "odi", "t20i", "ipl"];

/** Recognizability dials (tuned against the "casual fan knows them" bar). */
export const RECOGNIZE = {
  minGatedFormats: 2,
  /** OVR half-window: prefer twins within ±this of the user. */
  window: 3,
};

export interface Twin extends IndexRow {
  bucket: FormatBucket;
  /** |user OVR − twin OVR|, for the "how close" read. */
  ovrGap: number;
}

/** FNV-1a → a stable 32-bit hash, for deterministic tiebreaks. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function isRecognizable(r: IndexRow): boolean {
  // NOTE: deliberately NOT `|| r.isAnchor`. Computed anchors are just the top-OVR
  // players per (bucket, role) — which is precisely how associate-nation
  // percentile-toppers (Virandeep Singh, gformats=1, T20I-only) sneak in. The
  // multi-format gate is the honest recognizability signal; genuine top players
  // (Buttler, Kohli, Rohit) clear it on their own.
  return r.gformats >= RECOGNIZE.minGatedFormats;
}

/** Deterministic per-(username,candidate) jitter in [0,1) for final tiebreaks. */
function jitter(username: string, id: string): number {
  return hash(`${username.toLowerCase()}:${id}`) / 0x100000000;
}

/**
 * Pick the four twins. `index` is the per-bucket recognizable-eligible pool
 * (full index; we filter here). Processes buckets in a fixed order, greedily
 * preferring a role not yet used so the four slots show variety.
 */
export function pickTwins(
  userOvr: number,
  username: string,
  index: Record<FormatBucket, IndexRow[]>,
): Record<FormatBucket, Twin | null> {
  const out = {} as Record<FormatBucket, Twin | null>;
  const usedRoles = new Set<string>();

  for (const bucket of BUCKETS) {
    const pool = index[bucket].filter(isRecognizable);
    if (pool.length === 0) {
      out[bucket] = null;
      continue;
    }
    // ±window candidates; fall back to the nearest by OVR if the window is empty.
    let window = pool.filter((r) => Math.abs(r.ovr - userOvr) <= RECOGNIZE.window);
    if (window.length === 0) {
      const nearest = Math.min(...pool.map((r) => Math.abs(r.ovr - userOvr)));
      window = pool.filter((r) => Math.abs(r.ovr - userOvr) === nearest);
    }
    const best = window
      .map((r) => ({
        r,
        novelty: usedRoles.has(r.role) ? 0 : 1,
        j: jitter(username, r.id),
      }))
      .sort(
        (a, b) =>
          b.novelty - a.novelty || // 1) a role we haven't used yet
          b.r.matches - a.r.matches || // 2) more career matches (more famous)
          Math.abs(a.r.ovr - userOvr) - Math.abs(b.r.ovr - userOvr) || // 3) closer OVR
          a.j - b.j, // 4) deterministic per-username tiebreak
      )[0].r;

    usedRoles.add(best.role);
    out[bucket] = { ...best, bucket, ovrGap: Math.abs(best.ovr - userOvr) };
  }
  return out;
}
