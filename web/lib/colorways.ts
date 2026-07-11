/**
 * C8 — team colorways. COLOURS ONLY (never logos/crests). Each colorway is a
 * card finish tuned for accessible text contrast (ink chosen per card):
 *   IPL   → the player's most-recent franchise
 *   ODI / T20I → nation
 *   TEST  → cricket whites/cream with a nation-colour trim line (Tests = whites)
 * The YOU card keeps its tier finish and is never colorwayed.
 */
import type { FormatBucket } from "./data";

export interface Colorway {
  bgA: string;
  bgB: string;
  ink: string; // contrast-checked against bgA/bgB
  trim: string; // spine + accents
  /** Muted ink for secondary text. */
  mute: string;
  label: string;
}

const cw = (bgA: string, bgB: string, ink: string, trim: string, mute: string, label: string): Colorway => ({ bgA, bgB, ink, trim, mute, label });

// Neutral graphite (unknown team/nation) — the house style.
export const NEUTRAL = cw("#17181c", "#101115", "#f4f5f7", "#d63c2f", "#9aa0aa", "Neutral");

// ── nations (ODI / T20I) ─────────────────────────────────────────────────────
export const NATION_COLORS: Record<string, Colorway> = {
  India: cw("#0a2a6b", "#061a44", "#eef3ff", "#ff8f1f", "#9fb4e0", "India"),
  Australia: cw("#0a3d2c", "#06251b", "#eafff5", "#ffd23c", "#8fcbb4", "Australia"),
  England: cw("#0b2547", "#06172e", "#eef3ff", "#e2434d", "#9fb2d4", "England"),
  Pakistan: cw("#0a3320", "#051f13", "#eafff2", "#3fd18e", "#84c3a3", "Pakistan"),
  "South Africa": cw("#0a3e2a", "#06251a", "#eafff4", "#ffc400", "#8ccbb0", "South Africa"),
  "West Indies": cw("#3a0620", "#220313", "#ffe4f0", "#e8b04a", "#d09bb2", "West Indies"),
  "New Zealand": cw("#16181c", "#0a0b0e", "#f2f5f8", "#c9d0d8", "#8b9099", "New Zealand"),
  "Sri Lanka": cw("#0e2650", "#081633", "#eef3ff", "#ffbf14", "#9fb2d6", "Sri Lanka"),
  Bangladesh: cw("#0a3d2c", "#06251b", "#eafff4", "#f4384c", "#8fcbb4", "Bangladesh"),
  Zimbabwe: cw("#123a24", "#0a2216", "#eafff2", "#ffcf3f", "#89bfa0", "Zimbabwe"),
  Ireland: cw("#0a3a24", "#062416", "#eafff2", "#ff883e", "#86c2a2", "Ireland"),
  Afghanistan: cw("#20130f", "#120b08", "#ffeee6", "#d3373a", "#c39a8f", "Afghanistan"),
  Scotland: cw("#0b2547", "#06172e", "#eef3ff", "#4a7fd0", "#9fb2d4", "Scotland"),
  Netherlands: cw("#2a1405", "#180b03", "#ffefe0", "#ff7a1a", "#cba98f", "Netherlands"),
  Namibia: cw("#0a3560", "#06203c", "#eef4ff", "#d7263d", "#9db6d6", "Namibia"),
  Nepal: cw("#2a0713", "#18040b", "#ffe6ee", "#dc143c", "#c799a6", "Nepal"),
  "United Arab Emirates": cw("#0a3320", "#051f13", "#eafff2", "#e23744", "#84c3a3", "UAE"),
  Oman: cw("#0a3320", "#051f13", "#eafff2", "#d7263d", "#84c3a3", "Oman"),
  "United States of America": cw("#0b2547", "#06172e", "#eef3ff", "#d7263d", "#9fb2d4", "USA"),
  Canada: cw("#2c0c0e", "#180708", "#ffe8e9", "#e23744", "#cb9a9c", "Canada"),
  "Papua New Guinea": cw("#20130f", "#120b08", "#ffeee6", "#e6b422", "#c39a8f", "Papua New Guinea"),
  Kenya: cw("#0a3a24", "#062416", "#eafff2", "#c8102e", "#86c2a2", "Kenya"),
};

