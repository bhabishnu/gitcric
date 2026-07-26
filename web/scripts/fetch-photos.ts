/**
 * C6 — cricketer faces from Wikimedia Commons, keyed on our stored Cricinfo IDs
 * via Wikidata (P2698 Cricinfo player ID → P18 image). CC/PD-licensed only, with
 * attribution written to public/players/CREDITS.md. Never hotlinks or scrapes
 * Cricinfo/Getty. Idempotent: re-runs skip already-downloaded faces.
 *
 *   npx tsx scripts/fetch-photos.ts [--limit N]
 *
 * Outputs:
 *   public/players/<playerId>.jpg   downloaded thumbnails (free-licensed)
 *   public/players/CREDITS.md       attribution table
 *   gen/photos.json                 { playerId: filename } manifest for the app
 */
import Database from "better-sqlite3";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DB_PATH = join(ROOT, "data", "gitcric.db");
const PEOPLE_CSV = join(ROOT, "data", "raw", "people.csv");

/**
 * Bridge: Wikidata's P2698 ("ESPNcricinfo playing ID") actually matches the
 * Cricsheet register's `key_cricketarchive` column value — verified against
 * Kohli/Tendulkar/Warner/Rohit/Bumrah — NOT `key_cricinfo`. So we key photos on
 * the register's cricketarchive id, looked up by our player id (= register
 * identifier).
 */
function loadCricketArchiveIds(): Map<string, string> {
  const text = readFileSync(PEOPLE_CSV, "utf8").split(/\r?\n/);
  const header = text[0].split(",");
  const idCol = header.indexOf("identifier");
  const caCol = header.indexOf("key_cricketarchive");
  const map = new Map<string, string>();
  for (let i = 1; i < text.length; i++) {
    const c = text[i].split(",");
    const id = c[idCol]?.trim();
    const ca = c[caCol]?.trim();
    if (id && ca) map.set(id, ca);
  }
  return map;
}
const PHOTO_DIR = join(__dirname, "..", "public", "players");
const GEN = join(__dirname, "..", "gen");

const UA = "GitCric/1.1 (github.com/gitcric; cricketer identity photo build; non-commercial)";
const SPARQL = "https://query.wikidata.org/sparql";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg >= 0 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;
/** Re-download even when the file already exists (for a width/quality upgrade). */
const REFETCH = process.argv.includes("--refetch");
/** `--only id,id` restricts the run to specific player ids — for iterating on a
 *  single override without touching the other 300+ faces. */
const onlyArg = process.argv.indexOf("--only");
const ONLY = onlyArg >= 0 ? new Set(process.argv[onlyArg + 1].split(",").map((s) => s.trim())) : null;

/**
 * Requested thumbnail width. Was 500, which capped EVERY face at 500px even when
 * Commons held a far larger original — the card's portrait zone is ~460 CSS px
 * wide, i.e. ~920 device px on a retina screen, so 500px was being upscaled ~1.8x
 * and read as blur. 1000 covers the retina case with no meaningful waste;
 * Commons returns the original when it is smaller than this.
 */
const THUMB_W = 1000;
/** Re-encode quality. Commons thumbs are generously encoded; 80 (mozjpeg) keeps
 *  these visually identical at roughly half the bytes, which matters at 300+. */
const JPEG_Q = 80;

/**
 * Per-player overrides, keyed by OUR player id — they beat the Wikidata P18
 * pick, which is sometimes an action/stadium shot rather than a face.
 * Attribution is unaffected: these run through the same commonsInfo() lookup,
 * so CREDITS.json / CREDITS.md pick up the new author and licence themselves.
 */
