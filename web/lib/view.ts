/**
 * View model. Normalises the YOU card (from GitHub) and the four cricketer twins
 * into five uniform `Segment`s the client just swaps between — so all data
 * shaping stays on the server. Segment 0 is always YOU.
 */
import { archetypeFor } from "./scoring/archetypes";
import type { Archetype, Trait, UserCard, StatKey, Tier } from "./scoring/types";
import type { CricketerCard, IndexRow, Role } from "./data";
import { getCricketerCard, photoFor, type FormatBucket } from "./data";
import type { Twin } from "./match/matcher";
import { colorwayFor, type Colorway } from "./colorways";
import { flagForLocation, flagForNation, type FlagCode } from "./flags";

export type SegmentId = "you" | FormatBucket;

export const STAT_ORDER: StatKey[] = ["BAT", "POW", "BWL", "ECO", "FLD", "IMP"];
export const STAT_LABEL: Record<StatKey, string> = {
  BAT: "BAT", POW: "POW", BWL: "BWL", ECO: "ECO", FLD: "FLD", IMP: "IMP",
};
export const STAT_FULL: Record<StatKey, string> = {
  BAT: "Batting", POW: "Power", BWL: "Bowling", ECO: "Economy", FLD: "Fielding", IMP: "Impact",
};
const ROLE_LABEL: Record<Role, string> = {
  batter: "BATTER", bowler: "BOWLER", allrounder: "ALL-ROUNDER", keeper: "WK-BATTER",
};

export interface CardFace {
  surname: string;
  fullName: string;
  ovr: number;
  roleLabel: string;
  eyebrow: string;
  stats: { key: StatKey; label: string; value: number }[];
  tier: Tier;
  trim: SegmentId;
  /** Team colorway for a cricketer; null on the YOU card (keeps its tier finish). */
  colorway: Colorway | null;
  flag: FlagCode | null;
  /** Cricketer face path, or null → monogram. YOU uses avatarUrl instead. */
  photoFile: string | null;
  /** Franchise name — IPL cards only (colorways are ambiguous: RCB vs PBKS red).
   *  Null on nation cards (the flag already names the country) and YOU. */
  teamLabel: string | null;
}

export type { Trait } from "./scoring/types";

export interface ScoutMetric {
  label: string;
  value: string;
  fill: number;
  axis: StatKey;
}

export interface Segment {
  id: SegmentId;
  tabLabel: string;
  card: CardFace;
  /** `sub` is the "TEST · 168 matches" line; `tierLabel` is appended to it in the
   *  page header — the card face itself names neither format, matches nor tier. */
  header: { handle: string | null; sub: string | null; tierLabel: string; commentary: string };
  archetype: string;
  traits: Trait[];
  /** Right panel is a discriminated union: the scout report (YOU) or a
   *  cricketer's real career card. */
  right:
    | { kind: "scout"; metrics: ScoutMetric[]; percentile: number }
    | { kind: "career"; rows: { label: string; value: string }[]; distribution: number };
}

function tierFromOvr(ovr: number): Tier {
  if (ovr >= 91) return "immortal";
  if (ovr >= 84) return "gold";
  if (ovr >= 70) return "silver";
  return "bronze";
}

function cricketerEyebrow(ovr: number): string {
  if (ovr >= 91) return "LEGEND OF THE GAME";
  if (ovr >= 84) return "MATCH-WINNER";
  if (ovr >= 70) return "FIRST-CHOICE XI";
  return "IN THE MIX";
}

/** Surname banner: last token of the display name (the FUT grammar). */
function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1] || name).toUpperCase();
}

const statList = (stats: Record<StatKey, number>) =>
  STAT_ORDER.map((k) => ({ key: k, label: STAT_LABEL[k], value: stats[k] }));

/**
 * The archetype's own trait lines first (so two cards sharing a top axis but not
 * an archetype don't read identically), topped up from the strongest axes. Note
 * the stat lines stay delivery-type-neutral for the same reason the archetype
 * copy does — we know how well someone bowls, never how.
 */
function traitsFor(stats: Record<StatKey, number>, archetype: Archetype): Trait[] {
  const T: Record<StatKey, Trait> = {
    BAT: { label: "Runs in the book", note: "averages heavily, rarely gives it away" },
    POW: { label: "Clears the ropes", note: "changes gears and takes the game deep" },
    BWL: { label: "Strikes with the ball", note: "buys wickets, not just contains" },
    ECO: { label: "Miserly at the top", note: "hard to get away — dots build pressure" },
    FLD: { label: "Safe hands", note: "saves runs and holds the sharp chances" },
    IMP: { label: "Big-match temperament", note: "turns up when it matters most" },
  };
  const ranked = [...STAT_ORDER].sort((a, b) => stats[b] - stats[a]);
  const picks = ranked.slice(0, 3).filter((k) => stats[k] >= 55);
  const statTraits = (picks.length ? picks : ranked.slice(0, 2)).map((k) => T[k]);

  const out: Trait[] = [...archetype.traits];
  for (const t of statTraits) {
    if (out.length >= 4) break;
    if (!out.some((x) => x.label === t.label)) out.push(t);
  }
  return out.slice(0, 4);
}

function num(n: number, d = 1): string {
  if (!isFinite(n) || n === 0) return "—";
  return n.toFixed(d);
}

