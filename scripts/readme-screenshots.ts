// The README's screenshots, from the sample data. Start `npm run dev -- --port 4321`
// first, then: node scripts/readme-screenshots.ts

import { chromium } from "@playwright/test"
import { resolve } from "node:path"

const OUT = resolve(import.meta.dirname, "../docs/screenshots")
const BASE = "http://localhost:4321"
const shots: [name: string, path: string, height: number][] = [
  ["overview", "/", 900],
  ["issues", "/issues", 900],
  ["issue", "/issues/i-cart-map", 900],
  ["release", "/releases/r-kiln-0", 900],
  ["monitor", "/uptime/mon-harbour", 900],
]

const browser = await chromium.launch()
for (const [name, path, height] of shots) {
  const page = await browser.newPage({ viewport: { width: 1440, height }, deviceScaleFactor: 2, colorScheme: "dark" })
  await page.goto(BASE + path, { waitUntil: "networkidle" })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  await page.close()
  console.log(`docs/screenshots/${name}.png`)
}
await browser.close()
