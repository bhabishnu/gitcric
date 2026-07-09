-- GitCric SQLite schema. Idempotent: safe to run on every open.

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS players (
  id          TEXT PRIMARY KEY,     -- Cricsheet registry STABLE id (aggregate on this, never names)
  name        TEXT NOT NULL,
  cricinfo_id TEXT,                 -- external ref for later photo/metadata enrichment
  gender      TEXT NOT NULL
);

-- Tracks each processed Cricsheet file (filename IS the match id) so re-runs are
-- INCREMENTAL — only new files are parsed.
CREATE TABLE IF NOT EXISTS processed_matches (
  match_id      TEXT NOT NULL,
  format_bucket TEXT NOT NULL,
  ingested_at   TEXT NOT NULL,
  PRIMARY KEY (match_id, format_bucket)
);

CREATE TABLE IF NOT EXISTS player_format_stats (
  player_id     TEXT NOT NULL,
  format_bucket TEXT NOT NULL,

  -- ── raw counters (additive across matches; drive incremental re-aggregation) ──
  matches       INTEGER NOT NULL DEFAULT 0,
  bat_innings   INTEGER NOT NULL DEFAULT 0,
  runs          INTEGER NOT NULL DEFAULT 0,
  balls_faced   INTEGER NOT NULL DEFAULT 0,
  dismissals    INTEGER NOT NULL DEFAULT 0,
  not_outs      INTEGER NOT NULL DEFAULT 0,
  fours         INTEGER NOT NULL DEFAULT 0,
  sixes         INTEGER NOT NULL DEFAULT 0,
  fifties       INTEGER NOT NULL DEFAULT 0,
  hundreds      INTEGER NOT NULL DEFAULT 0,

  balls_bowled  INTEGER NOT NULL DEFAULT 0,
  runs_conceded INTEGER NOT NULL DEFAULT 0,
  wickets       INTEGER NOT NULL DEFAULT 0,
  four_fers     INTEGER NOT NULL DEFAULT 0,
  five_fers     INTEGER NOT NULL DEFAULT 0,

  catches       INTEGER NOT NULL DEFAULT 0,
  stumpings     INTEGER NOT NULL DEFAULT 0,
  run_outs      INTEGER NOT NULL DEFAULT 0,

  first_date    TEXT,
  last_date     TEXT,
  span_years    REAL NOT NULL DEFAULT 0,

  -- ── raw metrics ──
  bat_avg       REAL,
  bat_sr        REAL,
  boundary_pct  REAL,
  bowl_avg      REAL,
  economy       REAL,
  bowl_sr       REAL,

  -- ── shrunk metrics (balls-weighted toward population median) ──
  bat_avg_shrunk REAL,
  bat_sr_shrunk  REAL,
  bowl_sr_shrunk REAL,
  economy_shrunk REAL,

  -- ── percentile ranks (0..1 on the SHRUNK value, within bucket; higher = better) ──
  bat_avg_pct   REAL,
  bat_sr_pct    REAL,
  bowl_sr_pct   REAL,
  economy_pct   REAL,
  fld_pct       REAL,
  imp_pct       REAL,

  -- ── sample sizes ──
  sample_balls_bat  INTEGER NOT NULL DEFAULT 0,
  sample_balls_bowl INTEGER NOT NULL DEFAULT 0,

  -- ── the six card stats (1..99) ──
  stat_bat INTEGER,
  stat_pow INTEGER,
  stat_bwl INTEGER,
  stat_eco INTEGER,
  stat_fld INTEGER,
  stat_imp INTEGER,

  -- ── OVR bands ──
  peak_ovr        INTEGER,
  greatness_bonus INTEGER,
  longevity_z     REAL,
  peak_elite_z    REAL,
  ovr             INTEGER,

  role              TEXT,
  gated             INTEGER NOT NULL DEFAULT 0,  -- 1 if matches >= gate
  equated_legend_id TEXT,

  PRIMARY KEY (player_id, format_bucket)
);

CREATE INDEX IF NOT EXISTS idx_pfs_bucket ON player_format_stats (format_bucket);

-- Per-format percentile breakpoints + population medians, one row per metric.
CREATE TABLE IF NOT EXISTS format_distributions (
  format_bucket TEXT NOT NULL,
  metric        TEXT NOT NULL,
  pop_median    REAL,
  pop_n         INTEGER,
  breakpoints   TEXT,   -- JSON: [{p:0.01,v:..}, ...] shrunk-value breakpoints
  PRIMARY KEY (format_bucket, metric)
);

CREATE TABLE IF NOT EXISTS legend_anchors (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  format_bucket TEXT NOT NULL,
  role          TEXT NOT NULL,
  bat INTEGER, pow INTEGER, bwl INTEGER, eco INTEGER, fld INTEGER, imp INTEGER,
  ovr           INTEGER NOT NULL,
  source        TEXT NOT NULL   -- 'computed' | 'seeded'
);

CREATE INDEX IF NOT EXISTS idx_anchors_bucket_role ON legend_anchors (format_bucket, role);