// ── YOU segment ──────────────────────────────────────────────────────────────
function youSegment(card: UserCard): Segment {
  return {
    id: "you",
    tabLabel: "YOU",
    card: {
      surname: surname(card.login),
      fullName: card.name,
      ovr: card.ovr,
      roleLabel: ROLE_LABEL[card.role],
      eyebrow: card.eyebrow,
      stats: statList(card.stats),
      tier: card.tier,
      trim: "you",
      colorway: null, // YOU keeps its tier finish
      flag: flagForLocation(card.location),
      photoFile: null,
      teamLabel: null,
    },
    header: {
      handle: `@${card.login}`,
      sub: card.topLanguage,
      tierLabel: card.tier.toUpperCase(),
      commentary: card.archetype.blurb,
    },
    archetype: card.archetype.name,
    traits: traitsFor(card.stats, card.archetype),
    right: {
      kind: "scout",
      metrics: card.scout.map((s) => ({ label: s.label, value: s.value, fill: s.fill, axis: s.axis })),
      percentile: card.baseOVR,
    },
  };
}

// ── cricketer twin segment ───────────────────────────────────────────────────
const BUCKET_LABEL: Record<FormatBucket, string> = { test: "TEST", odi: "ODI", t20i: "T20I", ipl: "IPL" };

function careerRows(c: CricketerCard, role: Role): { label: string; value: string }[] {
  const m = c.metrics;
  const rows: { label: string; value: string }[] = [
    { label: "Matches", value: `${c.career.matches}` },
    { label: "Span", value: c.career.spanYears >= 1 ? `${c.career.spanYears.toFixed(0)} yrs` : "—" },
  ];
  if (role !== "bowler") {
    rows.push({ label: "Bat avg", value: num(m.battingAvg.raw) });
    rows.push({ label: "Strike rate", value: num(m.battingSR.raw, 0) });
    rows.push({ label: "50s / 100s", value: `${c.career.fifties} / ${c.career.hundreds}` });
  }
  if (role === "bowler" || role === "allrounder") {
    rows.push({ label: "Bowl SR", value: num(m.bowlingSR.raw) });
    rows.push({ label: "Economy", value: num(m.economy.raw, 2) });
    rows.push({ label: "4w / 5w", value: `${c.career.fourFers} / ${c.career.fiveFers}` });
  }
  return rows;
}

function twinSegment(twin: Twin, card: CricketerCard): Segment {
  const role = twin.role;
  const colorway = colorwayFor(twin.bucket, twin.nation, twin.lastIplTeam);
  // Derived from THIS format's stats/OVR — a player's Test and IPL cards are
  // free to land on different archetypes, and do when the numbers differ.
  const tier = tierFromOvr(twin.ovr);
  const archetype = archetypeFor(twin.stats, role, twin.ovr);
  return {
    id: twin.bucket,
    tabLabel: BUCKET_LABEL[twin.bucket],
    card: {
      surname: surname(twin.name),
      fullName: twin.name,
      ovr: twin.ovr,
      roleLabel: ROLE_LABEL[role],
      eyebrow: cricketerEyebrow(twin.ovr),
      stats: statList(twin.stats),
      tier,
      trim: twin.bucket,
      colorway,
      flag: flagForNation(twin.nation),
      photoFile: photoFor(twin.id),
      // franchise caption on IPL only; nation cards let the flag do the naming
      teamLabel: twin.bucket === "ipl" ? colorway.label : null,
    },
    header: {
      handle: null,
      sub: `${BUCKET_LABEL[twin.bucket]} · ${card.career.matches} matches`,
      tierLabel: tier.toUpperCase(),
      commentary: archetype.blurb,
    },
    archetype: archetype.name,
    traits: traitsFor(twin.stats, archetype),
    right: {
      kind: "career",
      rows: careerRows(card, role),
      distribution: twin.ovr,
    },
  };
}

/** Build all five segments. YOU is always first. */
export function buildSegments(you: UserCard, twins: Record<FormatBucket, Twin | null>): Segment[] {
  const order: FormatBucket[] = ["test", "odi", "t20i", "ipl"];
  const segments: Segment[] = [youSegment(you)];
  for (const b of order) {
    const t = twins[b];
    if (!t) continue;
    const card = getCricketerCard(b, t.id);
    if (!card) continue;
    segments.push(twinSegment(t, card));
  }
  return segments;
}

/** Segments for a specific cricketer across every format they're gated in —
 *  powers the /player/[id] permalink (no YOU segment). */
export function buildPlayerSegments(id: string, index: Record<FormatBucket, IndexRow[]>): Segment[] {
  const order: FormatBucket[] = ["test", "odi", "t20i", "ipl"];
  const segments: Segment[] = [];
  for (const b of order) {
    const row = index[b].find((r) => r.id === id);
    if (!row) continue;
    const card = getCricketerCard(b, id);
    if (!card) continue;
    const twin: Twin = { ...row, bucket: b, ovrGap: 0 };
    segments.push(twinSegment(twin, card));
  }
  return segments;
}

export function ovrToPercentile(ovr: number): number {
  // A friendly read for the distribution bar: where the OVR sits on 40..99.
  return Math.max(0, Math.min(100, Math.round(((ovr - 40) / (99 - 40)) * 100)));
}
