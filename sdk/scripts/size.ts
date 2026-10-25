// The browser bundle must stay under 8.25KB gzipped (5KB until 0.5 added the page state,
// traces and error fields; 6KB until 0.8 recorded the page's requests as spans; 7.5KB
// until it sent log lines; 8KB until log lines took the request's trace). Clearer code
// wins over a few bytes: raise this rather than golf the source.
import { gzipSync } from "node:zlib"

import { build } from "esbuild"

const BUDGET = 8.25 * 1024
const entries = { browser: "src/browser/index.ts", "next/client": "src/next/client.ts", react: "src/react/index.ts" }
let over = false
for (const [name, entry] of Object.entries(entries)) {
  const out = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    platform: "browser",
    external: ["react"],
    define: { "process.env.NEXT_PUBLIC_BERTHA_KEY": '"k"', "process.env.NEXT_PUBLIC_BERTHA_URL": '"u"' },
  })
  const bytes = gzipSync(out.outputFiles[0]!.contents).length
  over ||= bytes > BUDGET
  console.log(`${name.padEnd(12)} ${(bytes / 1024).toFixed(2)}KB gzipped${bytes > BUDGET ? ` (over the ${BUDGET / 1024}KB budget)` : ""}`)
}
process.exitCode = over ? 1 : 0
