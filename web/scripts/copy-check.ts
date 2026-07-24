/**
 * THE BOWLING GUARDRAIL, enforced.
 *
 * We have no pace-vs-spin data — only how WELL a player bowls, never HOW. So no
 * card copy may assert a delivery type. We shipped exactly that bug once
 * (Sandeep Lamichhane, a leg-spinner, described as hitting "the deck at pace"),
 * so this is a check and not a comment.
 *
 * The ban is global rather than bowler-only: batting copy has no need to assert
 * what it faced either, and a global rule can't be defeated by a rule moving
 * between role tables.
 *
 * Run: npm run copy-check
 */
import { ALL_RULES } from "../lib/scoring/archetypes";
import type { Role } from "../lib/scoring/types";

/** Words that claim a delivery type (or the bowler's kind). Word-bounded so
 *  innocent idiom survives: "turns his arm over" and "turns up when it matters"
 *  are fine; "turns the ball" is not. */
const BANNED: { re: RegExp; why: string }[] = [
  { re: /\bpace(r|rs|d)?\b/i, why: "asserts pace" },
  { re: /\bquick(s|ie|ies)?\b/i, why: "asserts pace" },
  { re: /\bexpress\b/i, why: "asserts pace" },
  { re: /\btearaway\b|\bthunderbolt\b/i, why: "asserts pace" },
  { re: /\bseam(er|ers|ing)?\b/i, why: "asserts seam" },
  { re: /\bswing(s|ing|er|ers)?\b/i, why: "asserts swing" },
  { re: /\bspin(s|ner|ners|ning)?\b/i, why: "asserts spin" },
  { re: /\bturn(s|ed|ing)?\s+(the\s+)?(ball|it)\b/i, why: "asserts spin" },
  { re: /\bdeck\b/i, why: "'hits the deck' asserts pace" },
  { re: /\bbouncer(s)?\b|\bshort\s+ball\b/i, why: "asserts pace" },
  { re: /\byorker(s)?\b/i, why: "asserts a pace delivery" },
  { re: /\bgoogly|googlies|doosra|carrom\s+ball|leg[-\s]?break|off[-\s]?break\b/i, why: "asserts spin" },
  { re: /\bflight(ed|ing)?\b|\bdrift(s|ing)?\b|\bwrist\b|\bripping\b/i, why: "asserts spin" },
  { re: /\bnew\s+ball\b/i, why: "implies a delivery type by proxy" },
];

const roles = Object.keys(ALL_RULES) as Role[];
let failures = 0;
let strings = 0;

for (const role of roles) {
  for (const rule of ALL_RULES[role]) {
    const copy: [string, string][] = [
      [`${role}/${rule.key}.name`, rule.name],
      [`${role}/${rule.key}.blurb`, rule.blurb],
      ...rule.traits.flatMap(
        (t, i): [string, string][] => [
          [`${role}/${rule.key}.traits[${i}].label`, t.label],
          [`${role}/${rule.key}.traits[${i}].note`, t.note],
        ],
      ),
    ];
    for (const [where, text] of copy) {
      strings++;
      for (const { re, why } of BANNED) {
        const hit = re.exec(text);
        if (hit) {
          console.error(`✗ ${where}: "${hit[0]}" — ${why}\n    ${text}`);
          failures++;
        }
      }
    }
  }
}

// Every role's table must end in a catch-all, or archetypeFor could fall through.
for (const role of roles) {
  const table = ALL_RULES[role];
  const last = table[table.length - 1];
  const alwaysTrue = last.when({ BAT: 0, POW: 0, BWL: 0, ECO: 0, FLD: 0, IMP: 0 }, 0)
    && last.when({ BAT: 99, POW: 99, BWL: 99, ECO: 99, FLD: 99, IMP: 99 }, 99);
  if (!alwaysTrue) {
    console.error(`✗ ${role}: last rule "${last.key}" is not a catch-all`);
    failures++;
  }
}

const total = roles.reduce((n, r) => n + ALL_RULES[r].length, 0);
if (failures) {
  console.error(`\ncopy-check FAILED — ${failures} violation(s) across ${strings} strings`);
  process.exit(1);
}
console.log(`copy-check ok — ${total} archetypes, ${strings} strings, no delivery-type claims`);
