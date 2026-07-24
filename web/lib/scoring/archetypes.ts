import type { Archetype, Role, Stats, Trait } from "./types";

/**
 * Cricket-vernacular archetypes, derived per (player, FORMAT) card from that
 * format's six stats + role. Nothing here short-circuits on OVR alone: the apex
 * archetypes demand a stat SHAPE (and use OVR only as one more term), which is
 * what makes a player's Test card and IPL card read differently when their
 * numbers differ. The commentary is a scout/commentator's voice, not a spec
 * sheet — "clears the ropes at will" beats "high POW". Kept fair for low tiers.
 *
 * ── THE BOWLING GUARDRAIL ──────────────────────────────────────────────────
 * We have NO pace-vs-spin data. The six axes say how well someone bowls, never
 * how. So no bowling copy may assert a delivery type: no pace, seam, swing,
 * spin, deck, bouncers, yorkers, googlies. (This is a real bug we shipped —
 * Sandeep Lamichhane, a leg-spinner, was described as hitting "the deck at
 * pace".) Bowlers are written in terms we can actually defend: wickets,
 * pressure, economy, control, big moments. scripts/copy-check.ts enforces the
 * banned lexicon over every string in this file, so a future edit can't
 * quietly reintroduce it.
 */

const T = (label: string, note: string): Trait => ({ label, note });

interface Rule {
  key: string;
  name: string;
  blurb: string;
  traits: Trait[];
  /** First rule whose predicate passes wins; the last rule in each list is a
   *  catch-all and must always return true. */
  when: (s: Stats, ovr: number) => boolean;
}

const spread = (s: Stats): number => {
  const v = Object.values(s);
  return Math.max(...v) - Math.min(...v);
};
const leadAxis = (s: Stats): keyof Stats =>
  (["BAT", "POW", "BWL", "ECO", "FLD", "IMP"] as const).reduce((a, b) => (s[b] > s[a] ? b : a));

// ── batters ─────────────────────────────────────────────────────────────────
const BATTER: Rule[] = [
  {
    key: "maestro",
    name: "The Maestro",
    blurb: "a generational batter — bowlers plan their week around him",
    traits: [
      T("Bowlers plan for him", "the whole innings is shaped by getting him out"),
      T("Runs in every condition", "no weakness to bowl at, home or away"),
    ],
    when: (s, ovr) => ovr >= 93 && s.BAT >= 92 && s.IMP >= 90,
  },
  {
    key: "wall",
    name: "The Wall",
    blurb: "gets in line and stays there — you have to blast him out",
    traits: [
      T("Bats time", "occupies the crease and makes the bowlers come to him"),
      T("Leaves beautifully", "a wall outside off — patient to a fault"),
    ],
    when: (s) => s.BAT >= 76 && s.BAT - s.POW >= 16,
  },
  {
    key: "finisher",
    name: "The Finisher",
    blurb: "walks in at the death and clears the ropes at will",
    traits: [
      T("Closes the chase", "does the arithmetic and takes it deep"),
      T("Clears the ropes", "changes gears the moment he arrives"),
    ],
    when: (s) => s.POW - s.BAT >= 8 && s.IMP >= 68,
  },
  {
    key: "enforcer",
    name: "The Enforcer",
    blurb: "takes the game away in a session — dominance is the plan",
    traits: [
      T("Puts bowlers off their length", "the field goes back inside two overs"),
      T("Scores at a lick", "the rate never stalls while he is in"),
    ],
    when: (s) => s.POW >= 80 && s.POW >= s.BAT,
  },
  {
    key: "aggressor",
    name: "Top-Order Aggressor",
    blurb: "takes the attack apart inside the powerplay",
    traits: [
      T("Sets the tempo", "the innings moves at his speed from ball one"),
      T("Punishes anything loose", "no free deliveries survive"),
    ],
    when: (s) => s.BAT >= 78 && s.POW >= s.BAT - 4,
  },
  {
    key: "accumulator",
    name: "The Accumulator",
    blurb: "bats time, turns ones into twos, and the score never stops moving",
    traits: [
      T("Never in a hurry", "builds without ever looking rushed"),
      T("Rotates the strike", "the scoreboard ticks even on a quiet day"),
    ],
    when: (s) => s.BAT >= 76 && s.IMP >= 68,
  },
  {
    key: "anchor",
    name: "The Anchor",
    blurb: "walks in at four, ice in the veins, bats through the innings",
    traits: [
      T("Bats through", "still there at the end, whatever happened at the start"),
      T("Ice in the veins", "the harder the situation, the calmer he looks"),
    ],
    when: (s) => leadAxis(s) === "BAT" && s.IMP >= s.POW,
  },
  {
    key: "livewire",
    name: "The Livewire",
    blurb: "electric in the field — saves twenty a game and runs you out from nowhere",
    traits: [
      T("Saves twenty a game", "turns twos into ones all afternoon"),
      T("Runs you out from nowhere", "one moment of brilliance changes a game"),
    ],
    when: (s) => leadAxis(s) === "FLD",
  },
  {
    key: "veteran",
    name: "The Veteran",
    blurb: "seen it all, been everywhere — value the dressing room can't measure",
    traits: [
      T("Seen every situation", "nothing in the game is new to him"),
      T("Sets the standard", "the young players watch how he prepares"),
    ],
    when: (s) => leadAxis(s) === "IMP",
  },
  {
    key: "grafter",
    name: "The Grafter",
    blurb: "no frills, plenty of grit — bats time and wears the bowlers down",
    traits: [
      T("Plenty of grit", "sells his wicket dearly, every single time"),
      T("Wears bowlers down", "the runs are never pretty, but they count"),
    ],
    when: () => true,
  },
];

