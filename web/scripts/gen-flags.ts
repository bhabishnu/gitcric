/**
 * Bakes the flag asset set into web/lib/flags.data.ts (a committed artifact, in
 * the same spirit as gen/*.json — nothing native or fetched at runtime).
 *
 * Source: flag-icons v7 (MIT), the 4x3 set — accurate, properly-proportioned
 * national flags. We inline the markup rather than <img src> so html-to-image's
 * PNG capture never has to fetch anything (the whole card must serialise from
 * the DOM alone).
 *
 * Two special cases:
 *   - WI  — the West Indies are a multi-nation cricket team, not a country, so
 *           no flag library has them. Hand-drawn from the Cricket West Indies
 *           insignia: maroon field, gold sun, palm tree, stumps.
 *   - NP  — Nepal is the world's only non-rectangular national flag. The asset
 *           draws the double pennant on a TRANSPARENT 4x3 field, so we tighten
 *           the viewBox to the pennant's real bounds and let the card render it
 *           on a neutral plate at its true proportions (never stretched).
 *
 * Run: npm run gen-flags
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "node_modules/flag-icons/flags/4x3");
const OUT = join(process.cwd(), "lib/flags.data.ts");

/** Our FlagCode → flag-icons basename. WI is drawn below, not sourced. */
const SOURCE: Record<string, string> = {
  IN: "in", AU: "au", EN: "gb-eng", PK: "pk", ZA: "za", NZ: "nz", LK: "lk",
  BD: "bd", ZW: "zw", IE: "ie", AF: "af", SC: "gb-sct", NL: "nl", NA: "na",
  NP: "np", AE: "ae", OM: "om", US: "us", CA: "ca", PG: "pg", KE: "ke",
  // Non-cricket nations, added for GitHub profile locations. These never come
  // from a cricketer's nation — only from flagForLocation().
  DE: "de", FR: "fr", BR: "br", JP: "jp", CN: "cn", RU: "ru", ES: "es",
  IT: "it", PL: "pl", SE: "se", NO: "no", DK: "dk", FI: "fi", CH: "ch",
  AT: "at", BE: "be", PT: "pt", TR: "tr", UA: "ua", IL: "il", SG: "sg",
  KR: "kr", MX: "mx", AR: "ar", ID: "id", PH: "ph", VN: "vn", TH: "th",
  MY: "my", NG: "ng", EG: "eg", GR: "gr", CZ: "cz", RO: "ro", HU: "hu",
  TW: "tw", HK: "hk", CO: "co", CL: "cl", GB: "gb",
};

const NAME: Record<string, string> = {
  IN: "India", AU: "Australia", EN: "England", PK: "Pakistan", ZA: "South Africa",
  WI: "West Indies", NZ: "New Zealand", LK: "Sri Lanka", BD: "Bangladesh",
  ZW: "Zimbabwe", IE: "Ireland", AF: "Afghanistan", SC: "Scotland",
  NL: "Netherlands", NA: "Namibia", NP: "Nepal", AE: "United Arab Emirates",
  OM: "Oman", US: "United States", CA: "Canada", PG: "Papua New Guinea",
  KE: "Kenya",
  DE: "Germany", FR: "France", BR: "Brazil", JP: "Japan", CN: "China",
  RU: "Russia", ES: "Spain", IT: "Italy", PL: "Poland", SE: "Sweden",
  NO: "Norway", DK: "Denmark", FI: "Finland", CH: "Switzerland",
  AT: "Austria", BE: "Belgium", PT: "Portugal", TR: "Turkey", UA: "Ukraine",
  IL: "Israel", SG: "Singapore", KR: "South Korea", MX: "Mexico",
  AR: "Argentina", ID: "Indonesia", PH: "Philippines", VN: "Vietnam",
  TH: "Thailand", MY: "Malaysia", NG: "Nigeria", EG: "Egypt", GR: "Greece",
  CZ: "Czechia", RO: "Romania", HU: "Hungary", TW: "Taiwan",
  HK: "Hong Kong", CO: "Colombia", CL: "Chile", GB: "United Kingdom",
};

/**
 * Nepal's pennant, in the source's 640x480 space, spans x 0..376.5 / y 0..480
 * (path bounds + half of the 13.8 stroke, through translate(0 15)scale(.9375),
 * then clipped to y 0..480). Framing it tight makes the SVG's own box the flag's
 * true ~377:480 shape, so `meet` centres it honestly instead of pillarboxing it
 * inside a 4:3 rectangle it doesn't own.
 */
const VIEWBOX_OVERRIDE: Record<string, string> = { NP: "0 0 377 480" };

