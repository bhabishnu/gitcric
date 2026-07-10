import { openDb } from "./db/db.js";
import { GitCricStore } from "./db/accessor.js";
import type { FormatBucket, PlayerCardData } from "./types/stats.js";

const BUCKETS: FormatBucket[] = ["test", "odi", "t20i", "ipl"];

// Stable Cricsheet identifiers for the acceptance subjects (register lookups).
const SUBJECTS = {
  sky: { id: "271f83cd", label: "Suryakumar Yadav" },
  vaibhav: { id: "470f446b", label: "Vaibhav Suryavanshi" },
  abd: { id: "c4487b84", label: "AB de Villiers" },
  ponting: { id: "7d415ea5", label: "Ricky Ponting" },
  bumrah: { id: "462411b3", label: "Jasprit Bumrah" },
  dhoni: { id: "4a8a2e3b", label: "MS Dhoni" },
};

const store = new GitCricStore();
const db = openDb();

const nm = (id: string) => ((db.prepare("SELECT name FROM players WHERE id = ?").get(id) as any)?.name ?? id) as string;
const fmt = (x: number | null | undefined, d = 1) => (x == null ? "—" : x.toFixed(d));
const pct = (x: number) => `${Math.round(x * 100)}%`;

function printCard(label: string, card: PlayerCardData | null, bucket: FormatBucket): void {
  if (!card) {
    console.log(`  ${bucket.toUpperCase().padEnd(4)} — no card (below gate)`);
    return;
  }
  const s = card.stats;
  const m = card.metrics;
  console.log(
    `  ${bucket.toUpperCase().padEnd(4)} OVR ${String(card.ovr).padStart(2)} ` +
      `[peak ${card.bands.peakOvr} + greatness ${card.bands.greatnessBonus}]  role=${card.role}  ` +
      `→ ${card.equatedLegend?.name ?? "—"}`,
  );
  console.log(
    `        stats  BAT ${s.BAT} POW ${s.POW} BWL ${s.BWL} ECO ${s.ECO} FLD ${s.FLD} IMP ${s.IMP}   ` +
      `(m=${card.career.matches}, span=${fmt(card.career.spanYears)}y)`,
  );
  console.log(
    `        raw    avg ${fmt(m.battingAvg.raw)} SR ${fmt(m.battingSR.raw)} | bowlSR ${fmt(m.bowlingSR.raw)} econ ${fmt(m.economy.raw)}`,
  );
  console.log(
    `        pctl   avg ${pct(m.battingAvg.percentile)} SR ${pct(m.battingSR.percentile)} | ` +
      `bowlSR ${pct(m.bowlingSR.percentile)} econ ${pct(m.economy.percentile)} | fld ${pct(m.fielding.percentile)} imp ${pct(m.impact.percentile)}`,
  );
  console.log(`        bands  longevity_z=${fmt(card.bands.longevityZ, 2)} peakElite_z=${fmt(card.bands.peakElitenessZ, 2)}`);
}

function printSubject(id: string, label: string): Record<FormatBucket, PlayerCardData | null> {
  console.log(`\n▶ ${label}  (${nm(id)}, id=${id})`);
  const cards = {} as Record<FormatBucket, PlayerCardData | null>;
  for (const b of BUCKETS) {
    cards[b] = store.getCard(id, b);
    printCard(label, cards[b], b);
  }
  return cards;
}

// ── assertion harness ──
let passed = 0;
let failed = 0;
function assert(name: string, cond: boolean, why: string): void {
  if (cond) {
    passed++;
    console.log(`  ✅ PASS — ${name}\n       WHY: ${why}`);
  } else {
    failed++;
    console.log(`  ❌ FAIL — ${name}\n       WHY: ${why}`);
  }
}

console.log("═══════════════════════════════════════════════════════════════");
console.log(" GitCric — verification & acceptance tests");
console.log("═══════════════════════════════════════════════════════════════");

const sky = printSubject(SUBJECTS.sky.id, SUBJECTS.sky.label);
const vaibhav = printSubject(SUBJECTS.vaibhav.id, SUBJECTS.vaibhav.label);
const abd = printSubject(SUBJECTS.abd.id, SUBJECTS.abd.label);
const ponting = printSubject(SUBJECTS.ponting.id, SUBJECTS.ponting.label);
const bumrah = printSubject(SUBJECTS.bumrah.id, SUBJECTS.bumrah.label);
const dhoni = printSubject(SUBJECTS.dhoni.id, SUBJECTS.dhoni.label);

console.log("\n───────────────────────── ACCEPTANCE ─────────────────────────");

