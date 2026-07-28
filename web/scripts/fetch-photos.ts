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

/**
 * Wikimedia's User-Agent policy wants a UA that identifies the tool AND offers
 * a way to contact whoever runs it. The old value named "github.com/gitcric",
 * which is not a real repository and carries no contact, and Wikimedia
 * throttled it hard: upload.wikimedia.org returned 429 for this UA while the
 * same request from a compliant one returned 200. That was the cause of the
 * download failures in the Phase 2A batch, not request volume.
 */
const UA = "GitCric/1.1 (https://github.com/bhabishnu/gitcric; cricketer identity photo build; non-commercial)";
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

  // ── Phase 2A: 33 vetted replacements for low-quality stored photos ────────
  // Selection was NOT filename-based — that approach proposed a bronze statue
  // for Ponting, a TV camera in front of Dhawan's face, and (worst) Ravindra
  // Jadeja's wife Rivaba. Each entry below was face-detected (YuNet), scored on
  // where the face lands in the card's real crop, identity-checked against the
  // player's previous photo (SFace cosine >= 0.36), and finally eyeballed.
  // Full record: web/photo-phase2a-proposals.json / -review.html.
  "271f83cd": "Suryakumar Yadav in PMO New Delhi.jpg", // SA Yadav
  db584dad: "CHRIS GAYLE (4338758231).jpg", // CH Gayle
  "6b71e6cf": "KUMAR SANGAKKARA (5155171149).jpg", // KC Sangakkara
  b8d490fd: "AARON FINCH (6299558883).jpg", // AJ Finch
  "6a26221c": "Aiden Markram interview after WTC final 2025 (cropped).png", // AK Markram
  abb83e27: "2 05 Bairstow out.jpg", // JM Bairstow
  a757b0d8: "Kieron Pollard.jpg", // KA Pollard
  "0a476045": "SHIKHAR DHAWAN (16005494418).jpg", // S Dhawan
  d027ba9f: "Kane Williamson.jpg", // KS Williamson
  "7dc35884": "Shakib Al Hasan (2).jpg", // Shakib Al Hasan
  de8cce37: "VVSLaxman.jpg", // VVS Laxman
  "3fb19989": "Mitchell Starc fielding 2021 (cropped).jpg", // MA Starc
  "495d42a5": "Ravichandran Ashwin (2).jpg", // R Ashwin
  fe93fd9d: "Ravindra Jadeja in PMO New Delhi.jpg", // RA Jadeja
  c03f1114: "Dinesh.Karthik.jpg", // KD Karthik
  "2254ab79": "Sarfaraz Ahmed answering RAPID FIRE questions (PCB) 02.jpg", // Sarfraz Ahmed
  "8cf9814c": "Mohammed Shami bowling against England at Edgbaston.jpg", // Mohammed Shami
  a94e08ea: "Mushfiqur Rahim 2018 (cropped).jpg", // Mushfiqur Rahim
  "9cb8d7a6": "Imad Wasim 1.jpg", // Imad Wasim
  "96a6a7ad": "Nathan Lyon The Test clip.png", // NM Lyon
  "53597be1": "Cricket at Lord's (17165108401) (Brendon Taylor cropped).jpg", // BRM Taylor
  "00ea847a": "2 38 Agarwal mugshot.jpg", // MA Agarwal
  "40c041ea": "4 12 Imam-ul-Haq mugshot.jpg", // Imam-ul-Haq
  cc1e8c68: "Umesh Yadav (2).jpg", // UT Yadav
  "45a7e761": "Shaheen Afridi jogging Sri Lanka vs Pakistan - 2nd TEST Match - SSC, Colombo (cropped).jpg", // Shaheen Shah Afridi
  "7147f314": "Sabbir Rahman 2016 (cropped).jpg", // Sabbir Rahman
  "5bb1a1c4": "Ishant Sharma 2.JPG", // I Sharma
  "755a77c6": "4 02 Gary Ballance.jpg", // GS Ballance
  c16d2e28: "Steve Harmison bowl.jpg", // SJ Harmison
  "10a91f35": "Shoaib Akhtar in 2014 (cropped).jpg", // Shoaib Akhtar
  bbd41817: "Andre Russell (2).jpg", // AD Russell
  "5a37ec26": "Monty Panesar (2014) (02).jpg", // MS Panesar
  ef18b66e: "Taskin Ahmed at Chef's Table.png", // Taskin Ahmed
};

/**
 * Players who get the monogram instead of a photo. Commons has no usable
 * portrait — better a clean monogram than a broken or unrecognisable face.
 */
const PHOTO_EXCLUDE = new Set<string>([
  // AM Rahane — stored file was 83x169. Commons offers only a watermarked
  // full-body red-carpet shot and a two-person awards photo; no portrait.
  "29e95537",
  // Phase 2A: reviewed and chosen for the monogram. Commons has files for these
  // players but nothing that is both verifiably them and usable after the
  // card's crop — a clean monogram beats an unrecognisable face.
  "88fccd6c", // SM Pollock
  "d2babdd5", // E Chigumbura
  "221ad9d9", // GP Swann
  "0fa5042b", // L Ronchi
  "f846de6a", // MN Samuels
  "944533a5", // KK Nair
  "e957b38f", // AR McBrine
  "2503e881", // A Nel
  "6eea0b32", // Nasir Hossain
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