const PHOTO_OVERRIDES: Record<string, string> = {
  // Wikidata's pick is 190x260 at ORIGINAL — nothing to re-fetch, it is simply
  // a tiny file. This one is a sun-hat head-shot, eyes visible, 1265x1273.
  // Head-and-shoulders in the India sun-hat, face clear. The batting action
  // shots ("Tendulkar batting against Australia, October 2010 (1)" and its
  // cropped sibling) were trialled and REJECTED: landscape sources lose 27-47%
  // of their width to the portrait crop, and he is helmeted and head-down, so
  // no face survives. Do not re-try them.
  d2c2b2d5: "Sachin Tendulkar cropped.jpg", // SR Tendulkar
  // Wikidata's pick is a wide stadium shot: full body at the crease, helmeted,
  // crowd + hoarding. The card crops to the upper-centre, so it showed crowd.
  a343262c: "Joe Root HIP1487 (cropped).jpg", // JE Root
  // Stored file was 117x133 — unusably small.
  "70b37e7b": "Graham Gooch OBE (3494096746).jpg", // GA Gooch
  // Wikidata's pick is a good face but sits so low that the name plate clips
  // his chin, and no crop can fix it (the cover-scale is width-driven, so a
  // shorter source only pulls the window up). This one frames higher.
  "4ba44e19": "MUTTIAH MURALITHARAN (5155181205).jpg", // M Muralitharan
};

/**
 * Players who get the monogram instead of a photo. Commons has no usable
 * portrait — better a clean monogram than a broken or unrecognisable face.
 */
const PHOTO_EXCLUDE = new Set<string>([
  // AM Rahane — stored file was 83x169. Commons offers only a watermarked
  // full-body red-carpet shot and a two-person awards photo; no portrait.
  "29e95537",
]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch with retry/backoff for transient network + rate-limit failures. */
async function fetchRetry(url: string, init?: RequestInit, tries = 4): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) return res;
      last = new Error(`HTTP ${res.status}`);
    } catch (e) {
      last = e;
    }
    await sleep(500 * 2 ** i);
  }
  throw last instanceof Error ? last : new Error("fetch failed");
}
const chunk = <T>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

function freeLicense(short: string): boolean {
  // Commons only hosts freely-licensed content (CC, PD, GODL, OGL, FAL, GFDL, …),
  // so accept by default and reject only explicitly non-free tags.
  return !/fair use|non-?free|all rights reserved|copyright(?!ed free)/i.test(short || "");
}
const stripHtml = (h: string) => (h || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

async function sparqlBatch(cids: string[]): Promise<Map<string, string>> {
  const values = cids.map((c) => `"${c.replace(/"/g, "")}"`).join(" ");
  const query = `SELECT ?cid ?img WHERE { VALUES ?cid { ${values} } ?item wdt:P2698 ?cid . OPTIONAL { ?item wdt:P18 ?img . } }`;
  const res = await fetchRetry(SPARQL, {
    method: "POST",
    headers: { "User-Agent": UA, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ query }),
  });
  if (!res.ok) throw new Error(`SPARQL ${res.status}`);
  const json = (await res.json()) as { results: { bindings: { cid: { value: string }; img?: { value: string } }[] } };
  const out = new Map<string, string>();
  for (const b of json.results.bindings) {
    if (b.img?.value) {
      // MediaWiki treats "_" and space as equivalent in titles — normalise to
      // spaces so this filename matches Commons' page.title on lookup.
      const file = decodeURIComponent(b.img.value.split("/Special:FilePath/")[1] ?? b.img.value.split("/").pop() ?? "").replace(/_/g, " ");
      if (file) out.set(b.cid.value, file);
    }
  }
  return out;
}

interface ImgInfo { thumburl: string; license: string; licenseUrl: string; artist: string; descUrl: string }

/** Returns Map keyed by the INPUT filename (resolving MediaWiki title
 *  normalization + file redirects so every input maps to its real page). */
