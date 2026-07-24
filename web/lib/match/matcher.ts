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
 *   - ±3 OVR window (±4 above OVR 92, where the pool thins out); if empty (a very
 *     low/high user OVR), take the nearest by OVR.
 *   - Then SAMPLE, seeded by username, among the top-N most-capped candidates in
 *     that window — rather than always taking the single nearest/most-famous,
 *     which handed Kohli to every elite IPL slot and made high-OVR users
 *     interchangeable. Ranking by career matches first keeps the whole sampling
 *     bag recognizable; the seed picks from within it.
 *   - Role variety across the four slots is still preferred, and applied BEFORE
 *     the sample so it can't be undone by it.
 *   - Deterministic: the same username always yields the same four twins, and a
 *     given user's twins are stable forever (the sort is a total order, so it
 *     never depends on the index's incidental row order).
 */

export const BUCKETS: FormatBucket[] = ["test", "odi", "t20i", "ipl"];

/** Recognizability dials (tuned against the "casual fan knows them" bar). */
export const RECOGNIZE = {
  minGatedFormats: 2,
  /** OVR half-window: prefer twins within ±this of the user. */
  window: 3,
  /** Above `wideAboveOvr` the eligible pool thins (single digits per bucket at
   *  92+), so widen slightly rather than collapsing onto the same one or two
   *  legends for everyone up there. */
  wideWindow: 4,
  wideAboveOvr: 92,
  /** A window this thin can't be sampled — at OVR 99 the ±4 Test window holds
   *  exactly one card (Murali at 95), so every ceiling user got the same twin.
   *  Below this, reach for the nearest `sampleTopN` instead and accept a wider
   *  OVR gap: a user above the whole format's scale has no exact peer anyway. */
  minWindow: 4,
  /** Sample among this many of the window's most-capped candidates. Big enough
   *  that elite users see varied legends, small enough that everyone in the bag
   *  is still a name a casual fan knows. */
  sampleTopN: 12,
  /** Role variety across the four slots is a WEIGHT, not a filter. The bag skews
   *  hard to batters (the IPL 91-99 bag is 9 batters / 2 bowlers / 1 keeper), so
   *  filtering the last slot down to an unused role left ~2 candidates — which is
   *  how every elite user landed on the same IPL bowler. Giving unused roles this
   *  many entries in the sampling bag keeps every candidate reachable while still
   *  leaning toward a varied four. Measured over 2,000 synthetic users: weight 3
   *  holds all 12 legends per slot at a ≤18% top share (vs 100% before) and
   *  roughly doubles role variety against a hard filter. */
  novelRoleWeight: 3,
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

/** The OVR half-window for a user — wider where the elite pool thins out. */
function windowFor(userOvr: number): number {
  return userOvr > RECOGNIZE.wideAboveOvr ? RECOGNIZE.wideWindow : RECOGNIZE.window;
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
  const seed = username.toLowerCase();

  for (const bucket of BUCKETS) {
    const pool = index[bucket].filter(isRecognizable);
    if (pool.length === 0) {
      out[bucket] = null;
      continue;
    }
    // ±window candidates. If that window is empty or too thin to sample (a user
    // at the ceiling is above every Test card), reach for the N NEAREST instead —
    // otherwise everyone up there shares one twin.
    const half = windowFor(userOvr);
    let window = pool.filter((r) => Math.abs(r.ovr - userOvr) <= half);
    if (window.length < RECOGNIZE.minWindow) {
      window = [...pool]
        .sort(
          (a, b) =>
            Math.abs(a.ovr - userOvr) - Math.abs(b.ovr - userOvr) ||
            b.matches - a.matches ||
            (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        )
        .slice(0, RECOGNIZE.sampleTopN);
    }

    // Rank by fame so the sampling bag is entirely recognizable. The id tiebreak
    // makes this a TOTAL order: the bag never depends on the index's row order,
    // which is what lets a user's twins be stable forever.
    const ranked = [...window].sort(
      (a, b) =>
        b.matches - a.matches || // more career matches (more famous)
        Math.abs(a.ovr - userOvr) - Math.abs(b.ovr - userOvr) || // closer OVR
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    const bag = ranked.slice(0, RECOGNIZE.sampleTopN);

    // Lean toward a role we haven't used yet by weighting, not filtering, so the
    // whole bag stays reachable (see novelRoleWeight).
    const weighted = bag.flatMap((r) =>
      Array<IndexRow>(usedRoles.has(r.role) ? 1 : RECOGNIZE.novelRoleWeight).fill(r),
    );
    const best = weighted[hash(`${seed}:${bucket}`) % weighted.length];

    usedRoles.add(best.role);
    out[bucket] = { ...best, bucket, ovrGap: Math.abs(best.ovr - userOvr) };
  }
  return out;
}