// ── IPL franchises (IPL) ─────────────────────────────────────────────────────
const IPL: Record<string, Colorway> = {
  "Chennai Super Kings": cw("#f4c430", "#e0a900", "#1a1206", "#1866b3", "#5a4a12", "Chennai Super Kings"),
  "Mumbai Indians": cw("#0b2f5e", "#071d3b", "#eaf1fb", "#ffd34e", "#8ea8cc", "Mumbai Indians"),
  "Kolkata Knight Riders": cw("#2c1a49", "#1b1030", "#f3ecff", "#f5c518", "#b3a3cc", "Kolkata Knight Riders"),
  "Royal Challengers Bengaluru": cw("#2a0d10", "#160607", "#ffe9ea", "#e23744", "#cc9a9c", "Royal Challengers Bengaluru"),
  "Sunrisers Hyderabad": cw("#3a1e0b", "#21100a", "#ffe9d6", "#f57c2b", "#c9a488", "Sunrisers Hyderabad"),
  "Rajasthan Royals": cw("#3a0f28", "#22091a", "#ffe6f3", "#ff2e9a", "#c99ab4", "Rajasthan Royals"),
  "Delhi Capitals": cw("#10254f", "#0a1730", "#e9f0ff", "#e0333b", "#8ea3cc", "Delhi Capitals"),
  "Punjab Kings": cw("#2c0c0e", "#180708", "#ffe8e9", "#ec3b3b", "#cb9a9c", "Punjab Kings"),
  "Gujarat Titans": cw("#141a2b", "#0c101c", "#eaf0ff", "#d9b46a", "#8f97ac", "Gujarat Titans"),
  "Lucknow Super Giants": cw("#06333a", "#041e23", "#dffafd", "#22c7d6", "#7fb3ba", "Lucknow Super Giants"),
};
// Legacy / renamed / defunct franchises → current colours (or neutral).
const IPL_ALIAS: Record<string, string> = {
  "Delhi Daredevils": "Delhi Capitals",
  "Kings XI Punjab": "Punjab Kings",
  "Royal Challengers Bangalore": "Royal Challengers Bengaluru",
  "Rising Pune Supergiant": "Rising Pune Supergiants",
  "Rising Pune Supergiants": "Rising Pune Supergiants",
  "Deccan Chargers": "Sunrisers Hyderabad",
};
const IPL_DEFUNCT: Record<string, Colorway> = {
  "Rising Pune Supergiants": cw("#2a0d3a", "#170722", "#f3e6ff", "#e0308a", "#b39ac4", "Rising Pune Supergiants"),
  "Gujarat Lions": cw("#0a333a", "#041e23", "#e6fbff", "#f57c2b", "#7fb0b8", "Gujarat Lions"),
  "Kochi Tuskers Kerala": cw("#0a3a2e", "#062420", "#e6fff5", "#f57c2b", "#7fb8a8", "Kochi Tuskers Kerala"),
  "Pune Warriors": cw("#0a2f4a", "#061d30", "#e6f2ff", "#3fb0e0", "#7fa2c4", "Pune Warriors"),
};

// ── Test whites ──────────────────────────────────────────────────────────────
const WHITES = { bgA: "#eceae2", bgB: "#dedcd3", ink: "#20201c", mute: "#6b6a60" };

export function colorwayFor(bucket: FormatBucket, nation: string | null, lastIplTeam: string | null): Colorway {
  if (bucket === "ipl") {
    if (!lastIplTeam) return NEUTRAL;
    const key = IPL_ALIAS[lastIplTeam] ?? lastIplTeam;
    return IPL[key] ?? IPL_DEFUNCT[key] ?? NEUTRAL;
  }
  const nat = nation ? NATION_COLORS[nation] : null;
  if (bucket === "test") {
    // whites, with the nation's trim colour as the line
    return { ...WHITES, trim: nat?.trim ?? "#c0392b", label: nation ?? "Test" };
  }
  // odi / t20i
  return nat ?? NEUTRAL;
}
