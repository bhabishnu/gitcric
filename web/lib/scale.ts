/**
 * Presentation primitives shared by the CLIENT card components — the stat
 * labels and the 40..99 axis math.
 *
 * These live here, apart from view.ts, for a bundling reason rather than a
 * tidiness one. view.ts evaluates the cricketer index at module scope (to rank
 * a user against the real population), so anything importing a VALUE from it
 * drags gen/players.index.json into whatever bundle it lands in. PlayerCard and
 * panels are rendered by a "use client" component, so importing STAT_FULL /
 * ovrToPercentile from view.ts put 660 KB of cricketer data in the browser.
 *
 * Nothing in this file may import from ./data, ./view, or anything that reaches
 * gen/*.json. Keep it dependency-free apart from types.
 */
import type { StatKey } from "./scoring/types";

export const STAT_ORDER: StatKey[] = ["BAT", "POW", "BWL", "ECO", "FLD", "IMP"];

export const STAT_LABEL: Record<StatKey, string> = {
  BAT: "BAT", POW: "POW", BWL: "BWL", ECO: "ECO", FLD: "FLD", IMP: "IMP",
};

export const STAT_FULL: Record<StatKey, string> = {
  BAT: "Batting", POW: "Power", BWL: "Bowling", ECO: "Economy", FLD: "Fielding", IMP: "Impact",
};

/** Marker POSITION on the 40..99 axis. Not a population statistic — the YOU
 *  card's "Nth percentile" label is computed server-side against the real
 *  cricketer distribution and arrives on the Segment as a plain number. */
export function ovrToPercentile(ovr: number): number {
  return Math.max(0, Math.min(100, Math.round(((ovr - 40) / (99 - 40)) * 100)));
}
