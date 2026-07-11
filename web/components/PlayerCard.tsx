import type { CardFace } from "../lib/view";
import { STAT_FULL } from "../lib/view";

/**
 * THE CARD — the only saturated object in the product. Keeps FUT's layout
 * grammar (big OVR top-left, role, surname banner, six stats in two columns) but
 * an ORIGINAL silhouette: a portrait monolith with a single clipped top-right
 * corner and a vertical trim spine — explicitly not EA's shield. Tier finish +
 * per-format trim are driven by data attributes styled in globals.css.
 */

// FUT reads down columns; left {BAT,BWL,FLD}, right {POW,ECO,IMP}.
const LEFT = ["BAT", "BWL", "FLD"] as const;
const RIGHT = ["POW", "ECO", "IMP"] as const;

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

  return (
    <div className="gc-card" data-tier={face.tier} data-trim={face.trim} id={captureId}>
      <div className="gc-card-inner">
        {/* top row: OVR + role, eyebrow */}
        <div className="gc-card-top">
          <div className="gc-ovr-block">
            <span className="gc-ovr tabular">{face.ovr}</span>
            <span className="gc-role">{face.roleLabel}</span>
          </div>
          <span className="gc-eyebrow">{face.eyebrow}</span>
        </div>

        {/* portrait: avatar for YOU, monogram disc for a cricketer */}
        <div className="gc-portrait" aria-hidden>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="gc-avatar" crossOrigin="anonymous" />
          ) : (
            <span className="gc-monogram tabular">{monogram}</span>
          )}
        </div>

        {/* surname banner */}
        <div className="gc-namebar">
          <span className="gc-surname">{face.surname}</span>
        </div>

        {/* six stats, two columns */}
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
    </div>
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
