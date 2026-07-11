import type { CSSProperties } from "react";
import type { CardFace } from "../lib/view";
import { STAT_FULL } from "../lib/view";
import { Flag } from "../lib/flags";

/**
 * THE CARD — the jewel. Keeps FUT's layout grammar (big OVR top-left, role,
 * surname banner, six stats in two columns) with an ORIGINAL clipped-corner
 * silhouette + trim spine. Cricketers wear a team COLORWAY (colours only, no
 * crests) with a tier BADGE; the YOU card keeps its tier finish. Flag + face are
 * FUT identity cues.
 */
const LEFT = ["BAT", "BWL", "FLD"] as const;
const RIGHT = ["POW", "ECO", "IMP"] as const;
const TIER_LABEL: Record<string, string> = { bronze: "BRONZE", silver: "SILVER", gold: "GOLD", immortal: "IMMORTAL" };
const TIER_COLOR: Record<string, string> = { bronze: "#b06a3a", silver: "#b9c0c9", gold: "#e6b23c", immortal: "#7be3ff" };

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
  // style wins over the data-tier/data-trim CSS). YOU: leave the finish.
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
    <div className="gc-card" data-tier={face.tier} data-trim={face.trim} style={cwStyle} id={captureId}>
      <div className="gc-card-inner">
        <div className="gc-card-top">
          <div className="gc-ovr-block">
            <span className="gc-ovr tabular">{face.ovr}</span>
            <span className="gc-role">{face.roleLabel}</span>
            <div className="gc-idrow">
              {face.flag && <Flag code={face.flag} className="gc-flag" />}
              {face.colorway && (
                <span className="gc-tier-badge tabular" style={{ color: TIER_COLOR[face.tier] }}>
                  {TIER_LABEL[face.tier]}
                </span>
              )}
            </div>
          </div>
          <span className="gc-eyebrow">{face.eyebrow}</span>
        </div>

        <div className="gc-portrait" aria-hidden>
          {portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt="" className="gc-avatar" crossOrigin="anonymous" />
          ) : (
            <span className="gc-monogram tabular">{monogram}</span>
          )}
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
