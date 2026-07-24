/**
 * v1.3 screenshot + verification pass.
 *   - Ponting Test        → tier in the page header, gone from the card face
 *   - Kohli Test vs IPL   → different archetypes from the same player
 *   - Lamichhane T20I     → correct Nepal flag + delivery-type-neutral copy
 *   - an elite YOU account → varied twins
 *   - a flag contact sheet for the accuracy pass
 */
import { chromium } from "playwright-core";

const OUT = process.env.SP;
const BASE = process.env.BASE || "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome-stable", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 2 });

/** Read what the page actually says — the screenshots are evidence, this is the assertion. */
async function read(label) {
  const header = (await page.locator("header p").first().textContent().catch(() => "")) ?? "";
  const archetype = (await page.locator("aside h2").first().textContent().catch(() => "")) ?? "";
  const commentary = (await page.locator("header p").last().textContent().catch(() => "")) ?? "";
  const traits = await page.locator("aside p.text-\\[13px\\]").allTextContents().catch(() => []);
  const flag = await page.locator(".gc-flag").getAttribute("aria-label").catch(() => null);
  const onFace = await page.locator(".gc-format").count();
  console.log(`\n── ${label}`);
  console.log(`   header     : ${header.replace(/\s+/g, " ").trim()}`);
  console.log(`   archetype  : ${archetype.trim()}`);
  console.log(`   commentary : ${commentary.replace(/\s+/g, " ").trim()}`);
  console.log(`   traits     : ${traits.join(" | ")}`);
  console.log(`   flag       : ${flag}`);
  console.log(`   FORMAT·MATCHES still on card face: ${onFace > 0 ? "YES ✗" : "no ✓"}`);
  return { header, archetype, commentary, flag };
}

async function go(url, tab, shot, label) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".gc-card");
  if (tab) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await page.waitForTimeout(400);
  }
  const info = await read(label);
  await page.screenshot({ path: `${OUT}/${shot}.png` });
  return info;
}

const ponting = await go("/player/7d415ea5", "TEST", "v13-ponting-test", "Ponting — TEST (tier in header)");
const kohliTest = await go("/player/ba607b88", "TEST", "v13-kohli-test", "Kohli — TEST");
const kohliIpl = await go("/player/ba607b88", "IPL", "v13-kohli-ipl", "Kohli — IPL");
const lami = await go("/player/b410bd3d", "T20I", "v13-lamichhane-t20i", "Lamichhane — T20I (Nepal)");
await go("/torvalds", null, "v13-elite-you", "torvalds — YOU (elite)");

// the four twins for the elite account
const twins = [];
for (const t of ["TEST", "ODI", "T20I", "IPL"]) {
  await page.getByRole("tab", { name: t, exact: true }).click();
  await page.waitForTimeout(350);
  twins.push(`${t}: ${(await page.locator(".gc-surname").textContent()).trim()}`);
}
await page.screenshot({ path: `${OUT}/v13-elite-you-ipl.png` });
console.log(`\n── torvalds twins: ${twins.join("  ")}`);

// ── assertions ─────────────────────────────────────────────────────────────
const fail = [];
if (!/IMMORTAL/.test(ponting.header)) fail.push("Ponting header is missing the tier");
if (!/TEST/.test(ponting.header) || !/matches/.test(ponting.header)) fail.push("Ponting header lost format/matches");
if (kohliTest.archetype === kohliIpl.archetype) fail.push(`Kohli Test and IPL share an archetype (${kohliTest.archetype})`);
if (lami.flag !== "Nepal flag") fail.push(`Lamichhane flag is "${lami.flag}", expected Nepal`);
const PACE = /\b(pace|quick|express|seam|swing|spin|deck|bouncer|yorker|googly|wrist)\w*\b/i;
if (PACE.test(lami.commentary)) fail.push(`Lamichhane commentary asserts a delivery type: "${lami.commentary}"`);

console.log("\n" + (fail.length ? "FAILURES:\n  " + fail.join("\n  ") : "all screenshot assertions passed ✓"));
await browser.close();
