// The browser bundle must stay under 5KB gzipped.
import { gzipSync } from "node:zlib"

import { build } from "esbuild"

const BUDGET = 5 * 1024
const entries = { browser: "src/browser/index.ts", "next/client": "src/next/client.ts" }
let over = false
for (const [name, entry] of Object.entries(entries)) {
  const out = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    platform: "browser",
    define: { "process.env.NEXT_PUBLIC_BERTHA_KEY": '"k"', "process.env.NEXT_PUBLIC_BERTHA_URL": '"u"' },
  })
  const bytes = gzipSync(out.outputFiles[0]!.contents).length
  over ||= bytes > BUDGET
  console.log(`${name.padEnd(12)} ${(bytes / 1024).toFixed(2)}KB gzipped${bytes > BUDGET ? ` (over the ${BUDGET / 1024}KB budget)` : ""}`)
}
process.exitCode = over ? 1 : 0