// ── bowlers (delivery-type-neutral copy ONLY — see the guardrail above) ──────
const BOWLER: Rule[] = [
  {
    key: "spearhead",
    name: "The Spearhead",
    blurb: "the strike bowler — when a wicket has to fall, he is thrown the ball",
    traits: [
      T("The captain's first call", "opens the bowling in every plan that matters"),
      T("Breaks partnerships", "one spell can settle the whole contest"),
    ],
    // Calibrated against the DB: tighter than this and the marquee bowling
    // archetype fires for ~3 cards in 2,700 (Murali, McGrath, Malinga) while
    // every other elite bowler collapses into one label.
    when: (s, ovr) => ovr >= 90 && s.BWL >= 88 && s.IMP >= 80,
  },
  {
    key: "magician",
    name: "The Magician",
    blurb: "conjures a wicket from nothing when the game has gone flat",
    traits: [
      T("Makes something happen", "produces a wicket when there is nothing on offer"),
      T("Unreadable", "batters play him off the pitch, never off the hand"),
    ],
    when: (s) => s.BWL >= 86 && s.IMP >= 78,
  },
  {
    key: "closer",
    name: "The Closer",
    blurb: "hand him the ball with the game on the line and he finds a way",
    traits: [
      T("Bowls the last over", "the pressure end belongs to him"),
      T("Holds his nerve", "the plan does not wobble when the crowd is up"),
    ],
    when: (s) => s.IMP >= 80 && s.IMP >= s.BWL,
  },
  {
    key: "miser",
    name: "The Miser",
    blurb: "dot, dot, dot — the pressure has to break somewhere",
    traits: [
      T("You cannot get him away", "the boundary balls simply never come"),
      T("Builds the pressure", "wickets fall at the other end because of him"),
    ],
    when: (s) => s.ECO >= 84 && s.ECO >= s.BWL,
  },
  {
    key: "strangler",
    name: "Miserly Strike Bowler",
    blurb: "chokes the run rate, then takes the big wicket",
    traits: [
      T("Squeezes and strikes", "control at one end, wickets at the same time"),
      T("Both jobs at once", "saves runs without ever going defensive"),
    ],
    when: (s) => s.ECO >= 76 && s.BWL >= 76,
  },
  {
    key: "wicket-taker",
    name: "The Wicket-Taker",
    blurb: "bowls to take wickets, not to save runs — always at the stumps",
    traits: [
      T("Always attacking", "buys wickets and accepts the odd boundary"),
      T("At the stumps", "makes the batter play, ball after ball"),
    ],
    when: (s) => leadAxis(s) === "BWL" && s.BWL >= 76,
  },
  {
    key: "workhorse",
    name: "The Workhorse",
    blurb: "bowls the tough overs into the wind and never complains",
    traits: [
      T("Bowls the hard overs", "takes the end nobody else wants"),
      T("Never complains", "the captain can always get one more over out of him"),
    ],
    when: () => true,
  },
];

