import { ImageResponse } from "next/og";
import { fetchSignals } from "../../lib/github/client";
import { buildUserCard } from "../../lib/scoring/engine";
import { pickTwins } from "../../lib/match/matcher";
import { PLAYER_INDEX } from "../../lib/data";

export const runtime = "nodejs";
export const revalidate = 21600;
export const alt = "GitCric card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TRIM = "#d63c2f";
const BG = "#0a0a0b";
const INK = "#edeef0";
const MUTED = "#8a8f98";

// Tier finishes — mirror the CSS [data-tier] tokens so the OG matches the card.
const TIERS: Record<string, { a: string; b: string; line: string; ink: string }> = {
  bronze: { a: "#241a12", b: "#17110c", line: "#6d4326", ink: "#f0e2d5" },
  silver: { a: "#1c2026", b: "#12151a", line: "#7f8894", ink: "#f2f5f8" },
  gold: { a: "#2a2210", b: "#191307", line: "#c8992f", ink: "#fbeecb" },
  immortal: { a: "#0f2026", b: "#0a1418", line: "#4fc9e6", ink: "#e8fbff" },
};
const ROLE_LABEL: Record<string, string> = {
  batter: "BATTER", bowler: "BOWLER", allrounder: "ALL-ROUNDER", keeper: "WK-BATTER",
};

// The exact crest path (same geometry as the live card). Baked into an SVG
// <img> so the OG gets a smooth silhouette — Satori clips only polygons.
const SHIELD =
  "M22 58 C22 26 28 20 60 16 C132 8 408 8 480 16 C512 20 518 26 518 58 " +
  "L518 486 C518 566 500 610 452 664 C398 726 318 766 270 808 " +
  "C222 766 142 726 88 664 C40 610 22 566 22 486 Z";
const inset = (k: number) => `translate(270 410) scale(${k}) translate(-270 -410)`;

function shieldDataUri(f: { a: string; b: string; line: string }): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 820">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0.5" y2="1">` +
    `<stop offset="0" stop-color="${f.a}"/><stop offset="0.62" stop-color="${f.b}"/>` +
    `<stop offset="1" stop-color="${f.a}"/></linearGradient></defs>` +
    `<path d="${SHIELD}" fill="url(#g)"/>` +
    `<path d="${SHIELD}" fill="none" stroke="${f.line}" stroke-width="4" transform="${inset(0.99)}"/>` +
    `<path d="${SHIELD}" fill="none" stroke="${TRIM}" stroke-width="1.8" transform="${inset(0.955)}"/>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** The card on the graphite background — the shareable OG. */
export default async function OG({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  let ovr = 0;
  let surname = username.replace(/^@/, "").toUpperCase();
  let role = "";
  let tier = "bronze";
  let blurb = "your GitHub, as a cricket card";
  let twinLine = "";
  let stats: Record<string, number> = {};

  try {
    const clean = username.replace(/^@/, "");
    const card = buildUserCard(await fetchSignals(clean));
    ovr = card.ovr;
    surname = card.login.toUpperCase();
    role = ROLE_LABEL[card.role] ?? card.role.toUpperCase();
    tier = card.tier;
    blurb = card.archetype.blurb;
    stats = card.stats;
    const twins = pickTwins(card.ovr, card.login, PLAYER_INDEX);
    const t = twins.odi ?? twins.test ?? twins.t20i ?? twins.ipl;
    if (t) twinLine = `plays like ${t.name}`;
  } catch {
    /* fall back to a minimal card */
  }

  const f = TIERS[tier] ?? TIERS.bronze;
  const CARD_W = 348;
  const CARD_H = 528;
  const LEFT = ["BAT", "BWL", "FLD"];
  const RIGHT = ["POW", "ECO", "IMP"];

  const StatCol = (keys: string[]) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {keys.map((k) => (
        <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 21 }}>
          <span style={{ fontWeight: 700, width: 34, textAlign: "right" }}>{stats[k] ?? "—"}</span>
          <span style={{ color: MUTED }}>{k}</span>
        </div>
      ))}
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BG, padding: 56, color: f.ink, fontFamily: "sans-serif" }}>
        {/* the crest — smooth SVG silhouette with the tier finish + rim + frame */}
        <div style={{ position: "relative", width: CARD_W, height: CARD_H, display: "flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shieldDataUri(f)} width={CARD_W} height={CARD_H} alt="" style={{ position: "absolute", top: 0, left: 0 }} />
          {/* content overlay */}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "30px 30px 78px" }}>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 0.86 }}>
              <span style={{ fontSize: 84, fontWeight: 800 }}>{ovr || "—"}</span>
              <span style={{ fontSize: 17, letterSpacing: 3, color: MUTED }}>{role}</span>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", justifyContent: "center", borderTop: `1px solid ${f.ink}28`, paddingTop: 12 }}>
              <span style={{ fontSize: 42, fontWeight: 800, letterSpacing: 1 }}>{surname}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 40, marginTop: 16 }}>
              {StatCol(LEFT)}
              {StatCol(RIGHT)}
            </div>
          </div>
        </div>

        {/* right rail */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 60, flex: 1 }}>
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: 1, color: INK }}>
            Git<span style={{ color: TRIM }}>Cric</span>
          </span>
          <span style={{ fontSize: 44, fontWeight: 700, marginTop: 20, lineHeight: 1.05, color: INK }}>@{surname.toLowerCase()}</span>
          <span style={{ fontSize: 26, color: MUTED, marginTop: 16, maxWidth: 540 }}>“{blurb}”</span>
          {twinLine && <span style={{ fontSize: 30, fontWeight: 700, color: TRIM, marginTop: 28 }}>{twinLine}</span>}
        </div>
      </div>
    ),
    size,
  );
}
