// The README's screenshots, from the sample data: each page in a browser window on a
// dotted background. Start `npm run dev -- --port 4321` first, then:
//   node scripts/readme-screenshots.ts

import { chromium } from "@playwright/test"
import { resolve } from "node:path"

const OUT = resolve(import.meta.dirname, "../docs/screenshots")
const BASE = "http://localhost:4321"
const HOST = "bertha.example.com"
const shots: [name: string, path: string][] = [
  ["overview", "/"],
  ["issues", "/issues"],
  ["issue", "/issues/i-cart-map"],
  ["release", "/releases/r-kiln-0"],
  ["monitor", "/uptime/mon-harbour"],
]

const W = 1440
const H = 900

const frame = (png: string, url: string) => `<!doctype html>
<html><head>
<link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400&display=block" rel="stylesheet">
<style>
  html, body { margin: 0; }
  body {
    width: ${W + 240}px; padding: 110px 120px; box-sizing: border-box;
    background-color: #e8e6e1;
    background-image: radial-gradient(circle at center, rgb(0 0 0 / 0.16) 1.1px, transparent 1.3px);
    background-size: 14px 14px;
    background-position: 7px 7px;
  }
  .window {
    border-radius: 18px; overflow: hidden; background: #0c0c0c;
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.5), 0 2px 4px rgb(0 0 0 / 0.08), 0 30px 70px -10px rgb(0 0 0 / 0.35);
  }
  .bar { height: 46px; display: flex; align-items: center; position: relative; padding: 0 18px; }
  .dots { display: flex; gap: 8px; }
  .dots i { width: 11px; height: 11px; border-radius: 3px; background: #2a2a2a; }
  .url {
    position: absolute; left: 50%; transform: translateX(-50%);
    width: 360px; height: 28px; border-radius: 7px; background: #000;
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08);
    display: flex; align-items: center; justify-content: center;
    font: 13px/1 "Geist Mono", ui-monospace, monospace; color: #a3a3a3; letter-spacing: 0.01em;
  }
  img { display: block; width: ${W}px; height: ${H}px; }
</style></head>
<body><div class="window">
  <div class="bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">${url}</div></div>
  <img src="data:image/png;base64,${png}">
</div></body></html>`

const browser = await chromium.launch()
const app = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: "dark" })
const canvas = await browser.newPage({ viewport: { width: W + 240, height: 800 }, deviceScaleFactor: 2 })
for (const [name, path] of shots) {
  await app.goto(BASE + path, { waitUntil: "networkidle" })
  await app.waitForTimeout(800)
  const png = (await app.screenshot()).toString("base64")
  await canvas.setContent(frame(png, HOST + (path === "/" ? "" : path)), { waitUntil: "networkidle" })
  await canvas.evaluate(() => document.fonts.ready)
  await canvas.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  console.log(`docs/screenshots/${name}.png`)
}
await browser.close()