// ── all-rounders ────────────────────────────────────────────────────────────
const ALLROUNDER: Rule[] = [
  {
    key: "talisman",
    name: "The Talisman",
    blurb: "wins games with bat and ball — the first name on the team sheet",
    traits: [
      T("First name on the sheet", "picks himself in any XI, in any format"),
      T("Two ways to win", "if one discipline goes quiet, the other delivers"),
    ],
    // The genuine two-way greats (Kallis, Flintoff) top out at OVR 93 with one
    // discipline in the high 70s — an OVR 92 / 78-78 bar never fires at all.
    when: (s, ovr) => ovr >= 88 && s.BAT >= 76 && s.BWL >= 76,
  },
  {
    key: "matchwinner",
    name: "The Matchwinner",
    blurb: "a genuine two-in-one — bails you out with bat or ball",
    traits: [
      T("Genuine two-in-one", "worth his place for either discipline alone"),
      T("Bails the side out", "the game turns whenever he is involved"),
    ],
    when: (s) => s.BAT >= 76 && s.BWL >= 76,
  },
  {
    key: "batting-allrounder",
    name: "The Batting All-Rounder",
    blurb: "bats in the top order and gets you a useful spell besides",
    traits: [
      T("Top-order runs first", "picked for the bat, valued for the rest"),
      T("A useful spell", "breaks up an innings and gives the frontline a rest"),
    ],
    when: (s) => s.BAT - s.BWL >= 10,
  },
  {
    key: "bowling-allrounder",
    name: "The Bowling All-Rounder",
    blurb: "frontline with the ball, and the runs are a real bonus",
    traits: [
      T("Frontline with the ball", "in the attack on merit, not as a filler"),
      T("Runs down the order", "turns a collapse into a total"),
    ],
    when: (s) => s.BWL - s.BAT >= 10,
  },
  {
    key: "utility",
    name: "The Utility Player",
    blurb: "does a bit of everything and never lets the side down",
    traits: [
      T("Does a bit of everything", "fills whatever hole the XI has that week"),
      T("Never lets you down", "no weakness to hide in the field or the order"),
    ],
    when: (s) => spread(s) < 14,
  },
  {
    key: "allrounder",
    name: "The All-Rounder",
    blurb: "bats in the top order and turns his arm over when it matters",
    traits: [
      T("Contributes both ways", "chips in with bat and ball every week"),
      T("Balances the XI", "lets the side play an extra specialist"),
    ],
    when: () => true,
  },
];

// ── keepers ─────────────────────────────────────────────────────────────────
const KEEPER: Rule[] = [
  {
    key: "complete-keeper",
    name: "The Complete Keeper",
    blurb: "keeps all day, then bats like a specialist — two players in one",
    traits: [
      T("Two players in one", "a specialist bat who happens to keep"),
      T("All day behind the stumps", "the concentration never dips"),
    ],
    when: (s, ovr) => ovr >= 91 && s.BAT >= 86,
  },
  {
    key: "keeper-finisher",
    name: "The Keeper-Finisher",
    blurb: "gloves off, pads on — the last five overs belong to him",
    traits: [
      T("The last five are his", "walks in with the rate up and calms it down"),
      T("Clears the ropes", "finds the boundary from the first ball he faces"),
    ],
    when: (s) => s.POW - s.BAT >= 8 && s.IMP >= 68,
  },
  // NB: batting discriminates BEFORE fielding here. A keeper's FLD is high by
  // construction (median 94 — the axis counts their dismissals), so leading with
  // FLD>=82 labelled 188 of 190 keeper cards "The Gloveman". What actually
  // separates keepers is what they do with the bat.
  {
    key: "keeper-batter",
    name: "The Keeper-Batter",
    blurb: "bats like a top-order player and never puts the gloves down",
    traits: [
      T("Bats in the top order", "picked for runs as much as for the gloves"),
      T("Keeps every ball", "the tidiest job on the field, done quietly"),
    ],
    when: (s) => s.BAT >= 76,
  },
  {
    key: "gloveman",
    name: "The Gloveman",
    blurb: "lightning behind the stumps — a half-chance is a chance",
    traits: [
      T("A half-chance is a chance", "takes what nobody else would reach"),
      T("Never misses one", "clean hands for every ball of the innings"),
    ],
    when: (s) => s.FLD >= 82,
  },
  {
    key: "custodian",
    name: "The Custodian",
    blurb: "quiet, tidy, and never lets the side down",
    traits: [
      T("Tidy and quiet", "you only notice a keeper when they err — you never do"),
      T("Runs the field", "the best view on the ground, and he uses it"),
    ],
    when: () => true,
  },
];

const BY_ROLE: Record<Role, Rule[]> = {
  batter: BATTER,
  bowler: BOWLER,
  allrounder: ALLROUNDER,
  keeper: KEEPER,
};

/** Every archetype in the pool — for scripts/copy-check.ts and calibration. */
export const ALL_RULES: Record<Role, Rule[]> = BY_ROLE;

/**
 * The archetype for ONE format's card. `stats`/`ovr` must be that format's own,
 * so a player's Test and IPL cards are free to disagree.
 */
export function archetypeFor(st: Stats, role: Role, ovr: number): Archetype {
  const rule = BY_ROLE[role].find((r) => r.when(st, ovr)) ?? BY_ROLE[role][BY_ROLE[role].length - 1];
  return { key: rule.key, name: rule.name, blurb: rule.blurb, traits: rule.traits };
}
