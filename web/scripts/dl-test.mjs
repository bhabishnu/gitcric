import { chromium } from "playwright-core";
const OUT = process.env.SP;
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome-stable", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

// torvalds — immortal tier visual + twins
await page.goto("http://localhost:3000/torvalds", { waitUntil: "networkidle" });
await page.waitForSelector(".gc-card");
await page.screenshot({ path: `${OUT}/torvalds.png` });
console.log("torvalds tier:", await page.locator(".gc-card").getAttribute("data-tier"));

// PNG download test
const [dl] = await Promise.all([
  page.waitForEvent("download", { timeout: 15000 }).catch(() => null),
  page.getByRole("button", { name: /Download/i }).click(),
]);
if (dl) {
  const p = `${OUT}/card-download.png`;
  await dl.saveAs(p);
  console.log("DOWNLOAD OK:", await dl.suggestedFilename());
} else {
  console.log("DOWNLOAD FAILED (no download event)");
}
await browser.close();
