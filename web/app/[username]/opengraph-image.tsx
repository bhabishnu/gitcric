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
const PANEL = "#111113";
const INK = "#edeef0";
const MUTED = "#8a8f98";

/** The card on the graphite background — the shareable OG. */
export default async function OG({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  let ovr = 0;
  let surname = username.replace(/^@/, "").toUpperCase();
  let role = "";
  let blurb = "your GitHub, as a cricket card";
  let twinLine = "";
  let stats: [string, number][] = [];

  try {
    const clean = username.replace(/^@/, "");
    const card = buildUserCard(await fetchSignals(clean));
    ovr = card.ovr;
    surname = card.login.toUpperCase();
    role = card.role.toUpperCase();
    blurb = card.archetype.blurb;
    stats = (["BAT", "POW", "BWL", "ECO", "FLD", "IMP"] as const).map((k) => [k, card.stats[k]]);
    const twins = pickTwins(card.ovr, clean, PLAYER_INDEX);
    const t = twins.odi ?? twins.test ?? twins.t20i ?? twins.ipl;
    if (t) twinLine = `plays like ${t.name}`;
  } catch {
    /* fall back to a minimal card */
  }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BG, padding: 64, color: INK, fontFamily: "sans-serif" }}>
        {/* the card */}
        <div
          style={{
            width: 340,
            height: 480,
            background: PANEL,
            border: `1px solid rgba(255,255,255,0.14)`,
            borderLeft: `4px solid ${TRIM}`,
            padding: 28,
            display: "flex",
            flexDirection: "column",
            clipPath: "polygon(0 0, 88% 0, 100% 8%, 100% 100%, 0 100%)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 92, fontWeight: 800, lineHeight: 0.9 }}>{ovr || "—"}</span>
            <span style={{ fontSize: 18, letterSpacing: 4, color: MUTED }}>{role}</span>
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 46, fontWeight: 800, letterSpacing: 1 }}>{surname}</span>
          <div style={{ display: "flex", flexWrap: "wrap", marginTop: 14, gap: "8px 24px" }}>
            {stats.map(([k, v]) => (
              <div key={k} style={{ display: "flex", width: 120, gap: 8, fontSize: 22 }}>
                <span style={{ fontWeight: 700 }}>{v}</span>
                <span style={{ color: MUTED }}>{k}</span>
              </div>
            ))}
          </div>
        </div>

        {/* right rail */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 64, flex: 1 }}>
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: 1 }}>
            Git<span style={{ color: TRIM }}>Cric</span>
          </span>
          <span style={{ fontSize: 44, fontWeight: 700, marginTop: 20, lineHeight: 1.05 }}>@{surname.toLowerCase()}</span>
          <span style={{ fontSize: 26, color: MUTED, marginTop: 16, maxWidth: 560 }}>“{blurb}”</span>
          {twinLine && <span style={{ fontSize: 30, fontWeight: 700, color: TRIM, marginTop: 28 }}>{twinLine}</span>}
        </div>
      </div>
    ),
    size,
  );
}
