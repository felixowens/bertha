import { spawn } from "node:child_process"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { afterEach, expect, it, vi } from "vitest"

import type { IngestBatch } from "../src/generated/ingest.ts"
import { getClient } from "../src/core/hub.ts"
import { init, wrapHandler } from "../src/node/index.ts"
import { mockBertha } from "./helpers.ts"

let server: Awaited<ReturnType<typeof mockBertha>> | undefined
afterEach(async () => server?.close())

async function runScript(code: string, env: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), "bertha-node-"))
  const file = join(dir, "app.mts")
  await writeFile(file, code.replaceAll("SDK", resolve("src/node/index.ts")))
  return new Promise<{ code: number | null; stderr: string }>((done) => {
    const child = spawn(process.execPath, [file], { env: { ...process.env, ...env }, stdio: ["ignore", "ignore", "pipe"] })
    let stderr = ""
    child.stderr.on("data", (d: Buffer) => (stderr += d))
    child.on("exit", (code) => done({ code, stderr }))
  })
}

it("reports a crash, then exits as Node would", async () => {
  server = await mockBertha()
  const { code, stderr } = await runScript(
    `import { init } from "SDK"
     init()
     setTimeout(() => { throw new RangeError("Invalid count: -1") }, 10)`,
    { BERTHA_KEY: "ik", BERTHA_URL: server.url, BERTHA_RELEASE: "r2", NODE_ENV: "production" },
  )
  expect(code).toBe(1)
  expect(stderr).toContain("RangeError: Invalid count: -1")
  const heartbeat = server.received.find((r) => r.path === "/ingest/v1/heartbeat")
  expect(JSON.parse(heartbeat!.body)).toEqual({ environment: "production", release: "r2" })
  const events = server.received.find((r) => r.path === "/ingest/v1/events")!
  expect(events.headers.authorization).toBe("Bearer ik")
  const batch = JSON.parse(events.body) as IngestBatch
  expect(batch.sdk.name).toBe("bertha.node")
  expect(batch.events[0]).toMatchObject({
    level: "fatal",
    release: "r2",
    environment: "production",
    exception: { type: "RangeError", message: "Invalid count: -1" },
  })
  expect(batch.events[0]!.context?.runtime).toMatch(/^Node \d+/)
})

it("reports unhandled rejections and leaves other listeners in charge", async () => {
  server = await mockBertha()
  const { code } = await runScript(
    `import { init, flush } from "SDK"
     init({ heartbeat: false })
     process.on("unhandledRejection", () => {})
     Promise.reject(new Error("nobody caught me"))
     setTimeout(async () => { await flush(); process.exit(0) }, 300)`,
    { BERTHA_KEY: "ik", BERTHA_URL: server.url },
  )
  expect(code).toBe(0)
  const batch = JSON.parse(server.received.find((r) => r.path === "/ingest/v1/events")!.body) as IngestBatch
  expect(batch.events[0]!.exception!.message).toBe("nobody caught me")
})

it("wraps handlers, reporting with the request", async () => {
  server = await mockBertha()
  vi.spyOn(console, "warn").mockImplementation(() => {})
  init({ key: "ik", url: server.url, handlers: false, heartbeat: false })
  const handler = wrapHandler(async (req: { method: string; url: string; headers: Record<string, string> }) => {
    throw new Error(`no route for ${req.url}`)
  })
  await expect(handler({ method: "GET", url: "/cart?id=1", headers: { host: "shop.test" } })).rejects.toThrow("no route")
  await getClient()!.flush()
  const batch = JSON.parse(server.received[0]!.body) as IngestBatch
  expect(batch.events[0]!.request).toEqual({ method: "GET", url: "http://shop.test/cart?id=1" })
})
