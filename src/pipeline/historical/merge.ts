import type { FormatBucket } from "../../types/stats.js";
import type { AggMap, RawAgg } from "../aggregate.js";
import type { Person } from "../register.js";
import { DEBUT_GATE_YEAR, ERA_BAT_SR, ERA_BOWL_ECON, HISTORICAL_ENABLED } from "../../config/historical.js";
import { loadHistorical, type HistoricalCareer } from "./source.js";

export interface MergeRow {
  name: string;
  bucket: FormatBucket;
  action: "spanning-merge" | "new-pre2000" | "skip-modern" | "skip-mismatch" | "unmatched";
  matchesBefore: number;
  matchesAfter: number;
  note?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const key = (id: string, b: FormatBucket) => `${id}|${b}`;
const estBalls = (runs: number, sr: number) => Math.round(runs / (sr / 100));
const slug = (s: string) => norm(s).replace(/ /g, "-");

/** Score a historical full-name against a Cricsheet initials-form name. */
function scoreName(hist: string, cric: string): number {
  const h = norm(hist), c = norm(cric);
  const ht = h.split(" "), ct = c.split(" ");
  if (ht[ht.length - 1] !== ct[ct.length - 1]) return 0; // surnames MUST match
  let s = 10;
  // first name initial (hist "sachin") vs cricsheet initials block ("sr")
  const hf = ht[0] ?? "", cf = ct[0] ?? "";
  if (hf[0] && cf[0] && hf[0] === cf[0]) s += 5;
  return s;
}

function blankAgg(playerId: string, bucket: FormatBucket): RawAgg {
  return {
    playerId, bucket, gender: "male",
    matches: 0, batInnings: 0, runs: 0, ballsFaced: 0, dismissals: 0, notOuts: 0,
    fours: 0, sixes: 0, fifties: 0, hundreds: 0,
    ballsBowled: 0, runsConceded: 0, wickets: 0, fourFers: 0, fiveFers: 0,
    catches: 0, stumpings: 0, runOuts: 0, firstDate: "", lastDate: "",
  };
}

/**
 * Fold the PRE-Cricsheet portion of each historical career into the aggregate.
 * No double-count: for a player Cricsheet already partly covers, the merged total
 * is `cricsheet + max(0, careerTotal − cricsheet)` = the career total, with each
 * match counted once; a stale/smaller historical row (or a modern player) adds
 * nothing. Mutates `map` and `register` in place. Returns a per-row report.
 */
export function mergeHistorical(map: AggMap, register: Map<string, Person>): MergeRow[] {
  if (!HISTORICAL_ENABLED) return [];
  const careers = loadHistorical();

  // indexes over the Cricsheet register for identity matching
  const byCricinfo = new Map<string, string>();
  const bySurname = new Map<string, { id: string; name: string }[]>();
  for (const [id, p] of register) {
    if (p.cricinfoId) byCricinfo.set(p.cricinfoId, id);
    const sur = norm(p.name).split(" ").pop() ?? "";
    if (!bySurname.has(sur)) bySurname.set(sur, []);
    bySurname.get(sur)!.push({ id, name: p.name });
  }

  const matchesIn = (id: string, b: FormatBucket) => map.get(key(id, b))?.matches ?? 0;

  /** Resolve a historical row to an existing Cricsheet player id, or null. */
  function resolve(row: HistoricalCareer): string | null {
    if (row.cricinfoId && byCricinfo.has(row.cricinfoId)) return byCricinfo.get(row.cricinfoId)!;
    const sur = norm(row.name).split(" ").pop() ?? "";
    // require surname AND first-initial to match (score >= 15) so a legend is
    // never merged onto a coincidental same-surname namesake; weaker matches fall
    // through to being treated as a new pre-2000 player instead.
    const cands = (bySurname.get(sur) ?? [])
      .map((c) => ({ ...c, sc: scoreName(row.name, c.name) }))
      .filter((c) => c.sc >= 15);
    if (cands.length === 0) return null;
    // prefer the candidate who actually has appearances in this bucket (the real
    // player), then the strongest name score
    cands.sort((a, b) => matchesIn(b.id, row.bucket) - matchesIn(a.id, row.bucket) || b.sc - a.sc);
    return cands[0]!.id;
  }

  const report: MergeRow[] = [];
  for (const row of careers) {
    const id = resolve(row);
    let existing = id ? map.get(key(id, row.bucket)) : undefined;

    // Namesake guard: if the historical career ENDED before this Cricsheet record
    // BEGAN, they cannot be the same person (e.g. Imran Khan 1971-1992 vs a modern
    // "Imran Khan (2)"). Drop the match and let it become its own pre-2000 player.
    if (existing && existing.firstDate) {
      const cricStart = Number.parseInt(existing.firstDate.slice(0, 4), 10);
      if (row.spanEnd > 0 && Number.isFinite(cricStart) && row.spanEnd < cricStart) existing = undefined;
    }

    // ── spanning player Cricsheet already partly covers ──
    if (existing) {
      const before = existing.matches;
      if (row.spanStart >= DEBUT_GATE_YEAR) {
        report.push({ name: row.name, bucket: row.bucket, action: "skip-modern", matchesBefore: before, matchesAfter: before });
        continue;
      }
      if (row.matches < existing.matches) {
        report.push({ name: row.name, bucket: row.bucket, action: "skip-mismatch", matchesBefore: before, matchesAfter: before, note: `career ${row.matches} < cricsheet ${existing.matches}` });
        continue;
      }
      applyDeltas(existing, row);
      report.push({ name: row.name, bucket: row.bucket, action: "spanning-merge", matchesBefore: before, matchesAfter: existing.matches });
      continue;
    }

    // ── fully pre-2000 (or a format Cricsheet never covered) → new aggregate ──
    if (row.spanStart >= DEBUT_GATE_YEAR) {
      report.push({ name: row.name, bucket: row.bucket, action: "skip-modern", matchesBefore: 0, matchesAfter: 0 });
      continue;
    }
    // Only reuse a Cricsheet id here when the Cricinfo id matched exactly. A
    // mere surname+initial name match to a player with NO appearances in this
    // format is NOT trustworthy (it could be a namesake), so give the pre-2000
    // player its own synthetic id rather than polluting someone else's card.
    const cricinfoHit = row.cricinfoId != null && byCricinfo.has(row.cricinfoId);
    const newId = cricinfoHit ? byCricinfo.get(row.cricinfoId!)! : `hist:${row.cricinfoId ?? slug(row.name)}`;
    const agg = blankAgg(newId, row.bucket);
    applyFull(agg, row);
    map.set(key(newId, row.bucket), agg);
    if (!register.has(newId)) register.set(newId, { name: row.name, cricinfoId: row.cricinfoId });
    report.push({ name: row.name, bucket: row.bucket, action: "new-pre2000", matchesBefore: 0, matchesAfter: agg.matches });
  }
  return report;
}

/** Add the PRE-Cricsheet remainder of a career onto an existing aggregate. */
function applyDeltas(agg: RawAgg, row: HistoricalCareer): void {
  const add = (cur: number, target: number | null) => (target == null ? 0 : Math.max(0, target - cur));

  // Estimate the pre-2000 balls from the player's OWN post-2000 strike rate (so
  // the merge preserves their real tempo), falling back to an era rate only when
  // Cricsheet gives no balls to learn from. Capture this BEFORE mutating.
  const ownSR = agg.ballsFaced > 0 ? (agg.runs / agg.ballsFaced) * 100 : ERA_BAT_SR[agg.bucket];
  const dRuns = add(agg.runs, row.runs);
  agg.runs += dRuns;
  // keep runs & balls coherent so strike rate stays sane
  if (row.ballsFaced != null) agg.ballsFaced += add(agg.ballsFaced, row.ballsFaced);
  else if (dRuns > 0) agg.ballsFaced += estBalls(dRuns, ownSR);

  agg.matches += add(agg.matches, row.matches);
  if (row.innings != null) agg.batInnings += add(agg.batInnings, row.innings);
  if (row.notOuts != null) agg.notOuts += add(agg.notOuts, row.notOuts);
  if (row.innings != null && row.notOuts != null) agg.dismissals += add(agg.dismissals, row.innings - row.notOuts);
  if (row.hundreds != null) agg.hundreds += add(agg.hundreds, row.hundreds);
  if (row.fifties != null) agg.fifties += add(agg.fifties, row.fifties);

  const ownEcon = agg.ballsBowled > 0 ? agg.runsConceded / (agg.ballsBowled / 6) : ERA_BOWL_ECON[agg.bucket];
  const dConc = add(agg.runsConceded, row.runsConceded);
  agg.runsConceded += dConc;
  agg.wickets += add(agg.wickets, row.wickets);
  if (row.ballsBowled != null) agg.ballsBowled += add(agg.ballsBowled, row.ballsBowled);
  else if (dConc > 0) agg.ballsBowled += Math.round((dConc / ownEcon) * 6);
  if (row.fourFers != null) agg.fourFers += add(agg.fourFers, row.fourFers);
  if (row.fiveFers != null) agg.fiveFers += add(agg.fiveFers, row.fiveFers);
  if (row.catches != null) agg.catches += add(agg.catches, row.catches);
  if (row.stumpings != null) agg.stumpings += add(agg.stumpings, row.stumpings);

  // extend career start → this is what re-opens the greatness/longevity band
  const start = `${row.spanStart}-01-01`;
  if (row.spanStart > 0 && (!agg.firstDate || start < agg.firstDate)) agg.firstDate = start;
}

/** Build a full aggregate for a player Cricsheet has no ball-by-ball for. */
function applyFull(agg: RawAgg, row: HistoricalCareer): void {
  agg.matches = row.matches;
  agg.batInnings = row.innings ?? 0;
  agg.notOuts = row.notOuts ?? 0;
  agg.runs = row.runs ?? 0;
  agg.dismissals = row.innings != null && row.notOuts != null ? Math.max(0, row.innings - row.notOuts) : (row.innings ?? 0);
  agg.ballsFaced = row.ballsFaced ?? (row.runs ? estBalls(row.runs, ERA_BAT_SR[agg.bucket]) : 0);
  agg.hundreds = row.hundreds ?? 0;
  agg.fifties = row.fifties ?? 0;
  agg.wickets = row.wickets ?? 0;
  agg.runsConceded = row.runsConceded ?? 0;
  agg.ballsBowled = row.ballsBowled ?? (row.runsConceded ? Math.round(row.runsConceded / (ERA_BOWL_ECON[agg.bucket] / 6)) : 0);
  agg.fourFers = row.fourFers ?? 0;
  agg.fiveFers = row.fiveFers ?? 0;
  agg.catches = row.catches ?? 0;
  agg.stumpings = row.stumpings ?? 0;
  agg.firstDate = `${row.spanStart}-01-01`;
  agg.lastDate = `${row.spanEnd}-12-31`;
}
