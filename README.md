# GitCric — data pipeline

Turns Cricsheet ball-by-ball data into FIFA-Ultimate-Team-style cricketer rating
cards, **one card per format** (Test, ODI, T20I, IPL). Each card has six stats, a
reference OVR out of 99, a role, and a nearest-legend equate. This repo is the
**data pipeline only** — it writes a SQLite DB behind a typed accessor that a
scoring engine / web app will later import. There is no self-rating path: the
model is "type a name → get cards".

Inspired by [gitfut](https://github.com/Younesfdj/gitfut) (MIT), whose two-band
scoring math this mirrors.

## Run it

```bash
npm install
npm run ingest    # download → parse → aggregate → join → calibrate → OVR → equate → SQLite
npm run verify    # prints each test player's cards and asserts the acceptance tests
```

`ingest` downloads the Cricsheet zips + people register into `data/raw/` (cached;
re-runs skip re-download), parses every match once, and writes `data/gitcric.db`.
A full men's international + IPL run aggregates in a few minutes; **re-runs are
incremental** — only match files not already in `processed_matches` are parsed,
so a second `ingest` recomputes calibration/OVR in under a second.

## The data contract

The scoring engine depends on the TYPE, never on pipeline internals. It imports:

- `src/types/stats.ts` — `PlayerCardData`, `CardStats`, `FormatBucket`, `Role`,
  `LegendAnchor`, `MetricCalib`.
- `src/db/accessor.ts` — `new GitCricStore().getCard(playerId, bucket)` returns a
  fully-typed `PlayerCardData | null` (null = no gated card in that format), plus
  `findByName(query)` and `bucketsFor(playerId)`.

`PlayerCardData` carries the six `stats`, `role`, `ovr`, the band breakdown
(`bands.peakOvr`, `bands.greatnessBonus`, the z-scores), the raw+shrunk+percentile
trail for every metric, sample sizes, career line, and the `equatedLegend`.

### The six stats

| Stat | Meaning | Driver |
|------|---------|--------|
| BAT  | batting effectiveness | batting average percentile |
| POW  | explosiveness | **batting strike rate** percentile (primary impact axis) |
| BWL  | wicket-taking | **bowling strike rate** = balls/wicket percentile (primary impact axis) |
| ECO  | bowling control | economy percentile |
| FLD  | fielding | (catches + stumpings + run-outs) / match percentile |
| IMP  | career weight | tempered log of matches + span + milestones |

A pure batter's near-zero BWL/ECO (and a pure bowler's near-zero BAT/POW) is by
design — an axis below the min-balls floor gets a low FLOOR stat, so the card
SHAPE tells the story, like a striker's low DEF.

## Calibration & scoring knobs (all in `src/config/calibration.ts`)

- **Qualification gates** (`src/config/competitions.ts`, `qualifyingMatches`):
  Test 8, ODI 17, T20I 25, IPL 20 matches. Below the floor → **no card** for that
  format. The gate is the primary filter for unproven players; past it, a player
  is judged on their real numbers.

- **Shrinkage `SHRINKAGE_K = 175` (balls).** Above the gate, each metric is gently
  pulled toward the format-bucket population median:
  `shrunk = (n·raw + k·popMedian) / (n + k)`, with `n` in **balls** (faced for
  batting metrics, bowled for bowling metrics). Deliberately light — the gate
  already guarantees a real sample, so a gated player keeps most of their raw
  signal. Raise `k` to shrink harder toward the median, lower it to trust raw
  numbers more.

- **Stat mapping cooling (`STAT_FLOOR = 30`, `STAT_CEIL = 94`).** A percentile is
  mapped linearly onto a stat: `stat = FLOOR + (CEIL − FLOOR)·percentile`. The
  ceiling sits well below 99 on purpose, so even a 99th-percentile metric lands in
  the low 90s, not 96–99. This is what keeps the six stats — and therefore OVRs —
  spread across a wide range instead of all clustering at the top; only the
  greatness band can carry a card into the high 90s. Raise the ceiling to warm the
  whole scale, lower it to cool/compress it.

- **Peak band (caps at 88).** Position-weighted sum of the six cooled,
  percentile-anchored stats. Weights are keyed by (role × bucket) in
  `PEAK_WEIGHTS`: a pure bowler is judged almost entirely on BWL/ECO, a specialist
  batsman on BAT (his batting is weighted heavier than a keeper-batsman's, whose
  card value is split with the gloves), with a per-format tilt (POW leads in
  T20I/IPL, ECO leads for T20 bowlers, batting technique leads in Test). This role
  differentiation is what lets a specialist Test batsman out-peak a keeper of
  similar raw numbers, and a peak specialist bowler reach the same ceiling as a
  peak batter.

- **The peak-vs-longevity knob: `PEAK_VS_LONGEVITY` ∈ [0,1] (default 0.95).**
  The greatness band (88→99) is
  `bonus = BONUS_MAX · sigmoid(a·longevity_z + b·peakEliteness_z − c) · gate`,
  with `a = 2·(1−t)`, `b = 2·t` for the knob `t`. Higher `t` → peak eliteness
  matters more relative to longevity, so a shorter-but-stratospheric career
  reaches the 90s where a longer-but-flatter one plateaus. `BONUS_MAX = 11`
  (88 + 11 = 99). The `gate` term (`GREATNESS_GATE_LO/HI`) smoothly zeroes the
  bonus for a true rookie (deeply negative `longevity_z`) **regardless of peak**,
  which is what keeps a newcomer in the peak band only.

- **Equate-to-legend** (`EQUATE`): nearest anchor by weighted distance over the
  6-stat profile + OVR, within the SAME bucket and SAME role. Modern legends are
  computed anchors (top OVRs per group); pre-limited-overs greats (Bradman,
  Sobers, Hadlee, …) are hand-seeded in `src/legends/anchors.seed.ts`
  (`source = "seeded"`). An OVR-99 Test batter equates to the seeded Bradman.

## Adding a new league

One line in `src/config/competitions.ts`:

```ts
bbl: { formatBucket: "bbl", displayLabel: "Big Bash", qualifyingMatches: 20, zip: "bbl_json.zip" },
```

Add `"bbl"` to the `FormatBucket` union in `src/types/stats.ts` and a
`PEAK_WEIGHTS` column for it, then `npm run ingest`. The bucket gets its own
percentile population and its own cards — a player with both a T20I and a BBL
history gets a distinct card for each, because buckets are keyed on the **source
competition**, not `match_type`.

## Pipeline stages

`download` → `parse` (delivery attribution on stable registry IDs, incremental)
→ `aggregate` (per player×bucket) → `register` join (display name + Cricinfo id)
→ `calibrate` (shrinkage, percentiles, distributions) → `ovr` (two-band engine)
→ `equate` → SQLite + typed accessor. Edge cases handled: matches without
ball-by-ball, super-overs, no-results/forfeits, missing registry entries,
multi-fielder run-outs, retired-hurt, and players who only batted or only bowled.

## Schema

`players`, `player_format_stats` (raw + shrunk metrics, percentiles, sample
sizes, career span, the six stats, band breakdown, role, equated legend),
`format_distributions` (per-bucket percentile breakpoints), `legend_anchors`,
`processed_matches` (incremental bookkeeping), `meta`.

Data © Cricsheet, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
