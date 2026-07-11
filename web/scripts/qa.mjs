import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome-stable", headless: true });

// reduced-motion + console errors + horizontal overflow
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:3000/bhabishnu", { waitUntil: "networkidle" });
await page.waitForSelector(".gc-card");

// toggle through all formats under reduced motion
for (const tab of ["TEST", "ODI", "T20I", "IPL", "YOU"]) {
  await page.getByRole("tab", { name: tab, exact: true }).click();
  await page.waitForTimeout(120);
}
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
const surname = await page.locator(".gc-surname").textContent();
console.log("reduced-motion swap → back to:", surname);
console.log("horizontal overflow:", overflow);
console.log("console errors:", errors.length ? errors : "none");

// mobile overflow
const m = await browser.newContext({ viewport: { width: 360, height: 800 } });
const mp = await m.newPage();
await mp.goto("http://localhost:3000/torvalds", { waitUntil: "networkidle" });
await mp.waitForSelector(".gc-card");
const mOverflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
console.log("mobile(360) horizontal overflow:", mOverflow);

await browser.close();
