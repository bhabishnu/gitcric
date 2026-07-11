/**
 * BUILD-TIME data export. Reads the finished gitcric.db through the sanctioned
 * typed accessor (GitCricStore) and emits two committed JSON artifacts the web
 * app imports at runtime — so nothing native (better-sqlite3) ever ships to the
 * serverless/edge runtime, and Vercel can build without the DB present.
 *
 *   web/gen/players.index.json  — matcher pool: one light row per gated card,
 *                                 with the notability signals the recognizability
 *                                 filter needs (threshold applied at runtime, so
 *                                 it stays tunable without re-exporting).
 *   web/gen/cards.json          — full PlayerCardData per "bucket:id", for the
 *                                 twin's card + side panels.
 *
 * Output lands in web/gen/ (not web/data/) because the repo's .gitignore ignores
 * every `data/` directory; gen/ is committed so CI has the data.
 */
import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GitCricStore } from "../../src/db/accessor.js";
import { ALL_BUCKETS } from "../../src/config/competitions.js";
import type { FormatBucket, PlayerCardData } from "../../src/types/stats.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DB_PATH = join(ROOT, "data", "gitcric.db");
const OUT_DIR = join(__dirname, "..", "gen");

const INTL_BUCKETS = new Set<FormatBucket>(["test", "odi", "t20i"]);

export interface IndexRow {
  id: string;
  name: string;
  ovr: number;
  role: string;
  stats: PlayerCardData["stats"];
  /** Matches in THIS bucket. */
  matches: number;
  /** Career matches summed across every bucket. */
  totalMatches: number;
  /** International (test+odi+t20i) caps — the strongest recognizability signal. */
  intlCaps: number;
  /** How many format buckets this player is GATED in. ≥2 (a multi-format
   *  international) is the clean recognizability separator — associate-nation
   *  minnows are almost all gated in t20i only (=1). */
  gformats: number;
  /** Is this player a legend anchor in this bucket (always recognizable). */
  isAnchor: boolean;
  /** Nation (from raw Cricsheet intl teams) and most-recent IPL franchise —
   *  drive flags and team colorways. Null when not derivable. */
  nation: string | null;
  lastIplTeam: string | null;
}

function main() {
  // Open the accessor first (it applies WAL mode), then a read-only handle for
  // the raw notability aggregates — WAL supports the concurrent reader, and
  // opening the writer first avoids a mode-switch lock race. data/ is gitignored,
  // so the build never touches tracked files.
  const store = new GitCricStore(DB_PATH);
  const raw = new Database(DB_PATH, { readonly: true, fileMustExist: true });

  const notability = new Map<string, { total: number; intl: number; gformats: number }>();
  for (const r of raw
    .prepare("SELECT player_id, format_bucket, matches, gated FROM player_format_stats")
    .all() as { player_id: string; format_bucket: FormatBucket; matches: number; gated: number }[]) {
    const n = notability.get(r.player_id) ?? { total: 0, intl: 0, gformats: 0 };
    n.total += r.matches;
    if (INTL_BUCKETS.has(r.format_bucket)) n.intl += r.matches;
    if (r.gated) n.gformats += 1;
    notability.set(r.player_id, n);
  }

  const anchorIds = new Map<FormatBucket, Set<string>>();
  for (const r of raw
    .prepare("SELECT id, format_bucket FROM legend_anchors WHERE source = 'computed'")
    .all() as { id: string; format_bucket: FormatBucket }[]) {
    (anchorIds.get(r.format_bucket) ?? anchorIds.set(r.format_bucket, new Set()).get(r.format_bucket)!).add(r.id);
  }

  // nation + lastIplTeam derived from raw Cricsheet by scripts/derive-teams.ts
  const identityPath = join(OUT_DIR, "identity.json");
  const identity: Record<string, { nation: string | null; lastIplTeam: string | null }> = existsSync(identityPath)
    ? JSON.parse(readFileSync(identityPath, "utf8"))
    : {};

  const gated = raw
    .prepare("SELECT player_id, format_bucket FROM player_format_stats WHERE gated = 1")
    .all() as { player_id: string; format_bucket: FormatBucket }[];

  const index: Record<FormatBucket, IndexRow[]> = { test: [], odi: [], t20i: [], ipl: [] };
  const cards: Record<string, PlayerCardData> = {};

  for (const { player_id, format_bucket } of gated) {
    const card = store.getCard(player_id, format_bucket);
    if (!card) continue;
    const key = `${format_bucket}:${player_id}`;
    cards[key] = card;
    const n = notability.get(player_id) ?? { total: card.career.matches, intl: 0, gformats: 1 };
    index[format_bucket].push({
      id: player_id,
      name: card.name,
      ovr: card.ovr,
      role: card.role,
      stats: card.stats,
      matches: card.career.matches,
      totalMatches: n.total,
      intlCaps: n.intl,
      gformats: n.gformats,
      isAnchor: anchorIds.get(format_bucket)?.has(player_id) ?? false,
      nation: identity[player_id]?.nation ?? null,
      lastIplTeam: identity[player_id]?.lastIplTeam ?? null,
    });
  }

  for (const b of ALL_BUCKETS) index[b].sort((a, c) => a.ovr - c.ovr);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "players.index.json"), JSON.stringify(index));
  writeFileSync(join(OUT_DIR, "cards.json"), JSON.stringify(cards));

  const counts = ALL_BUCKETS.map((b) => `${b}=${index[b].length}`).join("  ");
  console.log(`✓ exported  ${counts}  |  ${Object.keys(cards).length} full cards`);
  store.close();
  raw.close();
}

main();
