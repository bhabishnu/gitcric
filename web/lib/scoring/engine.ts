import { archetypeFor } from "./archetypes";
import { BAT_GROUP, BOWL_GROUP, FAMILY_ROLE, K, STATS, WEIGHTS } from "./constants";
import type { Family, Profile, ScoutLine, Signals, Stats, StatKey, Tier, UserCard } from "./types";

const Lg = (x: number) => Math.log10(Math.max(0, x) + 1);
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const clamp01 = (x: number) => clamp(x, 0, 1);
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const vals = (s: Profile) => STATS.map((k) => s[k]);

/**
 * ECO = discipline. A focused single-project maintainer reads high; an account
 * of many scattered, abandoned repos reads visibly lower — but never punitively
 * (floor stays at base). Three fair signals, no single one dominating:
 *   - concentration (HHI of repo stars): one flagship vs stars sprayed thin
 *   - language focus: a tight stack vs sprawling across everything
 *   - merge discipline: PRs finished (merged) vs opened
 */
export function focus(s: Signals): number {
  const total = s.repo_stars.reduce((a, b) => a + b, 0);
  // Concentration of reach in a flagship vs sprayed thin. No stars at all is
  // unproven discipline, near-zero — an empty account hasn't earned any focus,
  // so its ECO floors out flat with the rest of the card rather than spiking.
  const hhi = total > 0 ? s.repo_stars.reduce((a, st) => a + (st / total) ** 2, 0) : 0.1;
  // A tight stack only reads as focus if there's actually a project to focus on;
  // "1 language" across 0-1 empty repos is emptiness, so it's discounted hard.
  let langFocus = clamp01(1 - (s.languages - 1) / K.eco.langSpan); // 1 lang→1, 13+→0
  if (s.public_repos < 2) langFocus = 0.1;
  const mergeRatio = s.prs_opened_lifetime > 0 ? s.prs_merged_lifetime / s.prs_opened_lifetime : 0.15;
  return clamp01(K.eco.wConc * hhi + K.eco.wLang * langFocus + K.eco.wMerge * mergeRatio);
}

// §2 — raw axis estimates, re-mapped from GitFut's football analogs.
function rawStats(s: Signals): Stats {
  const o: Stats = {
    BAT: 40 + 13 * Lg(s.total_stars_owned) + 5 * Lg(s.max_repo_stars), // sustained quality
    POW: 36 + 12 * Lg(s.recent_contributions), // velocity
    BWL: 40 + 12 * Lg(s.prs_to_others) + 9 * Lg(s.issues_closed), // delivery
    ECO: K.eco.base + K.eco.gain * focus(s), // discipline / focus
    FLD: 40 + 15 * Lg(s.reviews) + 4 * Lg(s.followers), // collaboration
    IMP: 40 + 9 * Lg(s.total_contributions_lifetime) + 2.2 * Math.min(s.active_years, 12), // longevity
  };
  for (const k of STATS) o[k] = clamp(Math.round(o[k]), 1, 99);
  return o;
}

// §3.1 — magnitude sigmoid → the center the stats gravitate toward.
function center(s: Signals): number {
  const { wStars, wFollowers, wLifetime, wAge, b, lo, hi } = K.magnitude;
  const M = sigmoid(
    wStars * Lg(s.total_stars_owned) +
      wFollowers * Lg(s.followers) +
      wLifetime * Lg(s.total_contributions_lifetime) +
      wAge * s.account_age_years +
      b,
  );
  return lerp(lo, hi, M);
}

// §3.2 — z-score their own six.
function zscore(raw: Stats): Profile {
  const v = vals(raw);
  const m = mean(v);
  const sd = Math.sqrt(mean(v.map((x) => (x - m) ** 2))) || 1;
  const p = {} as Profile;
  STATS.forEach((k, i) => (p[k] = (v[i] - m) / sd));
  return p;
}

// §3.3 — penalise antagonist pairs so nobody is elite at everything.
function applyTension(p: Profile): Profile {
  const out = { ...p };
  for (const [a, b] of K.tension.pairs) {
    const overlap = Math.max(0, Math.min(out[a], out[b]));
    const weaker = out[a] <= out[b] ? a : b;
    out[weaker] -= K.tension.alpha * overlap;
  }
  return out;
}

// §3.4 — spike around center; specialists get spikier cards, then pull each
// discipline's pair toward its own mean (kills random intra-discipline gaps
// while letting batting and bowling break apart — the shape tells the story).
// `atten` damps the spike when the RAW axes are near-flat: z-scoring would
// otherwise manufacture a fake specialist out of noise (an empty account read as
// an "ECO specialist"), inflating the floor. A real specialist has genuine raw
// spread and is untouched.
function spike(p: Profile, c: number, raw: Stats): Stats {
  const rv = vals(raw);
  const atten = clamp((Math.max(...rv) - Math.min(...rv)) / K.spike.flatSpan, K.spike.flatFloor, 1);
  const v = vals(p);
  const lop = clamp((Math.max(...v) - Math.min(...v)) / 4, 0, 1);
  const spread = K.spike.base * (1 + lop) * atten;
  const m = mean(v);
  const sp = {} as Stats;
  STATS.forEach((k) => (sp[k] = c + spread * (p[k] - m)));
  for (const group of [BAT_GROUP, BOWL_GROUP]) {
    const gm = mean(group.map((k) => sp[k]));
    group.forEach((k) => (sp[k] = gm + K.spike.cohesion * (sp[k] - gm)));
  }
  const stats = {} as Stats;
  STATS.forEach((k) => (stats[k] = clamp(Math.round(sp[k]), 1, 99)));
  return stats;
}

