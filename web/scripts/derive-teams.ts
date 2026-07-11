/**
 * EXPORT ADDITION (C7/C8 foundation). Derives each player's nation and most
 * recent IPL franchise straight from the raw Cricsheet match files — the source
 * of truth for team membership — and writes web/gen/identity.json.
 *
 *   nation      = the international team a player appeared for most often across
 *                 Test/ODI/T20I matches (those team names ARE nations).
 *   lastIplTeam = the franchise in their most recent IPL match by date (so a
 *                 retired player keeps the team they actually last played for).
 *
 * The raw IPL data already runs through the 2026 season, so no re-ingest is
 * needed for current franchises.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const RAW = join(ROOT, "data", "raw");
const OUT = join(__dirname, "..", "gen");

const INTL_DIRS = ["tests", "odis", "t20s"]; // team name = nation
const IPL_DIR = "ipl";

// Composite/exhibition sides (World XI, Asia XI, Africa XI, ICC World XI) are not
// nations — exclude them so a player's real country wins the tally.
const NOT_A_NATION = (team: string) => /\bXI\b/i.test(team) || /world|invitation/i.test(team);

interface MatchInfo {
  teams?: string[];
  dates?: string[];
  players?: Record<string, string[]>;
  registry?: { people?: Record<string, string> };
}

function readMatches(dir: string): { info: MatchInfo }[] {
  const full = join(RAW, dir);
  let files: string[];
  try {
    files = readdirSync(full).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out: { info: MatchInfo }[] = [];
  for (const f of files) {
    try {
      out.push(JSON.parse(readFileSync(join(full, f), "utf8")));
    } catch {
      /* skip unreadable */
    }
  }
  return out;
}

function main() {
  const nationTally = new Map<string, Map<string, number>>(); // id -> team -> count
  const iplLast = new Map<string, { team: string; date: string }>(); // id -> most recent

  const tallyNation = (id: string, team: string) => {
    const m = nationTally.get(id) ?? new Map();
    m.set(team, (m.get(team) ?? 0) + 1);
    nationTally.set(id, m);
  };

  for (const dir of INTL_DIRS) {
    for (const { info } of readMatches(dir)) {
      const reg = info.registry?.people ?? {};
      for (const [team, names] of Object.entries(info.players ?? {})) {
        if (NOT_A_NATION(team)) continue;
        for (const name of names) {
          const id = reg[name];
          if (id) tallyNation(id, team);
        }
      }
    }
  }

  for (const { info } of readMatches(IPL_DIR)) {
    const date = info.dates?.[0] ?? "";
    const reg = info.registry?.people ?? {};
    for (const [team, names] of Object.entries(info.players ?? {})) {
      for (const name of names) {
        const id = reg[name];
        if (!id) continue;
        const prev = iplLast.get(id);
        if (!prev || date > prev.date) iplLast.set(id, { team, date });
      }
    }
  }

  const identity: Record<string, { nation: string | null; lastIplTeam: string | null }> = {};
  const ids = new Set([...nationTally.keys(), ...iplLast.keys()]);
  for (const id of ids) {
    const tally = nationTally.get(id);
    let nation: string | null = null;
    if (tally) {
      nation = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
    identity[id] = { nation, lastIplTeam: iplLast.get(id)?.team ?? null };
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "identity.json"), JSON.stringify(identity));
  console.log(
    `✓ identity for ${ids.size} players (nation: ${[...nationTally.keys()].length}, lastIplTeam: ${iplLast.size})`,
  );
}

main();
