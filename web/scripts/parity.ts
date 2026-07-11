import "./_env.js";
import { fetchSignals } from "../lib/github/client.js";
import { buildUserCard } from "../lib/scoring/engine.js";
import { gitfutOvr } from "./gitfut-ref.js";
import type { Signals } from "../lib/scoring/types.js";

const PANEL = ["torvalds", "gvanrossum", "mojombo", "sagikazarmark", "bhabishnu"];

function synth(over: Partial<Signals>): Signals {
  return {
    login: "(synthetic)", name: "", avatarUrl: "", location: null, followers: 0, account_age_years: 0,
    public_repos: 0, total_stars_owned: 0, max_repo_stars: 0, repo_stars: [], languages: 0,
    rankedLanguages: [], topLanguage: null, recent_contributions: 0, active_days_recent: 0, active_years: 0,
    total_contributions_lifetime: 0, prs_to_others: 0, prs_merged_lifetime: 0, prs_opened_lifetime: 0,
    reviews: 0, issues_closed: 0, recent_commits: 0, recent_spike: false, ...over,
  };
}
const SYNTH: [string, Signals][] = [
  ["◦empty", synth({ account_age_years: 0.3, public_repos: 1, languages: 1, total_contributions_lifetime: 8, active_years: 1, repo_stars: [0] })],
  ["◦casual", synth({ account_age_years: 2, public_repos: 8, followers: 10, total_stars_owned: 6, max_repo_stars: 4, repo_stars: [4, 1, 1], languages: 3, recent_contributions: 320, total_contributions_lifetime: 700, active_years: 2, prs_to_others: 6, prs_merged_lifetime: 5, prs_opened_lifetime: 9, reviews: 2, issues_closed: 4 })],
  ["◦solid", synth({ account_age_years: 6, public_repos: 25, followers: 180, total_stars_owned: 450, max_repo_stars: 220, repo_stars: [220, 90, 60, 40, 20], languages: 5, recent_contributions: 1400, total_contributions_lifetime: 9000, active_years: 6, prs_to_others: 260, prs_merged_lifetime: 240, prs_opened_lifetime: 300, reviews: 120, issues_closed: 160 })],
];

const pad = (s: string | number, n: number) => String(s).padEnd(n);
const q = (s: string | number, n: number) => String(s).padStart(n);

function row(label: string, s: Signals) {
  const g = gitfutOvr(s);
  const c = buildUserCard(s);
  const diff = c.ovr - g.ovr;
  const flag = Math.abs(diff) > 3 ? "  ‼ >3" : "";
  return pad(label, 16) + q(`gitfut ${g.ovr}`, 11) + q(`gitcric ${c.ovr}`, 13) + q(`Δ${diff >= 0 ? "+" : ""}${diff}`, 7) + flag;
}

async function main() {
  const logins = process.argv.slice(2).filter(Boolean);
  const panel = logins.length ? logins : PANEL;
  console.log("\n" + pad("account", 16) + q("GitFut", 11) + q("GitCric", 13) + q("Δ", 7));
  console.log("-".repeat(50));
  if (!logins.length) for (const [l, s] of SYNTH) console.log(row(l, s));
  console.log("-".repeat(50));
  let worst = 0, sum = 0, n = 0;
  for (const login of panel) {
    try {
      const s = await fetchSignals(login);
      const g = gitfutOvr(s), c = buildUserCard(s);
      const d = Math.abs(c.ovr - g.ovr);
      worst = Math.max(worst, d); sum += d; n++;
      console.log(row(login, s));
    } catch (e) {
      console.log(pad(login, 16) + "  ERROR " + (e as Error).message);
    }
  }
  console.log("-".repeat(50));
  console.log(`real accounts: mean |Δ| = ${(sum / Math.max(n, 1)).toFixed(1)}, worst = ${worst}\n`);
}
main();
