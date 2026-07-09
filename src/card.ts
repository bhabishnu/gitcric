import { openDb } from "./db/db.js";
import { GitCricStore } from "./db/accessor.js";
import { ALL_BUCKETS } from "./config/competitions.js";
import type { FormatBucket, PlayerCardData } from "./types/stats.js";

/**
 * Quick lookup CLI:  npm run card "<player name>"
 * Fuzzy-matches the name against the players table and prints that player's
 * cards across every format, in the same table shape as verify-output.txt.
 */

// Finish tier is DERIVED from OVR here (the pipeline doesn't store one) — a
// simple FUT-style banding for at-a-glance reading.
function finishTier(ovr: number): string {
  if (ovr >= 90) return "ICON";
  if (ovr >= 85) return "GOLD";
  if (ovr >= 80) return "SILVER";
  if (ovr >= 75) return "BRONZE";
  return "COMMON";
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

interface Candidate {
  id: string;
  name: string;
  totalMatches: number;
  intlMatches: number;
  score: number;
}

/** Score a player name against the query. Handles the register's initials form. */
function scoreName(query: string, name: string): number {
  const q = norm(query);
  const n = norm(name);
  if (!q) return 0;
  const qTokens = q.split(" ");
  const nTokens = n.split(" ");
  let score = 0;
  if (n === q) score += 100;
  if (n.includes(q)) score += 40; // whole query is a substring
  for (const qt of qTokens) {
    if (nTokens.includes(qt)) score += 12; // exact word (e.g. surname "kohli")
    else if (nTokens.some((nt) => nt.length >= 3 && (nt.includes(qt) || qt.includes(nt)))) score += 6;
  }
  // surname emphasis: last query token matching last name word
  if (qTokens.length && nTokens.length && qTokens[qTokens.length - 1] === nTokens[nTokens.length - 1]) score += 8;
  return score;
}

function fuzzyFind(db: ReturnType<typeof openDb>, query: string): { best: Candidate | null; others: Candidate[] } {
  // Pull total matches AND international matches (test/odi/t20i) per player, so
  // homonyms are disambiguated by the most CREDIBLE record — a capped
  // international outranks a franchise-only namesake with more raw appearances.
  const rows = db
    .prepare(
      `SELECT p.id, p.name,
              COALESCE(SUM(s.matches), 0) AS tot,
              COALESCE(SUM(CASE WHEN s.format_bucket IN ('test','odi','t20i') THEN s.matches ELSE 0 END), 0) AS intl
       FROM players p LEFT JOIN player_format_stats s ON s.player_id = p.id
       GROUP BY p.id, p.name`,
    )
    .all() as { id: string; name: string; tot: number; intl: number }[];

  const scored: Candidate[] = [];
  for (const r of rows) {
    const s = scoreName(query, r.name);
    if (s > 0) scored.push({ id: r.id, name: r.name, totalMatches: r.tot, intlMatches: r.intl, score: s });
  }
  // rank by name score, then international caps, then total appearances
  scored.sort(
    (a, b) => b.score - a.score || b.intlMatches - a.intlMatches || b.totalMatches - a.totalMatches,
  );
  const best = scored[0] ?? null;
  const others = scored.filter((c) => c !== best).slice(0, 4);
  return { best, others };
}

const p = (s: string | number, n: number) => String(s).padEnd(n);
const q = (s: string | number, n: number) => String(s).padStart(n);

function printCards(store: GitCricStore, cand: Candidate): void {
  console.log(`\n▶ ${cand.name}  (id=${cand.id}, ${cand.totalMatches} career matches)`);
  console.log(
    p("format", 7) + q("M", 4) + "  " + p("BAT POW BWL ECO FLD IMP", 24) + q("OVR", 4) + "  " + p("role", 11) + p("finish", 8) + "equated legend",
  );
  console.log("-".repeat(84));
  let any = false;
  for (const b of ALL_BUCKETS as FormatBucket[]) {
    const c: PlayerCardData | null = store.getCard(cand.id, b);
    if (!c) {
      console.log(p(b, 7) + q("-", 4) + "  " + p("(no card - below gate)", 24) + q("-", 4));
      continue;
    }
    any = true;
    const s = c.stats;
    const stats = [s.BAT, s.POW, s.BWL, s.ECO, s.FLD, s.IMP].map((x) => q(x, 3)).join(" ");
    console.log(
      p(b, 7) + q(c.career.matches, 4) + "  " + p(stats, 24) + q(c.ovr, 4) + "  " + p(c.role, 11) + p(finishTier(c.ovr), 8) + (c.equatedLegend?.name ?? "-"),
    );
  }
  if (!any) console.log("  (qualifies for no format yet)");
}

// ── main ──
// Each quoted argument is a SEPARATE player lookup, e.g.
//   npm run card "Brian Lara" "Steve Smith"
// (names with spaces must be quoted so the shell keeps them as one argument).
const queries = process.argv.slice(2).map((a) => a.trim()).filter(Boolean);
if (queries.length === 0) {
  console.error('usage: npm run card "<player name>" ["<player name>" ...]');
  process.exit(2);
}

const db = openDb();
const store = new GitCricStore();

for (const query of queries) {
  const { best, others } = fuzzyFind(db, query);
  if (!best) {
    console.log(`\nNo player found matching "${query}".`);
    continue;
  }
  printCards(store, best);
  if (others.length) console.log(`\n  other matches: ${others.map((o) => o.name).join(", ")}`);
}

store.close();
db.close();
