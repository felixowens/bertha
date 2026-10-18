import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { build } from "vite"
import { afterEach, expect, it } from "vitest"

import type { Report } from "../src/build/index.ts"
import { bertha } from "../src/vite/index.ts"
import { mockBertha } from "./helpers.ts"

let server: Awaited<ReturnType<typeof mockBertha>> | undefined
afterEach(async () => server?.close())

it("builds with hidden maps, uploads them and leaves none behind", async () => {
  server = await mockBertha(() => ({ status: 201, body: {} }))
  const root = await mkdtemp(join(tmpdir(), "bertha-vite-"))
  await writeFile(join(root, "index.html"), `<!doctype html><script type="module" src="/main.js"></script>`)
  await writeFile(join(root, "main.js"), `import("./lazy.js").then((m) => m.go())\n`)
  await writeFile(join(root, "lazy.js"), `export function go() { throw new Error("from lazy") }\n`)
  await writeFile(join(root, ".env"), `VITE_BERTHA_URL=${server.url}\nBERTHA_UPLOAD_KEY=up-from-env\n`)
  let report: Report | undefined
  await build({
    root,
    logLevel: "silent",
    configFile: false,
    plugins: [bertha({ release: "r1", onReport: (r) => (report = r) })],
  })
  const assets = await readdir(join(root, "dist", "assets"))
  expect(assets.some((f) => f.endsWith(".map"))).toBe(false)
  expect(report?.uploaded).toBe(2)
  expect(server.received.map((r) => r.query.get("release"))).toEqual(["r1", "r1"])
  expect(server.received[0]!.headers.authorization).toBe("Bearer up-from-env")
  for (const f of assets.filter((f) => f.endsWith(".js"))) {
    const code = await readFile(join(root, "dist", "assets", f), "utf8")
    expect(code).toMatch(/\/\/# debugId=[0-9a-f-]{36}\n$/)
    expect(code).not.toContain("sourceMappingURL")
  }
})
