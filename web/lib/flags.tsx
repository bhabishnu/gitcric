/**
 * C7 — SVG flags. Simplified but recognizable at card size (bands + key
 * emblem). Cricketers: keyed on derived nation. GitHub users: best-effort parse
 * of the profile location, shown ONLY on a confident country match.
 */
import type { JSX } from "react";

export type FlagCode =
  | "IN" | "AU" | "EN" | "PK" | "ZA" | "WI" | "NZ" | "LK" | "BD" | "ZW" | "IE" | "AF"
  | "SC" | "NL" | "NA" | "NP" | "AE" | "OM" | "US" | "CA" | "PG" | "KE";

const NATION_TO_CODE: Record<string, FlagCode> = {
  India: "IN", Australia: "AU", England: "EN", Pakistan: "PK", "South Africa": "ZA",
  "West Indies": "WI", "New Zealand": "NZ", "Sri Lanka": "LK", Bangladesh: "BD",
  Zimbabwe: "ZW", Ireland: "IE", Afghanistan: "AF", Scotland: "SC", Netherlands: "NL",
  Namibia: "NA", Nepal: "NP", "United Arab Emirates": "AE", Oman: "OM",
  "United States of America": "US", Canada: "CA", "Papua New Guinea": "PG", Kenya: "KE",
};

export function flagForNation(nation: string | null): FlagCode | null {
  return nation ? NATION_TO_CODE[nation] ?? null : null;
}

/** Best-effort GitHub location → country. Conservative: unmatched → null. */
export function flagForLocation(location: string | null): FlagCode | null {
  if (!location) return null;
  const s = ` ${location.toLowerCase()} `;
  const has = (...w: string[]) => w.some((x) => s.includes(x));
  if (has("india", "bengaluru", "bangalore", "mumbai", "delhi", "hyderabad", "chennai", "pune", "kolkata")) return "IN";
  if (has("pakistan", "karachi", "lahore", "islamabad")) return "PK";
  if (has("bangladesh", "dhaka")) return "BD";
  if (has("sri lanka", "colombo")) return "LK";
  if (has("nepal", "kathmandu")) return "NP";
  if (has("australia", "sydney", "melbourne", "brisbane", "perth")) return "AU";
  if (has("new zealand", "auckland", "wellington")) return "NZ";
  if (has("scotland", "edinburgh", "glasgow")) return "SC";
  if (has("ireland", "dublin")) return "IE";
  if (has("netherlands", "amsterdam", "holland")) return "NL";
  if (has("south africa", "johannesburg", "cape town")) return "ZA";
  if (has("canada", "toronto", "vancouver", "montreal")) return "CA";
  if (has("united arab emirates", " uae ", "dubai", "abu dhabi")) return "AE";
  if (has("england", "london", "manchester", "united kingdom", " uk ", "britain", "leeds", "bristol")) return "EN";
  if (has("united states", " usa ", " u.s.", "america", "new york", "san francisco", "seattle", "boston", "austin", "california", " ca ", " ny ", " tx ", "washington")) return "US";
  return null;
}

// ── SVGs (viewBox 3×2) ───────────────────────────────────────────────────────
const band = (colors: string[], vertical = false) =>
  colors.map((c, i) => {
    const n = colors.length;
    return vertical ? (
      <rect key={i} x={(3 / n) * i} y="0" width={3 / n} height="2" fill={c} />
    ) : (
      <rect key={i} x="0" y={(2 / n) * i} width="3" height={2 / n} fill={c} />
    );
  });

