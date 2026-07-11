import type { Archetype, Role, Stats } from "./types";

/**
 * Cricket-vernacular archetypes, keyed off the card's shape. The commentary
 * one-liner is the voice of a scout/commentator, not a spec sheet — "clears the
 * ropes at will" beats "high POW". Kept fair for lower tiers.
 */
const A = (key: string, name: string, blurb: string): Archetype => ({ key, name, blurb });

export function archetypeFor(st: Stats, role: Role, ovr: number): Archetype {
  const top = [...(["BAT", "POW", "BWL", "ECO", "FLD", "IMP"] as const)].sort((a, b) => st[b] - st[a]);
  const lead = top[0];
  const second = top[1];
  const peak = st[lead];
  const has = (a: keyof Stats, b: keyof Stats) => [top[0], top[1]].includes(a) && [top[0], top[1]].includes(b);

  if (ovr >= 91) {
    if (role === "bowler") return A("spearhead", "The Spearhead", "hits the deck at pace — you simply cannot score off him");
    if (role === "allrounder") return A("talisman", "The Talisman", "wins games with bat and ball — the first name on the team sheet");
    return A("maestro", "The Maestro", "a generational batter — bowlers plan their week around him");
  }

  if (role === "bowler") {
    if (has("ECO", "BWL")) return A("miser-strike", "Miserly Strike Bowler", "chokes the run rate then takes the big wicket");
    if (lead === "ECO") return A("metronome", "The Metronome", "dot after dot after dot — you simply cannot score off him");
    if (lead === "BWL") return A("enforcer", "The Enforcer", "bowls to take wickets, not to save runs — always attacking the stumps");
    return A("workhorse-ball", "The Workhorse", "bowls the tough overs into the wind and never complains");
  }

  if (role === "allrounder") {
    if (peak - st[top[5]] < 12) return A("utility", "The Utility Player", "does a bit of everything and never lets the side down");
    if (has("POW", "BWL")) return A("matchwinner", "The Matchwinner", "a genuine two-in-one — bails you out with bat or ball");
    return A("allrounder", "The All-Rounder", "bats in the top order and turns his arm over when it matters");
  }

  // batting shapes
  if (lead === "POW" && st.POW - st.BAT > 8) return A("finisher", "The Finisher", "walks in at the death and clears the ropes at will");
  if (has("BAT", "POW")) return A("aggressor", "Top-Order Aggressor", "takes the attack apart inside the powerplay");
  if (lead === "BAT" && st.IMP >= st.POW) return A("anchor", "The Anchor", "walks in at four, ice in the veins, bats through the innings");
  if (lead === "FLD") return A("livewire", "The Livewire", "electric in the field — saves twenty runs a game and runs you out from nowhere");
  if (lead === "IMP") return A("veteran", "The Veteran", "seen it all, been everywhere — value the dressing room can't measure");
  return A("grafter", "The Grafter", "no frills, plenty of grit — bats time and wears the bowlers down");
}
