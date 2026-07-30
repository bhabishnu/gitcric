/**
 * Refreshes ONLY the `face.language` / `face.languageMark` fields of every card
 * in gen/showcase.json.
 *
 * Sibling to patch-showcase-flags.ts, and deliberately not a re-run of
 * gen:showcase for the same reason: that re-scores each profile and would let
 * the showcase OVRs drift as a side effect of a language change.
 *
 * gen/showcase.json predates the language work, so its faces carry a flag but no
 * language at all — the fan rendered the identity column with the flag alone
 * while /[username] showed flag + mark. This backfills the gap.
 *
 * The language comes off the SAME path the live route uses — fetchSignals()'s
 * `topLanguage`, i.e. the most frequent primary language across the profile's
 * repos — and is resolved through the SAME markForLanguage() mapper, so an
 * unmapped language yields a null mark and the card falls back to the short text
 * label exactly as it does on the result page. Nothing here reimplements either
 * rule. Scoring is never invoked, so every other byte of the file is untouched.
 *
 *   npx tsx scripts/patch-showcase-language.ts
 */
import "./_env.js";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchSignals } from "../lib/github/client.js";
import { markForLanguage } from "../lib/lang.data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "..", "gen", "showcase.json");

async function main() {
  const file = JSON.parse(readFileSync(FILE, "utf8")) as {
    generatedAt: string;
    cards: { login: string; avatar: string | null; face: Record<string, unknown> }[];
  };

  for (const card of file.cards) {
    // Signals only — buildUserCard/pickTwins are never called, so no OVR, tier,
    // role, twin or stat on the stored face can move.
    const signals = await fetchSignals(card.login);
    const lang = signals.topLanguage;
    const mark = markForLanguage(lang);
    card.face.language = lang;
    card.face.languageMark = mark;
    console.log(
      `  ${card.login.padEnd(16)} topLanguage=${JSON.stringify(lang).padEnd(14)} -> ${
        mark ? `mark: ${mark.name}` : "no mark (text fallback)"
      }`,
    );
  }

  // Indent 1 and no trailing newline — matches how the file is already written,
  // so the diff shows the added language fields and nothing else.
  writeFileSync(FILE, JSON.stringify(file, null, 1));
  console.log(`\npatched ${file.cards.length} showcase cards (language fields only)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