const FLAGS: Record<FlagCode, JSX.Element> = {
  IN: (<> {band(["#FF9933", "#ffffff", "#138808"])} <circle cx="1.5" cy="1" r="0.28" fill="none" stroke="#0a3a8f" strokeWidth="0.06" /> </>),
  PK: (<> <rect x="0" y="0" width="3" height="2" fill="#01411C" /> <rect x="0" y="0" width="0.75" height="2" fill="#fff" /> <circle cx="2" cy="1" r="0.42" fill="#fff" /> <circle cx="2.12" cy="1" r="0.36" fill="#01411C" /> </>),
  BD: (<> <rect width="3" height="2" fill="#006a4e" /> <circle cx="1.35" cy="1" r="0.55" fill="#f42a41" /> </>),
  LK: (<> <rect width="3" height="2" fill="#8d2029" /> <rect x="0.15" y="0.2" width="0.5" height="1.6" fill="#00534e" /> <rect x="0.68" y="0.2" width="0.5" height="1.6" fill="#eb7400" /> <rect x="1.25" y="0.2" width="1.6" height="1.6" fill="#8d2029" stroke="#f6c34e" strokeWidth="0.08" /> </>),
  EN: (<> <rect width="3" height="2" fill="#fff" /> <rect x="1.25" y="0" width="0.5" height="2" fill="#ce1124" /> <rect x="0" y="0.75" width="3" height="0.5" fill="#ce1124" /> </>),
  ZA: (<> <rect width="3" height="2" fill="#002395" /> <rect width="3" height="1" y="0" fill="#de3831" /> <rect width="3" height="1" y="1" fill="#002395" /> <path d="M0 0 L1.2 1 L0 2 Z" fill="#007a4d" /> <path d="M0 0.35 L0.85 1 L0 1.65 Z" fill="#000" /> <rect x="0" y="0.72" width="1.5" height="0.56" fill="#ffb915" /><rect x="0" y="0.82" width="1.35" height="0.36" fill="#007a4d" /> </>),
  WI: (<> <rect width="3" height="2" fill="#7b0041" /> <circle cx="1.5" cy="0.85" r="0.32" fill="#f4c430" /> <path d="M1.5 1.15 v0.55 M1.3 1.7 h0.4" stroke="#f4c430" strokeWidth="0.09" /> </>),
  NZ: (<> <rect width="3" height="2" fill="#00247d" /> {[[2.1, 0.6], [2.55, 1.0], [2.05, 1.35], [2.35, 1.65]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.12" fill="#cc142b" stroke="#fff" strokeWidth="0.04" />)} </>),
  AU: (<> <rect width="3" height="2" fill="#00247d" /> <path d="M0 0 h1.5 v1 h-1.5 Z" fill="#012169" /> <path d="M0 0 L1.5 1 M1.5 0 L0 1" stroke="#fff" strokeWidth="0.14" /> <path d="M0.75 0 v1 M0 0.5 h1.5" stroke="#fff" strokeWidth="0.22" /> <path d="M0.75 0 v1 M0 0.5 h1.5" stroke="#c8102e" strokeWidth="0.12" /> <circle cx="0.75" cy="1.55" r="0.16" fill="#fff" /> {[[2.2, 0.55], [2.6, 0.95], [2.15, 1.3], [2.5, 1.6]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.1" fill="#fff" />)} </>),
  ZW: (<> {band(["#006400", "#ffd200", "#d40000", "#000", "#d40000", "#ffd200", "#006400"])} <path d="M0 0 L1 1 L0 2 Z" fill="#fff" /> </>),
  IE: (<> {band(["#169b62", "#fff", "#ff883e"], true)} </>),
  AF: (<> {band(["#000", "#d32011", "#007a36"], true)} </>),
  SC: (<> <rect width="3" height="2" fill="#0065bf" /> <path d="M0 0 L3 2 M3 0 L0 2" stroke="#fff" strokeWidth="0.28" /> </>),
  NL: (<> {band(["#ae1c28", "#fff", "#21468b"])} </>),
  NA: (<> <rect width="3" height="2" fill="#003580" /> <path d="M0 2 L3 0 L3 0.5 L0.7 2 Z" fill="#fff" /> <path d="M0 2 L3 0.15 L3 0.4 L0.4 2 Z" fill="#d21034" /> <path d="M0 0 h1.2 v0.1 h-1.2 Z" fill="#009543" /> <path d="M0 1.9 h3 v0.1 h-3 Z" fill="#009543" /> </>),
  NP: (<> <rect width="3" height="2" fill="#dc143c" stroke="#003893" strokeWidth="0.08" /> </>),
  AE: (<> <rect x="0.75" y="0" width="2.25" height="2" fill="#00732f" /> <rect x="0.75" y="0.67" width="2.25" height="0.66" fill="#fff" /> <rect x="0.75" y="1.33" width="2.25" height="0.67" fill="#000" /> <rect x="0" y="0" width="0.75" height="2" fill="#ff0000" /> </>),
  OM: (<> <rect width="3" height="2" fill="#fff" /> <rect y="0.67" width="3" height="0.66" fill="#db161b" /> <rect y="1.33" width="3" height="0.67" fill="#008000" /> <rect x="0" y="0" width="0.7" height="2" fill="#db161b" /> </>),
  US: (<> {band(["#b22234", "#fff", "#b22234", "#fff", "#b22234", "#fff", "#b22234"])} <rect width="1.3" height="1.15" fill="#3c3b6e" /> </>),
  CA: (<> <rect width="3" height="2" fill="#fff" /> <rect width="0.75" height="2" fill="#d80621" /> <rect x="2.25" width="0.75" height="2" fill="#d80621" /> <path d="M1.5 0.5 l0.12 0.3 l0.3 -0.1 l-0.15 0.35 l0.28 0.15 l-0.33 0.12 l0.05 0.33 l-0.3 -0.2 l-0.3 0.2 l0.05 -0.33 l-0.33 -0.12 l0.28 -0.15 l-0.15 -0.35 l0.3 0.1 Z" fill="#d80621" /> </>),
  PG: (<> <rect width="3" height="2" fill="#000" /> <path d="M0 0 L3 0 L0 2 Z" fill="#ce1126" /> </>),
  KE: (<> {band(["#000", "#fff", "#bb0000", "#fff", "#006600"])} <path d="M1.5 0.4 L1.75 1 L1.5 1.6 L1.25 1 Z" fill="#bb0000" stroke="#fff" strokeWidth="0.04" /> </>),
};

export function Flag({ code, className }: { code: FlagCode | null; className?: string }) {
  if (!code || !FLAGS[code]) return null;
  return (
    <svg viewBox="0 0 3 2" className={className} preserveAspectRatio="xMidYMid slice" role="img" aria-label={code}>
      {FLAGS[code]}
    </svg>
  );
}
