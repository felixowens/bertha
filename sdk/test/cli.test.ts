import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, expect, it } from "vitest"

import { main } from "../src/cli.ts"
import { mockBertha } from "./helpers.ts"

let server: Awaited<ReturnType<typeof mockBertha>> | undefined
const saved = { ...process.env }
beforeEach(() => {
  for (const k of ["BERTHA_URL", "NEXT_PUBLIC_BERTHA_URL", "VITE_BERTHA_URL", "BERTHA_UPLOAD_KEY", "BERTHA_RELEASE", "BERTHA_KEY", "NEXT_PUBLIC_BERTHA_KEY", "VITE_BERTHA_KEY"]) delete process.env[k]
})
afterEach(async () => {
  process.env = { ...saved }
  await server?.close()
  server = undefined
})

async function run(...argv: string[]) {
  const lines: string[] = []
  const code = await main(argv, (s) => lines.push(s))
  return { code, out: lines.join("\n") }
}

it("records a deploy with the commit", async () => {
  server = await mockBertha(() => ({ status: 201, body: { releaseId: "rel-1" } }))
  process.env.BERTHA_URL = server.url
  process.env.BERTHA_UPLOAD_KEY = "up"
  const { code, out } = await run("deploy", "--release", "2.4.1", "--env", "staging")
  expect([code, out]).toEqual([0, "Recorded 2.4.1 in staging (rel-1)."])
  const [r] = server.received
  expect(r).toMatchObject({ method: "POST", path: "/ingest/v1/deploys" })
  expect(r!.headers.authorization).toBe("Bearer up")
  const body = JSON.parse(r!.body) as { release: string; environment: string; commit?: { sha: string } }
  expect(body).toMatchObject({ release: "2.4.1", environment: "staging" })
  expect(body.commit?.sha).toMatch(/^[0-9a-f]{40}$/)
})

it("says why a deploy wasn't recorded", async () => {
  expect(await run("deploy", "--release", "1")).toEqual({ code: 1, out: "Set BERTHA_URL and BERTHA_UPLOAD_KEY, or pass --url and --key." })
  server = await mockBertha(() => ({ status: 401, body: { error: "Unknown upload key." } }))
  expect(await run("deploy", "--release", "1", "--url", server.url, "--key", "nope")).toEqual({
    code: 1,
    out: "bertha didn't record the deploy: Unknown upload key. (HTTP 401)",
  })
  expect((await run("deploy", "--release", "1", "--url", "http://127.0.0.1:9", "--key", "k")).out).toMatch(
    /^Couldn't reach bertha at http:\/\/127\.0\.0\.1:9/,
  )
})

it("uploads source maps from a directory", async () => {
  server = await mockBertha(() => ({ status: 201, body: {} }))
  const dir = await mkdtemp(join(tmpdir(), "bertha-cli-"))
  await writeFile(join(dir, "a.js"), "a()\n//# sourceMappingURL=a.js.map\n")
  await writeFile(join(dir, "a.js.map"), JSON.stringify({ version: 3, sources: ["a.ts"], names: [], mappings: "AAAA" }))
  const { code, out } = await run("sourcemaps", "upload", dir, "--release", "r9", "--url", server.url, "--key", "up")
  expect([code, out]).toEqual([0, "Uploaded 1 of 1 source maps for r9."])
})

it("helps", async () => {
  expect((await run("--help")).code).toBe(0)
  expect((await run()).code).toBe(2)
  const unknown = await run("launch")
  expect(unknown.code).toBe(2)
  expect(unknown.out).toMatch(/^Unknown command: launch/)
  expect((await run("sourcemaps", "upload")).out).toBe("Which directory? bertha sourcemaps upload <dir>")
})

it("sends a test event with the connection key", async () => {
  server = await mockBertha(() => ({ status: 202, body: { accepted: 1 } }))
  process.env.VITE_BERTHA_URL = server.url
  process.env.VITE_BERTHA_KEY = "ing"
  const { code, out } = await run("test")
  expect([code, out]).toEqual([0, `Sent a test event in development. Look for "bertha test event" in the project's issues; it's tagged test: true.`])
  const [r] = server.received
  expect(r).toMatchObject({ method: "POST", path: "/ingest/v1/events" })
  expect(r!.headers.authorization).toBe("Bearer ing")
  const { events } = JSON.parse(r!.body) as { events: { environment: string; exception: { message: string }; tags: Record<string, string> }[] }
  expect(events).toHaveLength(1)
  expect(events[0]).toMatchObject({ environment: "development", exception: { message: "bertha test event" }, tags: { test: "true" } })
})

it("says why a test event wasn't sent", async () => {
  expect(await run("test")).toEqual({ code: 1, out: "Set BERTHA_URL and BERTHA_KEY, or pass --url and --key." })
  server = await mockBertha(() => ({ status: 401, body: { error: "Unknown connection key." } }))
  expect(await run("test", "--url", server.url, "--key", "nope", "--env", "production")).toEqual({
    code: 1,
    out: "bertha didn't accept the test event: Unknown connection key. (HTTP 401)",
  })
})
