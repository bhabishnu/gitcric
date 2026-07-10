import { existsSync, readFileSync } from "node:fs";
import type { FormatBucket } from "../../types/stats.js";
import { HISTORICAL_META, HISTORICAL_SOURCES, type ColumnMap } from "../../config/historical.js";

/** One player's FULL-CAREER totals in one format, normalized to canonical fields.
 * Optional fields are null when the historical record doesn't track them. */
export interface HistoricalCareer {
  name: string;
  cricinfoId: string | null;
  bucket: FormatBucket;
  spanStart: number;
  spanEnd: number;
  matches: number;
  innings: number | null;
  notOuts: number | null;
  runs: number | null;
  ballsFaced: number | null;
  hundreds: number | null;
  fifties: number | null;
  ballsBowled: number | null;
  runsConceded: number | null;
  wickets: number | null;
  fourFers: number | null;
  fiveFers: number | null;
  catches: number | null;
  stumpings: number | null;
}

const CANONICAL = [
  "name", "cricinfoId", "bucket", "spanStart", "spanEnd", "matches", "innings", "notOuts",
  "runs", "ballsFaced", "hundreds", "fifties", "ballsBowled", "runsConceded", "wickets",
  "fourFers", "fiveFers", "catches", "stumpings",
] as const;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const num = (s: string | undefined): number | null => {
  if (s == null) return null;
  const t = s.trim();
  if (t === "") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
};

function parseCsv(path: string, columnMap?: ColumnMap): HistoricalCareer[] {
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trimStart().startsWith("#"));
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim());
  // field -> column index (via columnMap, else identity by canonical header name)
  const idx: Partial<Record<(typeof CANONICAL)[number], number>> = {};
  for (const field of CANONICAL) {
    const header = columnMap?.[field] ?? field;
    const i = headers.indexOf(header);
    if (i >= 0) idx[field] = i;
  }
  const cell = (cells: string[], f: (typeof CANONICAL)[number]) => (idx[f] != null ? cells[idx[f]!] : undefined);

  // Rate columns some sources give INSTEAD of raw counts — mapped separately and
  // used to derive the canonical counts the pipeline needs.
  const RATE = ["battingAvg", "strikeRate", "bowlingAvg", "economy"] as const;
  const rateIdx: Partial<Record<(typeof RATE)[number], number>> = {};
  for (const rf of RATE) {
    const header = columnMap?.[rf];
    if (header) { const i = headers.indexOf(header); if (i >= 0) rateIdx[rf] = i; }
  }
  const rate = (cells: string[], f: (typeof RATE)[number]) => (rateIdx[f] != null ? num(cells[rateIdx[f]!]) : null);

  const out: HistoricalCareer[] = [];
  for (let li = 1; li < lines.length; li++) {
    const c = splitCsvLine(lines[li]!);
    const name = (cell(c, "name") ?? "").trim();
    const bucketRaw = (cell(c, "bucket") ?? "").trim().toLowerCase(); // "Test"/"ODI" → test/odi
    const bucket = bucketRaw as FormatBucket;
    if (!name || !["test", "odi", "t20i"].includes(bucket)) continue;
    const row: HistoricalCareer = {
      name,
      cricinfoId: (cell(c, "cricinfoId") ?? "").trim() || null,
      bucket,
      spanStart: num(cell(c, "spanStart")) ?? 0,
      spanEnd: num(cell(c, "spanEnd")) ?? 0,
      matches: num(cell(c, "matches")) ?? 0,
      innings: num(cell(c, "innings")),
      notOuts: num(cell(c, "notOuts")),
      runs: num(cell(c, "runs")),
      ballsFaced: num(cell(c, "ballsFaced")),
      hundreds: num(cell(c, "hundreds")),
      fifties: num(cell(c, "fifties")),
      ballsBowled: num(cell(c, "ballsBowled")),
      runsConceded: num(cell(c, "runsConceded")),
      wickets: num(cell(c, "wickets")),
      fourFers: num(cell(c, "fourFers")),
      fiveFers: num(cell(c, "fiveFers")),
      catches: num(cell(c, "catches")),
      stumpings: num(cell(c, "stumpings")),
    };

    // Derive raw counts from rates when a source gives averages/rates instead.
    if (row.innings == null && row.runs != null) {
      const ba = rate(c, "battingAvg");
      // innings ≈ dismissals (not-outs unknown → 0), so runs/dismissals = avg.
      if (ba && ba > 0) { row.innings = Math.round(row.runs / ba); row.notOuts = 0; }
    }
    if (row.ballsFaced == null && row.runs != null) {
      const sr = rate(c, "strikeRate"); // blank SR (e.g. old Tests) → not tracked
      if (sr && sr > 0) row.ballsFaced = Math.round((row.runs / sr) * 100);
    }
    if (row.runsConceded == null && row.wickets != null && row.wickets > 0) {
      const bavg = rate(c, "bowlingAvg");
      if (bavg && bavg > 0) row.runsConceded = Math.round(row.wickets * bavg);
    }
    if (row.ballsBowled == null && row.runsConceded != null && row.runsConceded > 0) {
      const eco = rate(c, "economy");
      if (eco && eco > 0) row.ballsBowled = Math.round((row.runsConceded / eco) * 6);
    }
    out.push(row);
  }
  return out;
}

/** Fill spanStart/spanEnd and (rare) stumpings from hand-authored metadata when a
 * source's CSV doesn't carry them — keyed by lowercased player name. Only fills
 * what's missing; never overrides a value the CSV already provides. */
function applyMeta(row: HistoricalCareer): void {
  const meta = HISTORICAL_META[row.name.toLowerCase()];
  if (!meta) return;
  if (meta.cricinfoId && row.cricinfoId == null) row.cricinfoId = meta.cricinfoId;
  const span = meta.spans?.[row.bucket];
  if (span && row.spanStart === 0) { row.spanStart = span[0]; row.spanEnd = span[1]; }
  const st = meta.stumpings?.[row.bucket];
  if (st != null && row.stumpings == null) row.stumpings = st;
}

/** Load every configured historical source. Earlier sources take PRECEDENCE at
 * the PLAYER level: once a player appears in an earlier source (the curated seed),
 * ALL their rows in later sources are skipped — so a seed player is never partly
 * overwritten nor split across sources. Reports the skipped players. */
export function loadHistorical(): HistoricalCareer[] {
  const out: HistoricalCareer[] = [];
  const seenPlayers = new Set<string>(); // player keys from EARLIER sources
  const skipped: { name: string; bucket: string }[] = [];
  const pkey = (r: HistoricalCareer) => (r.cricinfoId ?? r.name).toLowerCase();

  for (const src of HISTORICAL_SOURCES) {
    if (!existsSync(src.path)) continue;
    const thisSource = new Set<string>();
    for (const row of parseCsv(src.path, src.columnMap)) {
      applyMeta(row);
      const k = pkey(row);
      if (seenPlayers.has(k)) { skipped.push({ name: row.name, bucket: row.bucket }); continue; }
      out.push(row);
      thisSource.add(k);
    }
    for (const k of thisSource) seenPlayers.add(k);
  }
  if (skipped.length) {
    const names = [...new Set(skipped.map((s) => s.name))];
    console.log(`  [historical] seed precedence — skipped ${skipped.length} rows from ${names.length} players already in the seed: ${names.join(", ")}`);
  }
  return out;
}
