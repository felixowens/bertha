import { spawn } from "node:child_process"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

import { afterEach, expect, it, vi } from "vitest"

import type { IngestBatch } from "../src/generated/ingest.ts"
import { getClient } from "../src/core/hub.ts"
import { init, wrapHandler } from "../src/node/index.ts"
import { mockBertha } from "./helpers.ts"

let server: Awaited<ReturnType<typeof mockBertha>> | undefined
afterEach(async () => server?.close())

async function runScript(code: string, env: Record<string, string>, files: Record<string, string> = {}) {
  const dir = await mkdtemp(join(tmpdir(), "bertha-node-"))
  const file = join(dir, "app.mts")
  await writeFile(file, code.replaceAll("SDK", resolve("src/node/index.ts")))
  for (const [name, text] of Object.entries(files)) {
    await mkdir(dirname(join(dir, name)), { recursive: true })
    await writeFile(join(dir, name), text)
  }
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
    { BERTHA_KEY: "ik", BERTHA_URL: server.url, BERTHA_RELEASE: "r2", BERTHA_COMMIT: "9F8E7D6", NODE_ENV: "production" },
  )
  expect(code).toBe(1)
  expect(stderr).toContain("RangeError: Invalid count: -1")
  const heartbeat = server.received.find((r) => r.path === "/ingest/v1/heartbeat")
  expect(JSON.parse(heartbeat!.body)).toEqual({ environment: "production", release: "r2", commit: "9f8e7d6" })
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

it("still exits beside another error SDK's crash handler", async () => {
  server = await mockBertha()
  const { code, stderr } = await runScript(
    `import { init } from "SDK"
     init({ heartbeat: false })
     // Sentry's handler, which leaves the exit to any listener it doesn't recognise.
     process.on("uncaughtException", Object.assign(() => {}, { _errorHandler: true }))
     setTimeout(() => { throw new Error("seen by both reporters") }, 10)`,
    { BERTHA_KEY: "ik", BERTHA_URL: server.url },
  )
  expect(code).toBe(1)
  expect(stderr).toContain("seen by both reporters")
  const batch = JSON.parse(server.received.find((r) => r.path === "/ingest/v1/events")!.body) as IngestBatch
  expect(batch.events[0]!.exception!.message).toBe("seen by both reporters")
})

it("marks its handlers so other error SDKs don't wait on them", async () => {
  server = await mockBertha()
  const { code } = await runScript(
    `import { init } from "SDK"
     init({ heartbeat: false })
     const marked = (e) => process.listeners(e).every((l) => l._errorHandler === true)
     process.exit(marked("uncaughtException") && marked("unhandledRejection") ? 0 : 2)`,
    { BERTHA_KEY: "ik", BERTHA_URL: server.url },
  )
  expect(code).toBe(0)
})

it("leaves the exit to the app's own uncaught exception handler", async () => {
  server = await mockBertha()
  const { code } = await runScript(
    `import { init, flush } from "SDK"
     init({ heartbeat: false })
     process.on("uncaughtException", () => {})
     setTimeout(() => { throw new Error("the app handles this") }, 10)
     setTimeout(async () => { await flush(); process.exit(0) }, 300)`,
    { BERTHA_KEY: "ik", BERTHA_URL: server.url },
  )
  expect(code).toBe(0)
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

async function capturedFrames(code: string, files?: Record<string, string>) {
  server = await mockBertha()
  const { code: exit, stderr } = await runScript(code, { BERTHA_KEY: "ik", BERTHA_URL: server.url }, files)
  expect(stderr).toBe("")
  expect(exit).toBe(0)
  const batch = JSON.parse(server.received.find((r) => r.path === "/ingest/v1/events")!.body) as IngestBatch
  return batch.events[0]!.exception!.frames
}

it("sends the source lines around frames in the app's own files", async () => {
  const frames = await capturedFrames(
    `import { init, captureException, flush } from "SDK"
     init({ heartbeat: false })
     ${"\n".repeat(8)}
     function checkout() {
       throw new Error("no basket")
     }
     try { checkout() } catch (e) { captureException(e) }
     await flush()
     ${"\n".repeat(8)}`,
  )
  const top = frames[0]!
  expect(top.file).toMatch(/^file:\/\/.*app\.mts$/)
  expect(top.context!.startLine).toBe(top.line! - 5)
  expect(top.context!.lines).toHaveLength(11)
  expect(top.context!.lines[top.line! - top.context!.startLine]).toContain(`throw new Error("no basket")`)
})

it("keeps enough frames to reach the app beneath a deep library", async () => {
  const frames = await capturedFrames(
    `import { init, captureException, flush } from "SDK"
     import { deep } from "./node_modules/lib/index.mjs"
     init({ heartbeat: false })
     function loadFaqs() { deep(30) }
     try { loadFaqs() } catch (e) { captureException(e) }
     await flush()`,
    { "node_modules/lib/index.mjs": `export function deep(n) { if (n === 0) throw new Error("bad filter"); deep(n - 1) }` },
  )
  expect(frames.length).toBeGreaterThan(30)
  const lib = frames[0]!
  expect(lib.inApp).toBe(false)
  expect(lib.context).toBeUndefined()
  const app = frames.find((f) => f.function === "loadFaqs")!
  expect(app.context!.lines.join("\n")).toContain("deep(30)")
})

it("leaves a frame limit the app set, and sends no lines when asked not to", async () => {
  const frames = await capturedFrames(
    `import { init, captureException, flush } from "SDK"
     Error.stackTraceLimit = 3
     init({ heartbeat: false, contextLines: false })
     function a(n) { if (n === 0) throw new Error("x"); a(n - 1) }
     try { a(10) } catch (e) { captureException(e) }
     await flush()`,
  )
  expect(frames).toHaveLength(3)
  expect(frames.every((f) => f.context === undefined)).toBe(true)
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
