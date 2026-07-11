/**
 * Runtime data layer. Reads the committed JSON artifacts (built from gitcric.db
 * by scripts/export-data.ts) so nothing native ships to the runtime and the app
 * is self-contained — web/ can be the deploy root. Types are declared here (a
 * structural mirror of the pipeline's PlayerCardData) rather than imported from
 * ../../src, so the build never reaches outside web/.
 */
import indexJson from "../gen/players.index.json";
import cardsJson from "../gen/cards.json";

export type FormatBucket = "test" | "odi" | "t20i" | "ipl";
export type Role = "batter" | "bowler" | "allrounder" | "keeper";
export type StatKey = "BAT" | "POW" | "BWL" | "ECO" | "FLD" | "IMP";
export type CardStats = Record<StatKey, number>;

export interface IndexRow {
  id: string;
  name: string;
  ovr: number;
  role: Role;
  stats: CardStats;
  matches: number;
  totalMatches: number;
  intlCaps: number;
  gformats: number;
  isAnchor: boolean;
}

interface MetricCalib {
  raw: number;
  shrunk: number;
  percentile: number;
  sampleBalls: number;
}

/** The full cricketer card — powers a twin's card face + side panels. */
export interface CricketerCard {
  playerId: string;
  name: string;
  gender: string;
  formatBucket: FormatBucket;
  stats: CardStats;
  role: Role;
  ovr: number;
  bands: { peakOvr: number; greatnessBonus: number; longevityZ: number; peakElitenessZ: number };
  metrics: {
    battingAvg: MetricCalib;
    battingSR: MetricCalib;
    bowlingSR: MetricCalib;
    economy: MetricCalib;
    fielding: MetricCalib;
    impact: MetricCalib;
  };
  sampleSizes: { battingBalls: number; bowlingBalls: number; matches: number };
  career: {
    matches: number;
    spanYears: number;
    firstDate: string;
    lastDate: string;
    fifties: number;
    hundreds: number;
    fourFers: number;
    fiveFers: number;
  };
  equatedLegend: { id: string; name: string; distance: number; source: string } | null;
}

export const PLAYER_INDEX = indexJson as Record<FormatBucket, IndexRow[]>;
const CARDS = cardsJson as Record<string, CricketerCard>;

/** Full card for a (bucket, playerId), or null. */
export function getCricketerCard(bucket: FormatBucket, id: string): CricketerCard | null {
  return CARDS[`${bucket}:${id}`] ?? null;
}