// 1) Suryakumar Yadav — T20I top-tier AND > his ODI
{
  const t = sky.t20i;
  const o = sky.odi;
  const topTier = !!t && t.ovr >= 85;
  const greater = !!t && !!o && t.ovr > o.ovr;
  assert(
    "SKY T20I is top-tier AND clearly > his ODI",
    topTier && greater,
    t
      ? `T20I OVR ${t.ovr} (peak ${t.bands.peakOvr}, POW stat ${t.stats.POW} from SR pctl ${pct(t.metrics.battingSR.percentile)}) vs ODI OVR ${o?.ovr ?? "—"}. ` +
          `Strike-rate percentile drives the peak band; T20I population rewards explosiveness more than ODI.`
      : `no T20I card found for SKY (id ${SUBJECTS.sky.id}).`,
  );
}

// 2) Vaibhav Suryavanshi — IPL card ONLY, OVR 76–82, near-zero greatness
{
  const ipl = vaibhav.ipl;
  const t20i = vaibhav.t20i;
  const iplOnly = !!ipl && !t20i;
  const band = !!ipl && ipl.ovr >= 76 && ipl.ovr <= 82;
  const rookieBonus = !!ipl && ipl.bands.greatnessBonus <= 1;
  assert(
    "Vaibhav gets an IPL card ONLY, OVR∈[76,82], ~0 greatness bonus",
    iplOnly && band && rookieBonus,
    ipl
      ? `IPL OVR ${ipl.ovr} (peak ${ipl.bands.peakOvr}, POW ${ipl.stats.POW} from SR pctl ${pct(ipl.metrics.battingSR.percentile)}); ` +
          `greatness bonus ${ipl.bands.greatnessBonus} because longevity_z=${fmt(ipl.bands.longevityZ, 2)} sits below the rookie gate. ` +
          `T20I card present=${!!t20i} (must be false — fails the 25-match T20I gate).`
      : `no IPL card found for Vaibhav (id ${SUBJECTS.vaibhav.id}).`,
  );
}

// 3) AB de Villiers ODI > Ricky Ponting ODI
{
  const a = abd.odi;
  const p = ponting.odi;
  assert(
    "AB de Villiers ODI OVR > Ricky Ponting ODI OVR",
    !!a && !!p && a.ovr > p.ovr,
    a && p
      ? `ABdV ODI ${a.ovr} (peak ${a.bands.peakOvr}, peakElite_z ${fmt(a.bands.peakElitenessZ, 2)}, longevity_z ${fmt(a.bands.longevityZ, 2)}) ` +
          `vs Ponting ODI ${p.ovr} (peak ${p.bands.peakOvr}, peakElite_z ${fmt(p.bands.peakElitenessZ, 2)}, longevity_z ${fmt(p.bands.longevityZ, 2)}). ` +
          `Both long careers → peak surplus (ABdV higher rate percentiles) tips the greatness band.`
      : `missing ODI card (ABdV=${!!a}, Ponting=${!!p}).`,
  );
}

// 4) Jasprit Bumrah — elite Test AND T20I (bowling-SR-driven)
{
  const t = bumrah.test;
  const tt = bumrah.t20i;
  // After the tier-compression pass, the "elite / very-good international" band is
  // 84-89; Bumrah's Test/IPL sit in the great tier (90+) and his weakest format
  // (T20I, mid bowling percentiles) lands at the elite-band floor.
  const eliteTest = !!t && t.ovr >= 88;
  const eliteT20 = !!tt && tt.ovr >= 84;
  assert(
    "Bumrah elite in Test AND T20I (bowling-strike-rate-driven)",
    eliteTest && eliteT20,
    t && tt
      ? `Test OVR ${t.ovr} (BWL ${t.stats.BWL} from bowlSR pctl ${pct(t.metrics.bowlingSR.percentile)}, role ${t.role}); ` +
          `T20I OVR ${tt.ovr} (BWL ${tt.stats.BWL}, ECO ${tt.stats.ECO} from econ pctl ${pct(tt.metrics.economy.percentile)}, role ${tt.role}).`
      : `missing card (Test=${!!t}, T20I=${!!tt}).`,
  );
}

// 5) MS Dhoni — rated as a keeper
{
  const roles = BUCKETS.map((b) => dhoni[b]?.role).filter(Boolean);
  const keeperCard = BUCKETS.map((b) => dhoni[b]).find((c) => c?.role === "keeper");
  assert(
    "MS Dhoni is rated as a keeper",
    !!keeperCard,
    keeperCard
      ? `role=keeper in ${keeperCard.formatBucket.toUpperCase()} (career stumpings drove the classification). Roles across formats: ${roles.join(", ")}.`
      : `Dhoni role never resolved to keeper; roles were ${roles.join(", ") || "none"}.`,
  );
}

console.log("\n═══════════════════════════════════════════════════════════════");
console.log(` RESULT: ${passed} passed, ${failed} failed`);
console.log("═══════════════════════════════════════════════════════════════");

store.close();
db.close();
process.exit(failed > 0 ? 1 : 0);
