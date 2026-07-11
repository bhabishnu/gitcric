/**
 * Faithful reimplementation of GitFut's football engine (lib/scoring/engine.ts +
 * constants.ts, verbatim constants) over OUR Signals — used ONLY as the parity
 * target for calibration. Returns the OVR GitFut would give a username, so we
 * can tune GitCric to within ±3 of it.
 */
import type { Signals } from "../lib/scoring/types.js";

const Lg = (x: number) => Math.log10(Math.max(0, x) + 1);
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

type SK = "pac" | "sho" | "pas" | "dri" | "def" | "phy";
const STATS: SK[] = ["pac", "sho", "pas", "dri", "def", "phy"];
const ATTACK: SK[] = ["pac", "sho", "pas", "dri"];
type Rec = Record<SK, number>;

const K = {
  magnitude: { w1: 0.5, w2: 0.4, w3: 0.5, w4: 0.08, b: -2.8, lo: 48, hi: 82 },
  tension: { alpha: 0.7, pairs: [["sho", "def"], ["dri", "phy"], ["pac", "def"]] as [SK, SK][] },
  spike: { base: 8, cohesion: 0.6 },
  legacy: { a: 1.0, b: 0.7, c: 0.3, d: 0.3, e: 0.3, f: 6.0, activeCap: 15, bonusMax: 11 },
  ovrCap: 88,
};
type Fam = "Forward" | "Playmaker" | "Anchor";
const WEIGHTS: Record<Fam, Rec> = {
  Forward: { pac: 0.2, sho: 0.3, pas: 0.1, dri: 0.2, def: 0.05, phy: 0.15 },
  Playmaker: { pac: 0.1, sho: 0.15, pas: 0.3, dri: 0.25, def: 0.1, phy: 0.1 },
  Anchor: { pac: 0.1, sho: 0.05, pas: 0.15, dri: 0.1, def: 0.4, phy: 0.2 },
};

function rawStats(s: Signals): Rec {
  const o: Rec = {
    pac: 36 + 12 * Lg(s.recent_contributions),
    sho: 36 + 13 * Lg(s.total_stars_owned) + 5 * Lg(s.max_repo_stars),
    pas: 40 + 12 * Lg(s.prs_to_others) + 9 * Lg(s.followers),
    dri: 58 + 7 * Math.sqrt(s.languages),
    def: 40 + 14 * Lg(s.reviews + s.issues_closed),
    phy: 40 + 9 * Lg(s.total_contributions_lifetime) + 2.2 * Math.min(s.active_years, 12),
  };
  for (const k of STATS) o[k] = clamp(Math.round(o[k]), 1, 99);
  return o;
}
function center(s: Signals): number {
  const { w1, w2, w3, w4, b, lo, hi } = K.magnitude;
  const M = sigmoid(w1 * Lg(s.total_stars_owned) + w2 * Lg(s.followers) + w3 * Lg(s.total_contributions_lifetime) + w4 * s.account_age_years + b);
  return lerp(lo, hi, M);
}
function zscore(raw: Rec): Rec {
  const v = STATS.map((k) => raw[k]);
  const m = mean(v);
  const sd = Math.sqrt(mean(v.map((x) => (x - m) ** 2))) || 1;
  const p = {} as Rec;
  STATS.forEach((k, i) => (p[k] = (v[i] - m) / sd));
  return p;
}
function tension(p: Rec): Rec {
  const out = { ...p };
  for (const [a, b] of K.tension.pairs) {
    const overlap = Math.max(0, Math.min(out[a], out[b]));
    const weaker = out[a] <= out[b] ? a : b;
    out[weaker] -= K.tension.alpha * overlap;
  }
  return out;
}
function spike(p: Rec, c: number): Rec {
  const v = STATS.map((k) => p[k]);
  const lop = clamp((Math.max(...v) - Math.min(...v)) / 4, 0, 1);
  const spread = K.spike.base * (1 + lop);
  const m = mean(v);
  const raw = {} as Rec;
  STATS.forEach((k) => (raw[k] = c + spread * (p[k] - m)));
  const am = mean(ATTACK.map((k) => raw[k]));
  ATTACK.forEach((k) => (raw[k] = am + K.spike.cohesion * (raw[k] - am)));
  const st = {} as Rec;
  STATS.forEach((k) => (st[k] = clamp(Math.round(raw[k]), 1, 99)));
  return st;
}
function family(st: Rec): Fam {
  const fam: Record<Fam, number> = { Forward: st.sho + st.pac, Playmaker: st.pas + st.dri, Anchor: st.def + st.phy };
  return (Object.keys(fam) as Fam[]).sort((a, b) => fam[b] - fam[a])[0];
}
function weightedOVR(st: Rec, fam: Fam): number {
  const w = WEIGHTS[fam];
  return Math.min(Math.round(STATS.reduce((s, k) => s + st[k] * w[k], 0)), K.ovrCap);
}
function legacy(s: Signals): number {
  const { a, b, c, d, e, f, activeCap } = K.legacy;
  return sigmoid(a * Math.log(s.account_age_years + 1) + b * Math.min(s.active_years, activeCap) + c * Lg(s.followers) + d * Lg(s.total_stars_owned) + e * Lg(s.max_repo_stars) - f);
}

/** GitFut's overall for these signals (the parity target). */
export function gitfutOvr(s: Signals): { ovr: number; base: number; L: number } {
  const st = spike(tension(zscore(rawStats(s))), center(s));
  const base = weightedOVR(st, family(st));
  const L = legacy(s);
  return { ovr: clamp(base + Math.round(K.legacy.bonusMax * L), 1, 99), base, L };
}