/**
 * Cricket West Indies: maroon field, gold sun, a palm to the left and three
 * stumps to the right, over a green mound — the insignia the multi-nation team
 * carries in place of a country flag. Drawn to read at ~45px on the card, so
 * the shapes are bold: sun disc, a trunk with distinct fronds, clear stumps
 * kept off the disc so the gold-on-gold doesn't disappear.
 */
const WI_INNER =
  '<path fill="#7b0041" d="M0 0h640v480H0z"/>' +
  // sun
  '<circle cx="318" cy="214" r="90" fill="#f4c430"/>' +
  // green mound the palm and stumps stand on
  '<path fill="#0a6b3d" d="M150 392c40-26 96-40 168-40s128 14 168 40z"/>' +
  // palm — trunk (base left, curving up and right over the sun)
  '<path fill="#0a6b3d" d="M232 388c0-74 10-124 52-186l22 14c-34 56-44 104-44 172z"/>' +
  // palm — six fronds fanning from the crown
  '<g stroke="#0a6b3d" stroke-width="15" fill="none" stroke-linecap="round">' +
  '<path d="M300 200c-40-30-86-32-124-8"/>' +
  '<path d="M300 200c-46-6-82 16-104 54"/>' +
  '<path d="M300 200c-24-42-20-84 8-118"/>' +
  '<path d="M300 200c34-32 80-36 118-14"/>' +
  '<path d="M300 200c44-2 78 22 96 60"/>' +
  '<path d="M300 200c10-40 42-66 86-74"/>' +
  "</g>" +
  '<circle cx="300" cy="200" r="12" fill="#0a6b3d"/>' +
  // stumps + bails, clear of the sun disc so the gold stays legible
  '<g fill="#f4c430">' +
  '<path d="M438 258h14v112h-14zm32 0h14v112h-14zm32 0h14v112h-14z"/>' +
  '<path d="M434 246h52v11h-52zm32 0h52v11h-52z"/>' +
  "</g>";

function inner(code: string): { viewBox: string; inner: string } {
  if (code === "WI") return { viewBox: "0 0 640 480", inner: WI_INNER };
  const raw = readFileSync(join(SRC, `${SOURCE[code]}.svg`), "utf8");
  const viewBox = /viewBox="([^"]+)"/.exec(raw)?.[1];
  if (!viewBox) throw new Error(`${code}: no viewBox`);

  // Drop the outer <svg …> wrapper — we render our own root element.
  let body = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

  // Namespace every internal id (np-a, ke-a, …) so an inlined flag can never
  // collide with another id on the page, and repoint every reference to it.
  const ids = new Set<string>();
  for (const m of body.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
  for (const id of ids) {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    body = body
      .replace(new RegExp(`(\\sid=")${esc}(")`, "g"), `$1gcf-${code}-${id}$2`)
      .replace(new RegExp(`url\\(#${esc}\\)`, "g"), `url(#gcf-${code}-${id})`)
      .replace(new RegExp(`((?:xlink:)?href=")#${esc}(")`, "g"), `$1#gcf-${code}-${id}$2`);
  }

  return {
    viewBox: VIEWBOX_OVERRIDE[code] ?? viewBox,
    inner: body.replace(/>\s+</g, "><").replace(/\s+/g, " ").trim(),
  };
}

const codes = ["IN", "AU", "EN", "PK", "ZA", "WI", "NZ", "LK", "BD", "ZW", "IE",
  "AF", "SC", "NL", "NA", "NP", "AE", "OM", "US", "CA", "PG", "KE",
  "DE", "FR", "BR", "JP", "CN", "RU", "ES", "IT", "PL", "SE", "NO", "DK",
  "FI", "CH", "AT", "BE", "PT", "TR", "UA", "IL", "SG", "KR", "MX", "AR",
  "ID", "PH", "VN", "TH", "MY", "NG", "EG", "GR", "CZ", "RO", "HU", "TW",
  "HK", "CO", "CL", "GB"];

const entries = codes.map((c) => {
  const { viewBox, inner: body } = inner(c);
  return `  ${c}: { viewBox: ${JSON.stringify(viewBox)}, name: ${JSON.stringify(NAME[c])}, inner: ${JSON.stringify(body)} },`;
});

const out = `// GENERATED by scripts/gen-flags.ts — do not edit. Run \`npm run gen-flags\`.
// Source: flag-icons v7 (MIT) 4x3 set; WI is our own Cricket West Indies mark.
import type { FlagCode } from "./flags";

export interface FlagAsset {
  /** The asset's own box. NP is tightened to the pennant's true bounds. */
  viewBox: string;
  name: string;
  inner: string;
}

export const FLAG_ASSETS: Record<FlagCode, FlagAsset> = {
${entries.join("\n")}
};
`;

writeFileSync(OUT, out);
const kb = (out.length / 1024).toFixed(1);
console.log(`wrote ${OUT} — ${codes.length} flags, ${kb} kB`);
