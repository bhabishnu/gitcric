import "./_env.js";
import { fetchSignals } from "../lib/github/client.js";
import { buildUserCard } from "../lib/scoring/engine.js";

// A spread of edge cases: brand-new, zero-repo, org-like, prolific, null-name.
const users = process.argv.slice(2).filter(Boolean).length
  ? process.argv.slice(2)
  : ["torvalds", "defunkt", "gvanrossum", "octocat", "gaearon"];

async function main() {
  for (const u of users) {
    try {
      const s = await fetchSignals(u);
      const c = buildUserCard(s);
      const bad = [c.ovr, ...Object.values(c.stats)].some((n) => !Number.isFinite(n));
      console.log(
        `${u.padEnd(20)} ovr=${c.ovr} repos=${s.public_repos} maxStars=${s.max_repo_stars} yrs=${s.active_years} life=${s.total_contributions_lifetime} name=${JSON.stringify(s.name)} ${bad ? "‼ NON-FINITE" : "ok"}`,
      );
    } catch (e) {
      console.log(`${u.padEnd(20)} ERROR ${(e as Error).message}`);
    }
  }
}
main();
