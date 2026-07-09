import AdmZip from "adm-zip";
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import { COMPETITIONS, CRICSHEET_BASE, PEOPLE_REGISTER_URL } from "../config/competitions.js";
import { RAW_DIR } from "../db/db.js";

/** Directory where a competition's extracted JSON match files live. */
export function extractedDir(competitionKey: string): string {
  return join(RAW_DIR, competitionKey);
}

async function downloadFile(url: string, dest: string): Promise<void> {
  if (existsSync(dest) && statSync(dest).size > 0) {
    console.log(`  cached: ${dest}`);
    return;
  }
  console.log(`  downloading: ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed ${res.status} ${url}`);
  await pipeline(Readable.fromWeb(res.body as import("stream/web").ReadableStream), createWriteStream(dest));
}

/**
 * Stage 1 — DOWNLOAD each competition zip + the people register, cache locally,
 * and extract each zip's match JSONs once. Re-runs skip anything already present.
 * Returns the local path of the people-register CSV.
 */
export async function download(): Promise<{ peopleCsv: string }> {
  mkdirSync(RAW_DIR, { recursive: true });

  for (const [key, cfg] of Object.entries(COMPETITIONS)) {
    console.log(`[download] ${key} (${cfg.displayLabel})`);
    const zipPath = join(RAW_DIR, cfg.zip);
    await downloadFile(`${CRICSHEET_BASE}/${cfg.zip}`, zipPath);

    const outDir = extractedDir(key);
    const alreadyExtracted =
      existsSync(outDir) && readdirSync(outDir).some((f) => f.endsWith(".json"));
    if (alreadyExtracted) {
      console.log(`  extracted: ${outDir}`);
      continue;
    }
    mkdirSync(outDir, { recursive: true });
    console.log(`  extracting ${cfg.zip} …`);
    new AdmZip(zipPath).extractAllTo(outDir, /* overwrite */ true);
  }

  const peopleCsv = join(RAW_DIR, "people.csv");
  console.log(`[download] people register`);
  await downloadFile(PEOPLE_REGISTER_URL, peopleCsv);

  return { peopleCsv };
}
