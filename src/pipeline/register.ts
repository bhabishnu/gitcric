import { readFileSync } from "node:fs";

export interface Person {
  name: string;
  cricinfoId: string | null;
}

/** Minimal RFC-4180-ish CSV line splitter (handles quoted fields with commas). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Stage 4 — load the Cricsheet people register: stable id → display name +
 * external (Cricinfo) id, for JOIN against the aggregate and later enrichment.
 */
export function loadRegister(csvPath: string): Map<string, Person> {
  const text = readFileSync(csvPath, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const map = new Map<string, Person>();
  if (lines.length === 0) return map;

  const header = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const idCol = header.indexOf("identifier");
  const uniqueCol = header.indexOf("unique_name");
  const nameCol = header.indexOf("name");
  const cricinfoCol = header.indexOf("key_cricinfo");

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const id = idCol >= 0 ? cells[idCol]?.trim() : undefined;
    if (!id) continue;
    const name =
      (uniqueCol >= 0 ? cells[uniqueCol]?.trim() : "") ||
      (nameCol >= 0 ? cells[nameCol]?.trim() : "") ||
      id;
    const cricinfoId = cricinfoCol >= 0 ? cells[cricinfoCol]?.trim() || null : null;
    map.set(id, { name, cricinfoId });
  }
  return map;
}