// §3.5 — family from shape (which discipline dominates, or both → allrounder).
function familyFromShape(st: Stats): Family {
  const bat = st.BAT + st.POW;
  const bowl = st.BWL + st.ECO;
  const gap = Math.abs(bat - bowl);
  // genuinely two-sided AND both disciplines above the mid-40s → allrounder
  if (gap <= 14 && Math.min(bat, bowl) >= 96) return "AllRound";
  return bat >= bowl ? "Batting" : "Bowling";
}

// §3.6 — position-weighted; stats alone cap at 88.
function weightedOVR(stats: Stats, family: Family): number {
  const w = WEIGHTS[family];
  const ovr = STATS.reduce((s, k) => s + stats[k] * w[k], 0);
  return Math.min(Math.round(ovr), K.ovrCap);
}

// §4 — the 88→99 range, bought with years + sustained influence (GitFut's
// formula, for OVR parity).
function legacyScore(s: Signals): number {
  const { aAge, bActive, cFoll, dStars, eMax, f, activeCap } = K.legacy;
  const z =
    aAge * Math.log(s.account_age_years + 1) +
    bActive * Math.min(s.active_years, activeCap) +
    cFoll * Lg(s.followers) +
    dStars * Lg(s.total_stars_owned) +
    eMax * Lg(s.max_repo_stars) -
    f;
  return sigmoid(z);
}

function tierFor(ovr: number): Tier {
  if (ovr >= K.tier.immortalMin) return "immortal";
  if (ovr >= K.tier.goldMin) return "gold";
  if (ovr >= K.tier.silverMin) return "silver";
  return "bronze";
}

function eyebrowFor(ovr: number): string {
  if (ovr >= K.eyebrow.generational) return "GENERATIONAL";
  if (ovr >= K.eyebrow.captainsPick) return "CAPTAIN'S PICK";
  if (ovr >= K.eyebrow.squad) return "IN THE SQUAD";
  return "ON THE FRINGE";
}

function scoutReport(s: Signals): ScoutLine[] {
  // fill = a log-scaled 0..1 read for the bar, purely visual.
  const bar = (x: number, k: number) => clamp01(Lg(x) / k);
  return [
    { label: "Stars earned", value: fmt(s.total_stars_owned), fill: bar(s.total_stars_owned, 4), axis: "BAT" },
    { label: "Top repo reach", value: fmt(s.max_repo_stars), fill: bar(s.max_repo_stars, 4), axis: "BAT" },
    { label: "Commits (yr)", value: fmt(s.recent_contributions), fill: bar(s.recent_contributions, 3.4), axis: "POW" },
    { label: "PRs merged", value: fmt(s.prs_to_others), fill: bar(s.prs_to_others, 2.6), axis: "BWL" },
    { label: "Issues closed", value: fmt(s.issues_closed), fill: bar(s.issues_closed, 2.6), axis: "BWL" },
    { label: "Focus", value: `${Math.round(focus(s) * 100)}%`, fill: focus(s), axis: "ECO" },
    { label: "Code reviews", value: fmt(s.reviews), fill: bar(s.reviews, 2.4), axis: "FLD" },
    { label: "Followers", value: fmt(s.followers), fill: bar(s.followers, 3.5), axis: "FLD" },
    { label: "Lifetime work", value: fmt(s.total_contributions_lifetime), fill: bar(s.total_contributions_lifetime, 4.2), axis: "IMP" },
    { label: "Active years", value: `${s.active_years}`, fill: clamp01(s.active_years / 15), axis: "IMP" },
  ];
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

/** Calibration trace — the intermediate values, for the tuning loop only. */
export function trace(s: Signals) {
  const raw = rawStats(s);
  const c = center(s);
  const stats = spike(applyTension(zscore(raw)), c, raw);
  const family = familyFromShape(stats);
  const baseOVR = weightedOVR(stats, family);
  const L = legacyScore(s);
  const ovr = clamp(baseOVR + Math.round(K.legacy.bonusMax * L), 1, K.ovrMax);
  return { raw, center: c, stats, family, baseOVR, L, ovr, focus: focus(s) };
}

/** The full port: signals → the user's YOU card. */
export function buildUserCard(s: Signals): UserCard {
  const raw0 = rawStats(s);
  const stats = spike(applyTension(zscore(raw0)), center(s), raw0);
  const family = familyFromShape(stats);
  const baseOVR = weightedOVR(stats, family);
  const L = legacyScore(s);
  const ovr = clamp(baseOVR + Math.round(K.legacy.bonusMax * L), 1, K.ovrMax);
  const role = FAMILY_ROLE[family];
  const archetype = archetypeFor(stats, role, ovr);
  return {
    login: s.login,
    name: s.name || s.login,
    avatarUrl: s.avatarUrl,
    location: s.location,
    stats,
    role,
    family,
    baseOVR,
    ovr,
    tier: tierFor(ovr),
    archetype,
    eyebrow: eyebrowFor(ovr),
    topLanguage: s.topLanguage,
    legacy: L,
    scout: scoutReport(s),
  };
}