async function commonsInfo(files: string[]): Promise<Map<string, ImgInfo>> {
  const titles = files.map((f) => `File:${f}`).join("|");
  const url = `${COMMONS_API}?${new URLSearchParams({
    action: "query", titles, redirects: "1", prop: "imageinfo", iiprop: "extmetadata|url", iiurlwidth: String(THUMB_W), format: "json",
  })}`;
  const res = await fetchRetry(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Commons ${res.status}`);
  const json = (await res.json()) as {
    query?: {
      normalized?: { from: string; to: string }[];
      redirects?: { from: string; to: string }[];
      pages?: Record<string, { title: string; imageinfo?: { thumburl?: string; url?: string; extmetadata?: Record<string, { value: string }> }[] }>;
    };
  };
  const q = json.query ?? {};
  const remap = new Map<string, string>();
  for (const n of q.normalized ?? []) remap.set(n.from, n.to);
  for (const r of q.redirects ?? []) remap.set(r.from, r.to);
  const resolve = (t: string) => {
    let cur = t;
    const seen = new Set<string>();
    while (remap.has(cur) && !seen.has(cur)) { seen.add(cur); cur = remap.get(cur)!; }
    return cur;
  };
  const infoByTitle = new Map<string, ImgInfo>();
  for (const page of Object.values(q.pages ?? {})) {
    const ii = page.imageinfo?.[0];
    if (!ii) continue;
    const em = ii.extmetadata ?? {};
    infoByTitle.set(page.title, {
      thumburl: ii.thumburl ?? ii.url ?? "",
      license: em.LicenseShortName?.value ?? "",
      licenseUrl: em.LicenseUrl?.value ?? "",
      artist: stripHtml(em.Artist?.value ?? "Unknown"),
      descUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
    });
  }
  const out = new Map<string, ImgInfo>();
  for (const f of files) {
    const info = infoByTitle.get(resolve(`File:${f}`));
    if (info) out.set(f, info);
  }
  return out;
}

async function download(u: string, dest: string): Promise<boolean> {
  // upload.wikimedia.org rate-limits bursts — retry 429/5xx with backoff.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(u, { headers: { "User-Agent": UA, Referer: "https://commons.wikimedia.org/" } });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        // A rate-limited response can still come back 200 with an HTML error
        // page; writing that would leave a "JPEG" the browser can't decode.
        if (!(buf[0] === 0xff && buf[1] === 0xd8) && buf.slice(0, 8).toString("hex") !== "89504e470d0a1a0a") {
          throw new Error("not an image");
        }
        // Normalise: bound the width and re-encode. Commons hands back the
        // ORIGINAL when it declines to render a thumb, so iiurlwidth alone does
        // not cap anything — without this a 4000px original would land on disk
        // whole. 1000 still clears the card's ~920 device-px retina need.
        writeFileSync(
          dest,
          await sharp(buf)
            .resize({ width: THUMB_W, withoutEnlargement: true })
            .jpeg({ quality: JPEG_Q, mozjpeg: true })
            .toBuffer(),
        );
        return true;
      }
      if (res.status !== 429 && res.status < 500) return false; // hard failure — don't retry
    } catch {
      /* network hiccup / bad payload — retry */
    }
    await sleep(500 * 2 ** attempt); // 0.5, 1, 2, 4, 8s
  }
  return false;
}

async function main() {
  mkdirSync(PHOTO_DIR, { recursive: true });
  mkdirSync(GEN, { recursive: true });
  const db = new Database(DB_PATH, { readonly: true });
  const caIds = loadCricketArchiveIds();
  const players = (db.prepare(`
    WITH agg AS (SELECT player_id, SUM(CASE WHEN gated=1 THEN 1 ELSE 0 END) gf FROM player_format_stats GROUP BY player_id)
    SELECT p.id, p.name FROM players p JOIN agg a ON a.player_id=p.id WHERE a.gf>=2
  `).all() as { id: string; name: string }[])
    .map((p) => ({ ...p, cid: caIds.get(p.id) ?? "" }))
    .filter((p) => p.cid)
    .filter((p) => !ONLY || ONLY.has(p.id))
    .slice(0, LIMIT);
  console.log(`${players.length} recognizable players with a cricketarchive id`);

  // existing manifest → allow idempotent re-runs
  const manifestPath = join(GEN, "photos.json");
  const manifest: Record<string, string> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  const credits: Record<string, { name: string; artist: string; license: string; url: string }> = {};
  const creditsPath = join(PHOTO_DIR, "CREDITS.json");
  const priorCredits = existsSync(creditsPath) ? JSON.parse(readFileSync(creditsPath, "utf8")) : {};
  Object.assign(credits, priorCredits);

  const byCid = new Map(players.map((p) => [p.cid, p]));

  // Persist manifest + credits + CREDITS.md — called after every batch so a
  // timeout never loses progress (idempotent, resumable).
  const persist = () => {
    writeFileSync(manifestPath, JSON.stringify(manifest));
    writeFileSync(creditsPath, JSON.stringify(credits, null, 0));
    const lines = ["# Cricketer photo credits", "", "All images from Wikimedia Commons under free (CC / public-domain / open-data) licenses. No images are hotlinked or scraped from ESPNcricinfo or Getty.", ""];
    lines.push("| Player | Author | License | Source |", "| --- | --- | --- | --- |");
    for (const c of Object.values(credits).sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`| ${c.name} | ${c.artist} | ${c.license} | [Commons](${c.url}) |`);
    }
    writeFileSync(join(PHOTO_DIR, "CREDITS.md"), lines.join("\n"));
  };

  // 1) Wikidata SPARQL → cricketarchive id → commons filename (ALL players, so
  // credits are (re)captured even for faces downloaded in an earlier run).
  const cidToFile = new Map<string, string>();
  for (const batch of chunk(players.map((p) => p.cid), 140)) {
    try {
      const m = await sparqlBatch(batch);
      m.forEach((v, k) => cidToFile.set(k, v));
    } catch (e) {
      console.log("  SPARQL batch failed:", (e as Error).message);
    }
    await sleep(400);
  }
  console.log(`Wikidata: ${cidToFile.size} players have a Commons image`);

  // Manual picks beat the automatic one. Applied here, before any download, so
  // overridden players flow through the identical licence/credit path.
  const byId = new Map(players.map((p) => [p.id, p]));
  for (const [id, file] of Object.entries(PHOTO_OVERRIDES)) {
    const p = byId.get(id);
    if (!p) { console.log(`  override skipped — no such player ${id}`); continue; }
    cidToFile.set(p.cid, file);
    console.log(`  override: ${p.name} → ${file}`);
  }
  // Excluded players fall back to the monogram: drop any stored face + manifest
  // entry, so re-running can't quietly resurrect the bad image.
  for (const id of PHOTO_EXCLUDE) {
    const p = byId.get(id);
    if (p) cidToFile.delete(p.cid);
    delete manifest[id];
    delete credits[id];
    rmSync(join(PHOTO_DIR, `${id}.jpg`), { force: true });
    console.log(`  excluded (monogram): ${p?.name ?? id}`);
  }

  // 2) Commons imageinfo (license + thumburl), 3) download if not already present
  let saved = 0, skippedNonFree = 0, noMeta = 0, noThumb = 0, dlFail = 0;
  const entries = [...cidToFile.entries()];
  for (const fileBatch of chunk(entries, 25)) {
    const files = fileBatch.map(([, f]) => f);
    let info: Map<string, ImgInfo>;
    try {
      info = await commonsInfo(files);
    } catch (e) {
      console.log("  Commons batch failed:", (e as Error).message);
      await sleep(500);
      continue;
    }
    for (const [cid, file] of fileBatch) {
      const meta = info.get(file);
      const player = byCid.get(cid);
      if (!player) continue;
      if (!meta) { noMeta++; continue; }
      if (!meta.thumburl) { noThumb++; continue; }
      if (!freeLicense(meta.license)) { skippedNonFree++; continue; }
      const dest = join(PHOTO_DIR, `${player.id}.jpg`);
      let ok = existsSync(dest) && !REFETCH;
      if (!ok) {
        ok = await download(meta.thumburl, dest);
        if (ok) saved++;
        else dlFail++;
        await sleep(150); // gentler on upload.wikimedia.org during a full refetch
      }
      if (ok) {
        manifest[player.id] = `${player.id}.jpg`;
        credits[player.id] = { name: player.name, artist: meta.artist || "Unknown", license: meta.license || "CC", url: meta.descUrl };
      }
    }
    persist();
    console.log(`  …${saved} new saved, ${Object.keys(manifest).length} total (dlFail ${dlFail})`);
  }

  console.log(`\n✓ ${Object.keys(manifest).length} photos (+${saved} new), ${skippedNonFree} non-free skipped, ${noMeta + noThumb} unusable. Monogram fallback for the rest.`);
  db.close();
}

main();
