import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { withBertha } from "../src/next/config.ts"
import { mockBertha } from "./helpers.ts"

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

const VERCEL = ["VERCEL", "VERCEL_ENV", "VERCEL_GIT_COMMIT_SHA", "VERCEL_GIT_COMMIT_MESSAGE", "VERCEL_GIT_COMMIT_AUTHOR_NAME", "BERTHA_URL", "BERTHA_UPLOAD_KEY", "BERTHA_ENVIRONMENT"]
const saved = { ...process.env }
afterEach(() => {
  process.env = { ...saved }
  vi.restoreAllMocks()
})

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

  it("records the deploy on Vercel, with Vercel's commit", async () => {
    for (const k of VERCEL) delete process.env[k]
    const server = await mockBertha((r) => (r.path.endsWith("/deploys") ? { status: 201, body: { releaseId: "rel-9" } } : { status: 201, body: {} }))
    const sha = "4acb486f0e2c1d3b5a6978877665544332211009"
    Object.assign(process.env, {
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_SHA: sha,
      VERCEL_GIT_COMMIT_MESSAGE: "Fix the cart",
      VERCEL_GIT_COMMIT_AUTHOR_NAME: "Ana",
      BERTHA_URL: server.url,
      BERTHA_UPLOAD_KEY: "up",
    })
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const dir = await nextOutput()
    const config = withBertha({}, { release: sha }) as { compiler: { runAfterProductionCompile: Hook } }
    await config.compiler.runAfterProductionCompile({ distDir: join(dir, ".next"), projectDir: dir })
    const deploy = server.received.find((r) => r.path === "/ingest/v1/deploys")!
    expect(JSON.parse(deploy.body)).toEqual({ release: sha, environment: "preview", commit: { sha, message: "Fix the cart", author: "Ana" } })
    expect(log.mock.calls.map((c) => String(c[0]))).toContain(`[bertha] Recorded ${sha} in preview (rel-9).`)

    server.received.length = 0
    const off = withBertha({}, { release: sha, recordDeploy: false }) as { compiler: { runAfterProductionCompile: Hook } }
    await off.compiler.runAfterProductionCompile({ distDir: join(dir, ".next"), projectDir: dir })
    delete process.env.VERCEL
    await config.compiler.runAfterProductionCompile({ distDir: join(dir, ".next"), projectDir: dir })
    expect(server.received.some((r) => r.path === "/ingest/v1/deploys")).toBe(false)
    await server.close()
  })
})
