import { chromium } from "playwright-core";

const OUT = process.env.SP;
const url = process.argv[2] || "http://localhost:3000/bhabishnu";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome-stable", headless: true });

// desktop: capture YOU, then toggle each format, then back to YOU
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector(".gc-card");
await page.screenshot({ path: `${OUT}/sw-you.png` });

for (const tab of ["TEST", "ODI", "T20I", "IPL"]) {
  await page.getByRole("tab", { name: tab, exact: true }).click();
  await page.waitForTimeout(320);
  await page.screenshot({ path: `${OUT}/sw-${tab.toLowerCase()}.png` });
  // read the visible surname + trim to log
  const surname = await page.locator(".gc-surname").textContent();
  const trim = await page.locator(".gc-card").getAttribute("data-trim");
  console.log(`${tab}: card="${surname}" trim=${trim}`);
}
// back to YOU
await page.getByRole("tab", { name: "YOU", exact: true }).click();
await page.waitForTimeout(320);
const back = await page.locator(".gc-surname").textContent();
console.log(`YOU restored: card="${back}"`);
await page.screenshot({ path: `${OUT}/sw-back.png` });

// mobile
const m = await browser.newPage({ viewport: { width: 402, height: 1600 } });
await m.goto(url, { waitUntil: "networkidle" });
await m.waitForSelector(".gc-card");
await m.screenshot({ path: `${OUT}/mobile.png`, fullPage: true });

await browser.close();
console.log("done");
