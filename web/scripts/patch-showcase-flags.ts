/**
 * Refreshes ONLY the `face.flag` field of every card in gen/showcase.json.
 *
 * Deliberately not a re-run of gen:showcase: that re-scouts each profile and
 * would let the showcase OVRs drift as a side effect of a flag change. This
 * fetches each login's GitHub `location`, runs it through the SAME mapper the
 * live /[username] route uses, and writes back the resolved flag asset. Every
 * other byte of the file is left exactly as it was.
 *
 *   npx tsx scripts/patch-showcase-flags.ts
 */
import "./_env.js";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assetForUser, flagForUser } from "../lib/geo/location.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "..", "gen", "showcase.json");

async function locationOf(login: string): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const res = await fetch(`https://api.github.com/users/${login}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "gitcric",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${login}`);
  const j = (await res.json()) as { location?: string | null };
  return j.location ?? null;
}

async function main() {
  const file = JSON.parse(readFileSync(FILE, "utf8")) as {
    generatedAt: string;
    cards: { login: string; avatar: string | null; face: Record<string, unknown> }[];
  };

  for (const card of file.cards) {
    const loc = await locationOf(card.login);
    const code = flagForUser(card.login, loc);
    card.face.flag = assetForUser(card.login, loc);
    console.log(
      `  ${card.login.padEnd(16)} location=${JSON.stringify(loc).padEnd(20)} -> ${code ?? "NO FLAG"}`,
    );
  }

  writeFileSync(FILE, JSON.stringify(file, null, 1));
  console.log(`\npatched ${file.cards.length} showcase cards (flag field only)`);
}

main();
