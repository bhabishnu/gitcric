I'm building "GitCric" — a web app that turns a cricketer into a FIFA-Ultimate-Team-
style rating card, with a SEPARATE card per format (Test, ODI, T20I, and IPL). You
type a cricketer's name and get their per-format cards, each with an overall rating
out of 99 plus a "closest legend" comparison (e.g. an OVR-99 Test profile equates to
Don Bradman). It's inspired by github.com/Younesfdj/gitfut (MIT), which does exactly
this for GitHub profiles — READ its lib/scoring/engine.ts as the reference for the
two-band scoring math and card structure before you plan.

RIGHT NOW I ONLY WANT THE DATA PIPELINE: ingest Cricsheet and produce clean,
calibrated, per-player, per-format stats + a reference overall + a nearest-legend
match, written to SQLite behind a typed accessor a scoring engine will later import.
PLAN the architecture first — propose folder structure, SQLite schema, the shared
stats TYPE, and the legend-anchor seed list — SHOW me the plan, and WAIT for my OK
before implementing. Then build stage by stage and run the verification script at the
end.

SUBJECTS: cricketers only. "Type a name → get cards" is the model (the GitFut parallel
to a GitHub username). There is NO self-rating / user-input path — do not build one.

DATA SOURCE: Cricsheet (cricsheet.org), CC BY 3.0. Per-competition zips of one JSON
per match: tests_json.zip, odis_json.zip, t20s_json.zip, ipl_json.zip (more league
zips added later), plus a people register at cricsheet.org/register. Each match JSON
has `info` (teams, dates, match_type, gender, event.name, players,
registry.people = name→STABLE-ID map, outcome) and
innings[].overs[].deliveries[] (batter, bowler, non_striker, runs{batter,extras,
total}, wickets{player_out,kind,fielders}, extras). The registry gives every player a
stable ID consistent across ALL matches and formats — aggregate on that ID, NEVER on
names.

TECH: TypeScript + Node only (one language for the whole repo; the web app and scoring
engine will be TS too). SQLite via better-sqlite3 as the store. Per-file JSON.parse in
a loop (files are small). No Python, no external services.

FORMAT BUCKETS: test, odi, t20i, ipl — determined by SOURCE COMPETITION (which zip),
NOT just match_type (IPL and T20Is are both "T20" but are SEPARATE buckets with
SEPARATE percentile populations, so a player gets a distinct IPL card and T20I card).
Adding a league later must be a one-line config entry:
  { competitionKey → { formatBucket, displayLabel, qualifyingMatches } }.

