/**
 * Matcher validation. Prints the four twins for a spread of OVRs AND for real
 * usernames, plus a determinism check. Acceptance bar: every twin is a name a
 * casual cricket fan knows.
 *
 *   GITHUB_TOKEN=... npx tsx scripts/match-check.ts [login ...]
 */
import "./_env.js";
import { PLAYER_INDEX, type FormatBucket } from "../lib/data.js";
import { BUCKETS, pickTwins } from "../lib/match/matcher.js";
import { fetchSignals } from "../lib/github/client.js";
import { buildUserCard } from "../lib/scoring/engine.js";

function line(label: string, ovr: number, username: string) {
  const twins = pickTwins(ovr, username, PLAYER_INDEX);
  const cells = BUCKETS.map((b: FormatBucket) => {
    const t = twins[b];
    if (!t) return `${b}: —`;
    const gap = t.ovrGap ? `±${t.ovrGap}` : "=";
    return `${b}: ${t.name} ${t.ovr}${gap} ${t.role[0]}`;
  });
  console.log(`\n${label} (OVR ${ovr}, seed "${username}")`);
  for (const c of cells) console.log(`   ${c}`);
}

async function main() {
  const logins = process.argv.slice(2).filter(Boolean);

  console.log("═══ ACROSS THE OVR SPECTRUM (seed = 'sample') ═══");
  for (const ovr of [49, 55, 62, 70, 78, 85, 90, 95]) line(`band`, ovr, "sample");

  console.log("\n═══ SAME OVR, DIFFERENT SEEDS (determinism + variety) ═══");
  for (const u of ["alice", "bob", "charlie"]) line(`user ${u}`, 78, u);

  console.log("\n═══ DETERMINISM: same seed twice ═══");
  const a = JSON.stringify(pickTwins(78, "alice", PLAYER_INDEX));
  const b = JSON.stringify(pickTwins(78, "alice", PLAYER_INDEX));
  console.log(`   alice==alice: ${a === b ? "IDENTICAL ✓" : "DIFFERENT ✗"}`);

  if (logins.length) {
    console.log("\n═══ REAL USERS (GitHub → OVR → twins) ═══");
    for (const login of logins) {
      try {
        const card = buildUserCard(await fetchSignals(login));
        line(`@${login} [${card.archetype.name}]`, card.ovr, login);
      } catch (e) {
        console.log(`\n@${login}  ERROR: ${(e as Error).message}`);
      }
    }
  }
  console.log("");
}

main();
