/**
 * Pre-generates the landing page's showcase cards.
 *
 *   npm run gen:showcase        (GITHUB_TOKEN comes from web/.env.local)
 *
 * MANUAL STEP — deliberately NOT wired into `next build`. The committed
 * web/gen/showcase.json is the source of truth, so the landing page makes zero
 * GitHub calls at build time or request time. Re-run by hand when the showcase
 * roster changes (or when a card's numbers have drifted enough to care).
 *
 * The card faces come off the EXACT path /[username] uses — fetchSignals →
 * buildUserCard → pickTwins → buildSegments — and we persist segment 0 (YOU),
 * which is what that route paints first. Nothing here reimplements scoring.
 *
 * Avatars are downloaded to web/public/showcase/ alongside the existing
 * public/players/ headshots, so the hero paints with no external requests at
 * all. Geometry (rotation, offsets, scale) is NOT stored here — it lives in the
 * .gc-fan CSS block, so the fan can be tuned without re-running this script.
 */
import "./_env.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchSignals } from "../lib/github/client.js";
import { buildUserCard } from "../lib/scoring/engine.js";
import { pickTwins } from "../lib/match/matcher.js";
import { PLAYER_INDEX } from "../lib/data.js";
import { buildSegments } from "../lib/view.js";
// Type-only (erased at runtime), so this script never imports the JSON file it
// is responsible for writing — it still runs when gen/showcase.json is absent.
import type { ShowcaseCard, ShowcaseFile } from "../lib/showcase.js";

/** The showcase roster. Verified handles — canonical GitHub logins. */
const ROSTER = ["torvalds", "sindresorhus", "knadh", "karpathy"];

const here = dirname(fileURLToPath(import.meta.url));
const WEB = join(here, "..");
const OUT_JSON = join(WEB, "gen", "showcase.json");
const AVATAR_DIR = join(WEB, "public", "showcase");

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Pull the avatar down to public/showcase/. Returns the public path, or null
 *  (a missing avatar is not fatal — the card falls back to its monogram). */
async function saveAvatar(login: string, url: string): Promise<string | null> {
  if (!url) return null;
  try {
    // s=512 covers the card's portrait zone at 2x on the widest fan slot.
    const sized = `${url}${url.includes("?") ? "&" : "?"}s=512`;
    const res = await fetch(sized, { headers: { "User-Agent": "gitcric" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ext = EXT[(res.headers.get("content-type") ?? "").split(";")[0].trim()] ?? "jpg";
    const file = `${login.toLowerCase()}.${ext}`;
    mkdirSync(AVATAR_DIR, { recursive: true });
    writeFileSync(join(AVATAR_DIR, file), Buffer.from(await res.arrayBuffer()));
    return `/showcase/${file}`;
  } catch (e) {
    console.warn(`   ! avatar failed for ${login}: ${(e as Error).message}`);
    return null;
  }
}

async function buildOne(login: string): Promise<ShowcaseCard> {
  const signals = await fetchSignals(login);
  const you = buildUserCard(signals);
  // Seeded on the canonical login, same as the route — keeps the showcase card
  // identical to what a visitor lands on when they click it.
  const twins = pickTwins(you.ovr, you.login, PLAYER_INDEX);
  const segments = buildSegments(you, twins);
  const avatar = await saveAvatar(you.login, you.avatarUrl);
  console.log(
    `   ${you.login.padEnd(16)} OVR ${String(you.ovr).padStart(2)} · ${you.tier.padEnd(8)} · ${you.role}`,
  );
  return { login: you.login, avatar, face: segments[0].card };
}

async function main() {
  console.log(`Scouting ${ROSTER.length} showcase profiles…`);
  const cards: ShowcaseCard[] = [];
  // Sequential: four profiles is nothing, and it keeps us well clear of
  // GitHub's secondary rate limits (each login already fans out year batches).
  for (const login of ROSTER) cards.push(await buildOne(login));

  const out: ShowcaseFile = { generatedAt: new Date().toISOString(), cards };
  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`\nWrote ${OUT_JSON} (${cards.length} cards)`);
  console.log(`Avatars → ${AVATAR_DIR}`);
  console.log("Commit web/gen/showcase.json + web/public/showcase/*.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
