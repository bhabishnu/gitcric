/**
 * Calibration harness. Fetches real GitHub signals for a panel of logins PLUS
 * synthetic band-anchors, and prints the full scoring trail so the
 * magnitude/legacy/eco constants can be tuned to the target distribution BEFORE
 * they're locked.
 *
 *   GITHUB_TOKEN=... npx tsx scripts/calibrate.ts [login ...]
 *
 * Target: empty/new <50 · casual 55-70 · solid 70-83 · strong OSS 84-90 ·
 * elite (torvalds) 93-97 · 99 unreachable.
 */
import "./_env.js";
import { fetchSignals } from "../lib/github/client.js";
import { trace } from "../lib/scoring/engine.js";
import type { Signals } from "../lib/scoring/types.js";

const REAL_PANEL = [
  "torvalds", // elite → 93-97
  "sindresorhus", // most-prolific OSS author
  "yyx990803", // Vue — focused flagship → high ECO
  "gaearon", // React
  "developit", // Preact — strong maintainer
  "sagikazarmark", // solid Go dev
  "bhabishnu", // repo owner — casual/new
];

// Synthetic anchors pin the bands without hunting for real accounts.
function synth(over: Partial<Signals>): Signals {
  return {
    login: "(synthetic)", name: "", avatarUrl: "", location: null,
    followers: 0, account_age_years: 0, public_repos: 0, total_stars_owned: 0,
    max_repo_stars: 0, repo_stars: [], languages: 0, rankedLanguages: [], topLanguage: null,
    recent_contributions: 0, active_days_recent: 0, active_years: 0,
    total_contributions_lifetime: 0, prs_to_others: 0, prs_merged_lifetime: 0,
    prs_opened_lifetime: 0, reviews: 0, issues_closed: 0, recent_commits: 0, recent_spike: false,
    ...over,
  };
}
const SYNTH: [string, Signals][] = [
  ["◦zero", synth({})],
  ["◦newbie", synth({ account_age_years: 0.1, public_repos: 2, languages: 2, total_contributions_lifetime: 3, active_years: 1, repo_stars: [0, 0] })],
  ["◦ghost", synth({ account_age_years: 0.4, public_repos: 1, languages: 1, total_contributions_lifetime: 12, active_years: 1, repo_stars: [0] })],
  ["◦casual", synth({ account_age_years: 2, public_repos: 8, followers: 10, total_stars_owned: 6, max_repo_stars: 4, repo_stars: [4, 1, 1, 0, 0], languages: 3, recent_contributions: 320, total_contributions_lifetime: 700, active_years: 2, prs_to_others: 6, prs_merged_lifetime: 5, prs_opened_lifetime: 9, reviews: 2, issues_closed: 4 })],
  ["◦scattered", synth({ account_age_years: 4, public_repos: 60, followers: 40, total_stars_owned: 30, max_repo_stars: 6, repo_stars: [6, 4, 3, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0], languages: 11, recent_contributions: 900, total_contributions_lifetime: 3000, active_years: 4, prs_to_others: 40, prs_merged_lifetime: 20, prs_opened_lifetime: 60, reviews: 15, issues_closed: 30 })],
  ["◦focused", synth({ account_age_years: 4, public_repos: 6, followers: 300, total_stars_owned: 2600, max_repo_stars: 2400, repo_stars: [2400, 120, 50, 20, 8, 2], languages: 2, recent_contributions: 1600, total_contributions_lifetime: 6000, active_years: 4, prs_to_others: 120, prs_merged_lifetime: 300, prs_opened_lifetime: 330, reviews: 90, issues_closed: 140 })],
  ["◦solid", synth({ account_age_years: 6, public_repos: 25, followers: 180, total_stars_owned: 450, max_repo_stars: 220, repo_stars: [220, 90, 60, 40, 20, 10, 6, 4], languages: 5, recent_contributions: 1400, total_contributions_lifetime: 9000, active_years: 6, prs_to_others: 260, prs_merged_lifetime: 240, prs_opened_lifetime: 300, reviews: 120, issues_closed: 160 })],
];

const kfmt = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);
const pad = (s: string | number, n: number) => String(s).padEnd(n);
const q = (s: string | number, n: number) => String(s).padStart(n);

function row(label: string, s: Signals) {
  const t = trace(s);
  const st = t.stats;
  const stats = [st.BAT, st.POW, st.BWL, st.ECO, st.FLD, st.IMP].map((x) => q(x, 3)).join(" ");
  return (
    pad(label, 14) +
    q(s.account_age_years.toFixed(1), 5) +
    q(kfmt(s.total_stars_owned), 7) +
    q(kfmt(s.followers), 7) +
    q(kfmt(s.total_contributions_lifetime), 7) +
    q(s.active_years, 4) +
    q(Math.round(t.focus * 100), 5) +
    q(t.center.toFixed(0), 5) +
    "  " + pad(stats, 24) +
    q(t.baseOVR, 5) +
    q(t.L.toFixed(2), 6) +
    q(t.ovr, 5) +
    "  " + t.family
  );
}

async function main() {
  const logins = process.argv.slice(2).filter(Boolean);
  const panel = logins.length ? logins : REAL_PANEL;

  console.log(
    "\n" + pad("account", 14) + q("age", 5) + q("stars", 7) + q("foll", 7) + q("life", 7) +
      q("yrs", 4) + q("ECO", 5) + q("ctr", 5) + "  " + pad("BAT POW BWL ECO FLD IMP", 24) +
      q("base", 5) + q("L", 6) + q("OVR", 5) + "  family",
  );
  console.log("-".repeat(104));
  if (!logins.length) for (const [label, s] of SYNTH) console.log(row(label, s));
  console.log("-".repeat(104));
  for (const login of panel) {
    try {
      console.log(row(login, await fetchSignals(login)));
    } catch (e) {
      console.log(pad(login, 14) + "  ERROR: " + (e as Error).message);
    }
  }
  console.log("");
}

main();
