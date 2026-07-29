import type { CSSProperties } from "react";
import type { CardFace } from "../lib/view";
import { STAT_FULL } from "../lib/scale";
import { Flag } from "../lib/flags";

/**
 * THE CARD — the jewel. A die-cut CREST/SHIELD (our own geometry, not EA's):
 * near-flat top with sloped shoulders, straight sides, a soft point at the base.
 * The shield path is drawn as a layered SVG background (colorway gradient →
 * tone-on-tone filigree → inset frame) AND used as a
 * clip-path so nothing renders outside the crest. FUT layout grammar on top:
 * huge OVR, role and flag over a full-bleed portrait; a surname band (plus a
 * franchise caption on IPL); six stats in two tight columns. Format, matches and
 * tier are NOT on the face — they're named once, in the page header.
 */
const LEFT = ["BAT", "BWL", "FLD"] as const;
const RIGHT = ["POW", "ECO", "IMP"] as const;

// ── crest geometry (viewBox 540 × 820) ───────────────────────────────────────
// Near-flat top w/ sloped shoulders → straight sides → soft point at the base.
// One source of truth; the clip-path reuses it, normalised to 0..1.
const W = 540;
const H = 820;
const SHIELD =
  "M22 58 C22 26 28 20 60 16 C132 8 408 8 480 16 C512 20 518 26 518 58 " +
  "L518 486 C518 566 500 610 452 664 C398 726 318 766 270 808 " +
  "C222 766 142 726 88 664 C40 610 22 566 22 486 Z";

/** Normalise the path to the 0..1 objectBoundingBox space the clip-path uses.
 *  Every coordinate in SHIELD is a clean x,y pair, so alternating the divisor
 *  works across M / C / L commands (Z carries no numbers). */
function normPath(d: string): string {
  let i = 0;
  return d.replace(/-?\d+(?:\.\d+)?/g, (n) => (parseFloat(n) / (i++ % 2 === 0 ? W : H)).toFixed(5));
}
const SHIELD_NORM = normPath(SHIELD);
const CLIP_ID = "gc-shield-clip";

export function PlayerCard({
  face,
  avatarUrl,
  captureId,
}: {
  face: CardFace;
  avatarUrl?: string | null;
  captureId?: string;
}) {
  const byKey = Object.fromEntries(face.stats.map((s) => [s.key, s.value]));
  const monogram = face.surname.slice(0, 2);
  const portrait = face.photoFile ?? avatarUrl ?? null;

  // Cricketer: override the tier-finish vars with the team colorway (inline
  // style wins over the data-tier/data-trim CSS). YOU: keep the tier finish.
  const cwStyle: CSSProperties | undefined = face.colorway
    ? ({
        "--finish-a": face.colorway.bgA,
        "--finish-b": face.colorway.bgB,
        "--ink": face.colorway.ink,
        "--trim": face.colorway.trim,
        "--tier-line": face.colorway.trim,
      } as CSSProperties)
    : undefined;

  return (
    <div
      className="gc-card"
      data-tier={face.tier}
      data-trim={face.trim}
      style={cwStyle}
      id={captureId}
    >
      {/* layered crest background — gradient · filigree · frame */}
      <ShieldBg tier={face.tier} />

      {/* clip everything to the crest (belt-and-suspenders; the portrait mask
          already keeps the photo well inside the edge) */}
      <svg className="gc-clipdef" aria-hidden width="0" height="0">
        <defs>
          <clipPath id={CLIP_ID} clipPathUnits="objectBoundingBox">
            <path d={SHIELD_NORM} />
          </clipPath>
        </defs>
      </svg>

      <div className="gc-portrait" aria-hidden>
        {portrait ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portrait} alt="" className="gc-avatar" crossOrigin="anonymous" />
        ) : (
          <span className="gc-monogram tabular">{monogram}</span>
        )}
        {/* top-left scrim so the OVR/role/flag always read over a bright photo */}
        <span className="gc-scrim" aria-hidden />
      </div>

      {/* OVR + role + flag, stacked top-left over the portrait. Tier is NOT named
          here — it lives in the frame/finish and the page header line. */}
      <div className="gc-badges">
        <span className="gc-ovr tabular">{face.ovr}</span>
        <span className="gc-role">{face.roleLabel}</span>
        <div className="gc-idrow">
          {face.flag && <Flag asset={face.flag} className="gc-flag" />}
        </div>
      </div>

      <div className="gc-namebar">
        <span className="gc-surname">{face.surname}</span>
        {face.teamLabel && <span className="gc-team">{face.teamLabel}</span>}
      </div>

      <div className="gc-stats">
        <div className="gc-stat-col">
          {LEFT.map((k) => (
            <StatRow key={k} k={k} v={byKey[k]} />
          ))}
        </div>
        <div className="gc-stat-divider" aria-hidden />
        <div className="gc-stat-col">
          {RIGHT.map((k) => (
            <StatRow key={k} k={k} v={byKey[k]} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** The layered crest: gradient fill, tone-on-tone filigree, and the inset
 *  frame + outer rim that carry the tier/trim treatment. */
function ShieldBg({ tier }: { tier: string }) {
  return (
    <svg className="gc-shield" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="gc-fill" x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="var(--finish-a)" />
          <stop offset="0.62" stopColor="var(--finish-b)" />
          <stop offset="1" stopColor="var(--finish-a)" />
        </linearGradient>
        {/* fine argyle filigree — the 'fabric' of the card, tone-on-tone */}
        <pattern id="gc-fil" width="30" height="42" patternUnits="userSpaceOnUse" patternTransform="translate(0 0)">
          <path
            d="M15 0 L30 21 L15 42 L0 21 Z M15 12 L23 21 L15 30 L7 21 Z"
            fill="none"
            stroke="var(--finish-b)"
            strokeWidth="0.9"
            opacity="0.5"
          />
          <circle cx="15" cy="21" r="0.9" fill="var(--finish-b)" opacity="0.5" />
        </pattern>
        {/* soft top sheen to give the crest a domed, minted feel */}
        <radialGradient id="gc-sheen" cx="0.5" cy="0.12" r="0.9">
          <stop offset="0" stopColor="var(--ink)" stopOpacity="0.10" />
          <stop offset="0.5" stopColor="var(--ink)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <path d={SHIELD} fill="url(#gc-fill)" />
      <path d={SHIELD} fill="url(#gc-fil)" />
      <path d={SHIELD} fill="url(#gc-sheen)" />


      {/* inset frame line (trim) — follows the crest, ~11px in. Stroke is set
          inline (not via CSS class) so html-to-image inlines it into the PNG. */}
      <path
        className="gc-frame"
        d={SHIELD}
        fill="none"
        transform={`translate(${W / 2} ${H / 2}) scale(0.958) translate(${-W / 2} ${-H / 2})`}
        style={{ stroke: "color-mix(in srgb, var(--trim) 78%, transparent)", strokeWidth: 1.4 }}
      />
      {/* crisp outer rim carries the tier metal / team trim */}
      <path
        className="gc-rim"
        d={SHIELD}
        fill="none"
        data-tier={tier}
        style={{ stroke: "var(--tier-line)", strokeWidth: 2.4, opacity: 0.95 }}
      />
    </svg>
  );
}

function StatRow({ k, v }: { k: string; v: number }) {
  return (
    <div className="gc-stat" title={STAT_FULL[k as keyof typeof STAT_FULL]}>
      <span className="gc-stat-val tabular">{v}</span>
      <span className="gc-stat-key">{k}</span>
    </div>
  );
}
