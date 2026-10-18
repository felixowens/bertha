import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { withBertha } from "../src/next/config.ts"

async function nextOutput() {
  const dir = await mkdtemp(join(tmpdir(), "bertha-next-"))
  const map = JSON.stringify({ version: 3, sources: ["a.ts"], names: [], mappings: "AAAA" })
  for (const sub of ["static/chunks", "server/chunks"]) {
    await mkdir(join(dir, ".next", sub), { recursive: true })
    await writeFile(join(dir, ".next", sub, "a.js"), "run();\n//# sourceMappingURL=a.js.map\n")
    await writeFile(join(dir, ".next", sub, "a.js.map"), map)
  }
  return dir
}

type Hook = (meta: { distDir: string; projectDir: string }) => Promise<void>

describe("withBertha", () => {
  it("removes the maps browsers can fetch and keeps the server's", async () => {
    const dir = await nextOutput()
    const config = withBertha({}, { release: "abc" }) as { compiler: { runAfterProductionCompile: Hook } }
    await config.compiler.runAfterProductionCompile({ distDir: join(dir, ".next"), projectDir: dir })
    expect(await readdir(join(dir, ".next/static/chunks"))).toEqual(["a.js"])
    expect((await readdir(join(dir, ".next/server/chunks"))).sort()).toEqual(["a.js", "a.js.map"])
  })

  it("removes every map with keepMaps: false", async () => {
    const dir = await nextOutput()
    const config = withBertha({}, { release: "abc", keepMaps: false }) as { compiler: { runAfterProductionCompile: Hook } }
    await config.compiler.runAfterProductionCompile({ distDir: join(dir, ".next"), projectDir: dir })
    expect(await readdir(join(dir, ".next/server/chunks"))).toEqual(["a.js"])
  })

  it("runs the hook it wraps first", async () => {
    const dir = await nextOutput()
    const calls: string[] = []
    const config = withBertha({ compiler: { runAfterProductionCompile: async () => void calls.push("previous") } }) as {
      compiler: { runAfterProductionCompile: Hook }
    }
    await config.compiler.runAfterProductionCompile({ distDir: join(dir, ".next"), projectDir: dir })
    expect(calls).toEqual(["previous"])
  })
})
