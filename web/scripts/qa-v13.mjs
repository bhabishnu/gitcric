/**
 * v1.3 QA: the PNG export and the OG image must agree with the live card, and
 * the page must survive reduced motion. The flag is the interesting case — it's
 * inline SVG, and html-to-image has to serialise it out of the live DOM.
 */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const SP = process.env.SP;
const BASE = process.env.BASE || "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome-stable", headless: true });
const fails = [];

// ── 1. PNG export vs live card (Lamichhane — the Nepal flag case) ───────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/player/b410bd3d`, { waitUntil: "networkidle" });
  await page.waitForSelector(".gc-card");
  await page.getByRole("tab", { name: "T20I", exact: true }).click();
  await page.waitForTimeout(400);

  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.getByRole("button", { name: /download png/i }).click(),
  ]);
  const path = `${SP}/v13-export.png`;
  await dl.saveAs(path);
  const bytes = readFileSync(path);
  console.log(`PNG export: ${dl.suggestedFilename()} — ${(bytes.length / 1024).toFixed(0)} kB`);
  if (bytes.length < 20000) fails.push("PNG export looks empty/too small");

  // Does the exported PNG actually contain the flag's crimson? A dropped SVG
  // would still produce a valid-looking card, so check the pixels, not the size.
  const hasCrimson = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      // Nepal crimson #ce0000 (allow for scaling/AA)
      if (d[i] > 150 && d[i] < 235 && d[i + 1] < 60 && d[i + 2] < 60) n++;
    }
    return n;
  }, `data:image/png;base64,${bytes.toString("base64")}`);
  console.log(`PNG export: Nepal-crimson pixels found = ${hasCrimson}`);
  if (hasCrimson < 200) fails.push("PNG export is missing the flag (no Nepal crimson pixels)");
  await page.close();
}

// ── 2. OG image renders ────────────────────────────────────────────────────
{
  const page = await browser.newPage();
  const res = await page.goto(`${BASE}/torvalds/opengraph-image`, { waitUntil: "networkidle", timeout: 60000 });
  const ct = res.headers()["content-type"];
  const len = (await res.body()).length;
  console.log(`OG image: ${res.status()} ${ct} — ${(len / 1024).toFixed(0)} kB`);
  if (res.status() !== 200 || !ct?.includes("png")) fails.push(`OG image failed: ${res.status()} ${ct}`);
  await page.close();
}

// ── 3. reduced motion + console errors + overflow ───────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/torvalds`, { waitUntil: "networkidle" });
  await page.waitForSelector(".gc-card");
  for (const tab of ["TEST", "ODI", "T20I", "IPL", "YOU"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await page.waitForTimeout(140);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(`reduced motion: back to "${await page.locator(".gc-surname").textContent()}", overflow=${overflow}, console errors=${errors.length || "none"}`);
  if (overflow) fails.push("horizontal overflow at 1440 under reduced motion");
  if (errors.length) fails.push(`console errors: ${errors.slice(0, 2).join(" | ")}`);

  // mobile
  const m = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const mp = await m.newPage();
  await mp.goto(`${BASE}/torvalds`, { waitUntil: "networkidle" });
  await mp.waitForSelector(".gc-card");
  const mo = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await mp.screenshot({ path: `${SP}/v13-mobile.png`, fullPage: true });
  console.log(`mobile(360): overflow=${mo}`);
  if (mo) fails.push("horizontal overflow at 360");
}

// ── 4. contrast of the tier line on the page background ────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const ratios = [];
  for (const [who, url, tab] of [
    ["immortal", "/player/7d415ea5", "TEST"],
    ["gold", "/player/ba607b88", "TEST"],
  ]) {
    await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const el = document.querySelector(".gc-tierline");
      const lum = (c) => {
        const [r, g, b] = c.match(/\d+/g).slice(0, 3).map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const fg = lum(getComputedStyle(el).color);
      const bg = lum(getComputedStyle(document.body).backgroundColor);
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      return { tier: el.dataset.tier, text: el.textContent, ratio: +ratio.toFixed(2), size: getComputedStyle(el).fontSize };
    });
    ratios.push(r);
  }
  for (const r of ratios) {
    const ok = r.ratio >= 4.5;
    console.log(`contrast: ${r.text.padEnd(9)} (${r.tier}) ${r.ratio}:1 at ${r.size} — ${ok ? "AA pass ✓" : "FAIL ✗"}`);
    if (!ok) fails.push(`tier line "${r.text}" contrast ${r.ratio}:1 < 4.5`);
  }
}

console.log("\n" + (fails.length ? "FAILURES:\n  " + fails.join("\n  ") : "v1.3 QA passed ✓"));
await browser.close();
process.exit(fails.length ? 1 : 0);