THE SIX CARD STATS (cricket analog of GitFut's PAC/SHO/PAS/DRI/DEF/PHY):
  BAT — batting average (run-scoring effectiveness)
  POW — batting strike rate (explosiveness) ← primary impact axis
  BWL — bowling strike rate = balls per wicket (wicket-taking) ← primary impact axis
  ECO — economy rate (bowling control/effectiveness)
  FLD — fielding: catches + stumpings + run-outs per match
  IMP — career weight: matches + career span + milestones (the longevity axis).
        Keep IMP TEMPERED (modest log scaling) so it colours the card but does NOT
        dominate the radar shape — same discipline GitFut applies to PHY.
A pure batter's near-zero BWL/ECO is fine — the card SHAPE tells the story (like a
striker's low DEF).

PIPELINE STAGES:

1. DOWNLOAD the format + league zips and the people register. Cache locally; skip
   re-download if already present. Competition list is config-driven.

2. PARSE each match once; attribute every delivery to batter ID and bowler ID, tagged
   by format bucket. Track processed match IDs (each Cricsheet filename IS the match
   ID) so re-runs are INCREMENTAL — only new files are parsed.

3. AGGREGATE per (playerID, formatBucket):
   - Batting: innings, runs, balls faced, dismissals, not-outs, 4s, 6s → average,
     strike rate, boundary%, 50s, 100s.
   - Bowling: balls, runs conceded, wickets → average, economy, strike rate (balls/
     wicket), 4-fers, 5-fers.
   - Fielding: catches, stumpings, run-outs (from deliveries[].wickets[].fielders and
     kind).
   - Career: matches, first/last match date (span in years), milestone counts. Gender
     flag, default men's, configurable.

4. JOIN the people register for display name + external (Cricinfo) IDs (for later
   photo/metadata enrichment).

5. CALIBRATION — the most important stage. Turn raw stats into a POPULATION-RELATIVE
   view, PER FORMAT BUCKET (each bucket its own population):
   a. QUALIFICATION GATES (hard, per format, config-driven): Test ≥ 8, ODI ≥ 17,
      T20I ≥ 25, IPL ≥ 20 matches. Below the floor → NO card for that format. The gate
      is the PRIMARY filter for unproven players — a player PAST the gate has earned
      the right to be judged on their real numbers.
   b. GENTLE SHRINKAGE above the gate (deliberately LIGHT — the gate already ensures a
      real sample, so do NOT over-shrink): shrunk = (n·raw + k·popMedian)/(n+k), where
      n is in BALLS (balls faced for batting metrics, balls bowled for bowling
      metrics), NOT match count, with a small tunable pseudo-count k (~150–200 balls).
      A gated player keeps MOST of their raw signal; k is a single tunable knob.
   c. PRIMARY IMPACT METRIC = STRIKE RATE for BOTH disciplines: batting SR (runs per
      100 balls) → POW stat; bowling SR (balls per wicket) → BWL stat. These drive how
      much a card "pops".
   d. SECONDARY EFFECTIVENESS METRIC so impact means "explosive AND effective": batting
      average → BAT stat; economy → ECO stat. A high-SR / low-average slogger must NOT
      outrank a genuine match-winner.
   e. PERCENTILES: for each metric, compute its distribution across GATED players in
      that format bucket; store each player's percentile rank, computed on the SHRUNK
      value.
   f. Store raw + shrunk + percentile + sample size for every metric, plus per-format
      percentile breakpoints in a distributions table.

6. REFERENCE OVR — two bands, following GitFut (prototype the engine here so I can
   validate calibration; the polished engine is a later step):
   - PEAK band (caps at 88): the six position-weighted stats built from the percentile-
     anchored, shrunk metrics. Weight POW/BWL heavier in t20i/ipl and BAT heavier in
     test (impact leads where it matters, technique where it matters). Elite strike-rate
     percentiles should push this band HIGH on merit — a current-format great must be
     able to approach 88 on form alone, WITHOUT a long career.
   - GREATNESS band (88→99): bonusMax · sigmoid(a·longevity_z + b·peakEliteness_z − c),
     where longevity_z = z-scored (matches + span + milestones) and peakEliteness_z =
     z-scored mean of the player's top rate-stat percentiles. A MODEST longevity deficit
     must be overcome by a peak SURPLUS (so a shorter-but-stratospheric career reaches
     the 90s where a longer-but-flatter one plateaus). BUT a true rookie (deeply
     negative longevity_z) gets ≈0 from this band regardless of peak. Expose a and b as
     a SINGLE peak-vs-longevity knob in config.

7. EQUATE-TO-LEGEND — after OVR, map each card to its nearest benchmark legend via
   weighted distance in (6-stat profile + OVR + SAME format bucket + SAME role:
   batter / bowler / allrounder / keeper). Anchors live in a LEGEND_ANCHORS table
   (id, name, formatBucket, role, profile{6 stats}, ovr, source: computed | seeded):
   - Modern legends: their anchor profiles come STRAIGHT from this pipeline (mark
     source=computed).
   - Pre-limited-overs legends (Bradman, Sobers, Viv Richards, Richard Hadlee, Barry
     Richards, and similar): HAND-AUTHORED constants (source=seeded), because Cricsheet
     has no pre-2000s ball-by-ball. An OVR-99 Test profile must equate to the seeded
     Bradman anchor. Seed a starter set spanning tiers, formats, and archetypes.

8. OUTPUT — a SQLite DB with tables: players (id, name, external refs, gender),
   player_format_stats (playerID, formatBucket, all raw + shrunk metrics, all percentile
   ranks, sample sizes, career span, the six stats, OVR, role, equated legend id),
   format_distributions (per-format percentile breakpoints), legend_anchors. PLUS a
   typed TS accessor module exporting (playerId, formatBucket) → a fully typed object
   { stats, ovr, role, percentiles, sampleSizes, equatedLegend }. Define that object as
   a SHARED TYPE the future scoring engine imports — the engine depends on the TYPE, not
   pipeline internals.

"OPTIMAL" REQUIREMENTS:
- Single pass, O(deliveries); full men's international + IPL should aggregate in a few
  minutes on a laptop.
- Idempotent + incremental (re-runs only touch new match files).
- Edge cases handled gracefully: matches lacking ball-by-ball detail, super-overs,
  forfeits/no-results, missing registry entries, multi-fielder run-outs, retired-hurt,
  players who only batted OR only bowled.

DELIVERABLES:
- The full pipeline: download → parse → aggregate → join → calibrate → reference-OVR →
  equate → SQLite + typed accessor.
- An npm script `ingest` that runs it end to end.
- A VERIFICATION script that prints each test player's per-format raw stats, key
  percentiles, OVR, and equated legend — and ASSERTS these acceptance tests, printing
  WHY each passes or fails (which band / gate / metric drove the result):
    • Suryakumar Yadav — T20I OVR is top-tier AND clearly greater than his ODI OVR.
    • Vaibhav Suryavanshi — gets an IPL card ONLY (fails the T20I gate). His IPL OVR
      lands around 80 (accept 76–82): driven UP by his strike-rate percentile (peak
      band) but with a near-ZERO greatness bonus (no longevity yet). Must NOT be
      flattened into the 50s–60s, and must NOT reach established-star tier (85+).
    • AB de Villiers ODI OVR > Ricky Ponting ODI OVR — peak surplus overcomes a modest
      longevity deficit (note: BOTH have long careers, so this tests peak-vs-peak with a
      longevity tilt, NOT the rookie case).
    • Jasprit Bumrah — elite OVR in Test and T20I (bowling-strike-rate-driven).
    • MS Dhoni — rated as a keeper.
- A short README documenting the data contract, the peak-vs-longevity knob, the
  shrinkage k, and how to add a new league.

Begin with the PLAN (folder structure, SQLite schema, shared stats type, legend seed
list). Wait for my OK before writing code.cl