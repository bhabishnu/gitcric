/**
 * C7 — flags. The artwork is a real asset set (flag-icons v7, MIT, 4x3), baked
 * into flags.data.ts by scripts/gen-flags.ts; the hand-drawn approximations this
 * replaced were wrong often enough to be a bug (Nepal rendered as a red block,
 * i.e. Morocco).
 *
 * This module is CLIENT-SAFE and deliberately holds no data. The asset table is
 * ~200 kB across 61 flags and used to ride into the browser through
 * CardExperience; it is now resolved on the SERVER in lib/view.ts and only the
 * chosen flag travels with the card face. Same single render path — one inline
 * <svg> — just fed by prop instead of by client-side lookup, so nothing is
 * fetched at paint time and html-to-image can still serialise the card from the
 * DOM alone.
 *
 * Resolution (nation → code, GitHub location → code) lives in lib/geo/location.ts,
 * which must never be imported from a client component.
 */
import type { FlagAsset } from "./flags.data";

export type FlagCode =
  // cricketing nations — reached from a cricketer's derived nation
  | "IN" | "AU" | "EN" | "PK" | "ZA" | "WI" | "NZ" | "LK" | "BD" | "ZW" | "IE" | "AF"
  | "SC" | "NL" | "NA" | "NP" | "AE" | "OM" | "US" | "CA" | "PG" | "KE"
  // everywhere else — only ever reached from a GitHub profile location
  | "DE" | "FR" | "BR" | "JP" | "CN" | "RU" | "ES" | "IT" | "PL" | "SE" | "NO"
  | "DK" | "FI" | "CH" | "AT" | "BE" | "PT" | "TR" | "UA" | "IL" | "SG" | "KR"
  | "MX" | "AR" | "ID" | "PH" | "VN" | "TH" | "MY" | "NG" | "EG" | "GR" | "CZ"
  | "RO" | "HU" | "TW" | "HK" | "CO" | "CL" | "GB";

/**
 * A flag at its TRUE proportions. Every asset is drawn with `meet` (never
 * `slice`/stretch) inside its own box, so nothing is cropped or distorted —
 * which is the whole point of Nepal, whose asset box is the pennant's real
 * ~377:480 shape rather than a 4:3 rectangle. The card gives the element a
 * neutral plate to sit on, so a non-rectangular flag reads as itself instead of
 * as a mystery gap.
 */
export function Flag({ asset, className }: { asset: FlagAsset | null; className?: string }) {
  if (!asset) return null;
  return (
    <svg
      viewBox={asset.viewBox}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${asset.name} flag`}
      // The asset markup is generated at build time from a vendored library —
      // never user input.
      dangerouslySetInnerHTML={{ __html: asset.inner }}
    />
  );
}
