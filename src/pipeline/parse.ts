import type { FormatBucket } from "../types/stats.js";

/** Per-player, per-match contribution deltas (all additive into the aggregate). */
export interface PlayerDelta {
  playerId: string;
  gender: string;
  date: string;

  matches: number;

  batInnings: number;
  runs: number;
  ballsFaced: number;
  dismissals: number;
  notOuts: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;

  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  fourFers: number;
  fiveFers: number;

  catches: number;
  stumpings: number;
  runOuts: number;
}

export interface MatchResult {
  bucket: FormatBucket;
  date: string;
  deltas: PlayerDelta[];
}

// Wicket kinds credited to the BOWLER.
const BOWLER_WICKET_KINDS = new Set([
  "bowled",
  "caught",
  "lbw",
  "stumped",
  "caught and bowled",
  "hit wicket",
]);

// Wicket kinds that do NOT dismiss the batter for average purposes.
const NON_DISMISSAL_KINDS = new Set(["retired hurt", "retired not out"]);

function blankDelta(playerId: string, gender: string, date: string): PlayerDelta {
  return {
    playerId,
    gender,
    date,
    matches: 0,
    batInnings: 0,
    runs: 0,
    ballsFaced: 0,
    dismissals: 0,
    notOuts: 0,
    fours: 0,
    sixes: 0,
    fifties: 0,
    hundreds: 0,
    ballsBowled: 0,
    runsConceded: 0,
    wickets: 0,
    fourFers: 0,
    fiveFers: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0,
  };
}

/**
 * Stage 2 — parse ONE match JSON and attribute every delivery to batter/bowler
 * IDs (via the match registry), tagged by the caller's format bucket. Returns
 * null when the match should be skipped (wrong gender). Handles gracefully:
 * missing ball-by-ball, super-overs, missing registry entries, multi-fielder
 * run-outs, retired-hurt, and players who only batted OR only bowled.
 */
export function parseMatch(raw: unknown, bucket: FormatBucket, gendersAllowed: string[]): MatchResult | null {
  const match = raw as any;
  const info = match?.info;
  if (!info) return null;

  const gender: string = info.gender ?? "male";
  if (!gendersAllowed.includes(gender)) return null;

  const date: string = Array.isArray(info.dates) && info.dates.length ? info.dates[0] : info.date ?? "";
  const registry: Record<string, string> = info.registry?.people ?? {};
  const resolve = (name: string | undefined): string | undefined => (name ? registry[name] : undefined);

  const byId = new Map<string, PlayerDelta>();
  const get = (id: string): PlayerDelta => {
    let d = byId.get(id);
    if (!d) {
      d = blankDelta(id, gender, date);
      byId.set(id, d);
    }
    return d;
  };

  // ── appearances (caps): everyone named in info.players ──
  const players: Record<string, string[]> = info.players ?? {};
  for (const names of Object.values(players)) {
    for (const name of names) {
      const id = resolve(name);
      if (id) get(id).matches = 1;
    }
  }

  // ── ball-by-ball ──
  const innings: any[] = Array.isArray(match.innings) ? match.innings : [];
  for (const inn of innings) {
    if (inn?.super_over) continue; // super-overs excluded from records
    const overs: any[] = Array.isArray(inn.overs) ? inn.overs : [];

    // per-innings scratch for milestones / not-outs / n-fers
    const batRuns = new Map<string, number>();
    const batBalls = new Map<string, number>();
    const dismissed = new Set<string>();
    const batted = new Set<string>();
    const bowlerWkts = new Map<string, number>();

    for (const over of overs) {
      const deliveries: any[] = Array.isArray(over?.deliveries) ? over.deliveries : [];
      for (const d of deliveries) {
        const batterId = resolve(d.batter);
        const bowlerId = resolve(d.bowler);
        const ex = d.extras ?? {};
        const wides = ex.wides ?? 0;
        const noballs = ex.noballs ?? 0;
        const byes = ex.byes ?? 0;
        const legbyes = ex.legbyes ?? 0;
        const isWide = wides > 0;
        const isNoball = noballs > 0;
        const batterRuns: number = d.runs?.batter ?? 0;

        // batting attribution (batter faces everything except wides)
        if (batterId) {
          const bd = get(batterId);
          batted.add(batterId);
          if (!isWide) {
            bd.ballsFaced += 1;
            batBalls.set(batterId, (batBalls.get(batterId) ?? 0) + 1);
          }
          bd.runs += batterRuns;
          batRuns.set(batterId, (batRuns.get(batterId) ?? 0) + batterRuns);
          if (batterRuns === 4) bd.fours += 1;
          else if (batterRuns === 6) bd.sixes += 1;
        }

        // bowling attribution (legal ball = not wide, not no-ball)
        if (bowlerId) {
          const bw = get(bowlerId);
          const legal = !isWide && !isNoball;
          if (legal) bw.ballsBowled += 1;
          // bowler charged runs off bat + wides + no-balls (NOT byes/legbyes/penalty)
          bw.runsConceded += batterRuns + wides + noballs;
        }

        // wickets
        const wkts: any[] = Array.isArray(d.wickets) ? d.wickets : [];
        for (const w of wkts) {
          const kind: string = w.kind ?? "";
          const outName: string | undefined = w.player_out;
          const outId = resolve(outName);

          if (bowlerId && BOWLER_WICKET_KINDS.has(kind)) {
            get(bowlerId).wickets += 1;
            bowlerWkts.set(bowlerId, (bowlerWkts.get(bowlerId) ?? 0) + 1);
          }
          if (outId && !NON_DISMISSAL_KINDS.has(kind)) dismissed.add(outId);

          // fielding credit
          const fielders: any[] = Array.isArray(w.fielders) ? w.fielders : [];
          if (kind === "caught and bowled") {
            if (bowlerId) get(bowlerId).catches += 1;
          } else if (kind === "caught") {
            for (const f of fielders) {
              const fid = resolve(f?.name);
              if (fid) get(fid).catches += 1;
            }
          } else if (kind === "stumped") {
            for (const f of fielders) {
              const fid = resolve(f?.name);
              if (fid) get(fid).stumpings += 1;
            }
          } else if (kind === "run out") {
            for (const f of fielders) {
              const fid = resolve(f?.name);
              if (fid) get(fid).runOuts += 1; // multi-fielder run-outs: each credited
            }
          }
        }
      }
    }

    // fold per-innings scratch into deltas
    for (const id of batted) {
      const d = get(id);
      const facedAny = (batBalls.get(id) ?? 0) > 0;
      if (!facedAny && !dismissed.has(id)) continue; // came in but no ball, not out → no innings
      d.batInnings += 1;
      if (dismissed.has(id)) d.dismissals += 1;
      else d.notOuts += 1;
      const r = batRuns.get(id) ?? 0;
      if (r >= 100) d.hundreds += 1;
      else if (r >= 50) d.fifties += 1;
    }
    for (const [id, w] of bowlerWkts) {
      const d = get(id);
      if (w >= 5) d.fiveFers += 1;
      else if (w >= 4) d.fourFers += 1;
    }
  }

  return { bucket, date, deltas: [...byId.values()] };
}
