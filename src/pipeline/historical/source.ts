import { existsSync, readFileSync } from "node:fs";
import type { FormatBucket } from "../../types/stats.js";
import { HISTORICAL_SOURCES, type ColumnMap } from "../../config/historical.js";

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

  const out: HistoricalCareer[] = [];
  for (let li = 1; li < lines.length; li++) {
    const c = splitCsvLine(lines[li]!);
    const name = (cell(c, "name") ?? "").trim();
    const bucketRaw = (cell(c, "bucket") ?? "").trim().toLowerCase();
    const bucket = bucketRaw as FormatBucket;
    if (!name || !["test", "odi", "t20i"].includes(bucket)) continue;
    out.push({
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
    });
  }
  return out;
}

/** Load every configured historical source; later sources override earlier ones
 * for the same (name|cricinfo, bucket). */
export function loadHistorical(): HistoricalCareer[] {
  const byKey = new Map<string, HistoricalCareer>();
  for (const src of HISTORICAL_SOURCES) {
    if (!existsSync(src.path)) continue;
    for (const row of parseCsv(src.path, src.columnMap)) {
      const key = `${(row.cricinfoId ?? row.name).toLowerCase()}|${row.bucket}`;
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}
