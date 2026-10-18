import { mkdtemp, readdir, readFile, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runInNewContext } from "node:vm"

import { build } from "esbuild"
import { afterEach, describe, expect, it } from "vitest"

import { idFor, processDirectory, stamp } from "../src/build/index.ts"
import { mockBertha } from "./helpers.ts"

const SOURCE = `export function total(lines) {
  return lines.reduce((sum, line) => sum + line.price * line.qty, 0)
}
globalThis.run = () => total([{ qty: 1 }, undefined])
`

async function bundle(opts: { sourcemap: "linked" | "external" | "inline"; format?: "esm" | "iife" }) {
  const dir = await mkdtemp(join(tmpdir(), "bertha-build-"))
  await writeFile(join(dir, "cart.js"), SOURCE)
  await mkdir(join(dir, "dist", "assets"), { recursive: true })
  await build({
    entryPoints: [join(dir, "cart.js")],
    outfile: join(dir, "dist", "assets", "index-4f9a.js"),
    bundle: true,
    minify: true,
    sourcemap: opts.sourcemap,
    format: opts.format ?? "iife",
    logLevel: "silent",
  })
  return { dir, out: join(dir, "dist"), js: join(dir, "dist", "assets", "index-4f9a.js") }
}

let server: Awaited<ReturnType<typeof mockBertha>> | undefined
afterEach(async () => {
  await server?.close()
  server = undefined
})

describe("processDirectory", () => {
  it("stamps, uploads and removes maps", async () => {
    server = await mockBertha(() => ({ status: 201, body: { debugId: "x", sources: 1 } }))
    const { out, js } = await bundle({ sourcemap: "linked" })
    const before = await readFile(js, "utf8")
    const original = before.replace(/\/\/# sourceMappingURL=.*\n?$/, "")
    const logs: string[] = []
    const report = await processDirectory({ dir: out, release: "abc123", url: server.url, uploadKey: "up", log: (m) => logs.push(m) })

    const after = await readFile(js, "utf8")
    const id = idFor(before)
    expect(report).toMatchObject({ uploaded: 1, failed: 0, files: [{ file: "assets/index-4f9a.js", debugId: id, uploaded: true }] })
    // Existing code is untouched, so every mapping still points at the same place.
    expect(after.startsWith(original)).toBe(true)
    expect(after).toContain(`//# debugId=${id}`)
    expect(after).not.toContain("sourceMappingURL")
    expect(await readdir(join(out, "assets"))).toEqual(["index-4f9a.js"])
    expect(logs).toEqual(["Uploaded 1 of 1 source maps for abc123."])

    const [up] = server.received
    expect(up).toMatchObject({ method: "POST", path: "/ingest/v1/sourcemaps", gzipped: true })
    expect(up!.headers.authorization).toBe("Bearer up")
    expect(Object.fromEntries(up!.query)).toEqual({ debugId: id, file: "assets/index-4f9a.js", release: "abc123" })
    const map = JSON.parse(up!.body) as { debugId: string; sources: string[]; sourcesContent: string[] }
    expect(map.debugId).toBe(id)
    expect(map.sourcesContent[0]).toBe(SOURCE)

    // The stamped bundle still runs, and registers its own location against the id.
    const g: Record<string, unknown> = { Error }
    g.globalThis = g
    runInNewContext(after, g, { filename: "https://shop.test/assets/index-4f9a.js" })
    const ids = g.__berthaIds as Record<string, string>
    const [stack] = Object.keys(ids)
    expect(stack).toContain("https://shop.test/assets/index-4f9a.js")
    expect(ids[stack!]).toBe(id)
    expect(g.__berthaRelease).toBe("abc123")
  })

  it("is safe to run twice and keeps maps when asked", async () => {
    const { out, js } = await bundle({ sourcemap: "linked", format: "esm" })
    const first = await processDirectory({ dir: out, keepMaps: true })
    expect(first.skipped).toContain("No upload key")
    const once = await readFile(js, "utf8")
    expect(once).toMatch(/\/\/# debugId=.*\n\/\/# sourceMappingURL=index-4f9a\.js\.map\n?$/)
    const map = JSON.parse(await readFile(`${js}.map`, "utf8")) as { debugId: string }
    expect(map.debugId).toBe(first.files[0]!.debugId)

    const second = await processDirectory({ dir: out, keepMaps: true })
    expect(second.files[0]!.debugId).toBe(first.files[0]!.debugId)
    expect(await readFile(js, "utf8")).toBe(once)
  })

  it("keeps a debug id another tool stamped, and still registers it at runtime", async () => {
    server = await mockBertha(() => ({ status: 201, body: {} }))
    const { out, js } = await bundle({ sourcemap: "linked" })
    // What Sentry's plugin leaves: its own snippet and a debugId comment, upper case.
    const theirs = "8B0D2E6C-3F1A-4C5D-9E7F-1A2B3C4D5E6F"
    const code = (await readFile(js, "utf8")).replace(
      /\/\/# sourceMappingURL=/,
      `;_sentryDebugIds={};\n//# debugId=${theirs}\n//# sourceMappingURL=`,
    )
    await writeFile(js, code)
    const report = await processDirectory({ dir: out, url: server.url, uploadKey: "up" })

    const id = theirs.toLowerCase()
    expect(report.files[0]!.debugId).toBe(id)
    expect(Object.fromEntries(server.received[0]!.query).debugId).toBe(id)
    const after = await readFile(js, "utf8")
    expect(after.match(/\/\/# debugId=/g)).toHaveLength(1)
    const g: Record<string, unknown> = { Error }
    g.globalThis = g
    runInNewContext(after, g, { filename: "https://shop.test/assets/index-4f9a.js" })
    expect(Object.values(g.__berthaIds as Record<string, string>)).toEqual([id])

    await processDirectory({ dir: out })
    expect(await readFile(js, "utf8")).toBe(after)
  })

  it("reads inline maps and sibling maps without a comment", async () => {
    server = await mockBertha(() => ({ status: 201, body: {} }))
    const inline = await bundle({ sourcemap: "inline" })
    const r1 = await processDirectory({ dir: inline.out, url: server.url, uploadKey: "up" })
    expect(r1.uploaded).toBe(1)
    expect(await readFile(inline.js, "utf8")).not.toContain("data:application/json")

    const hidden = await bundle({ sourcemap: "external" })
    await writeFile(join(hidden.out, "assets", "polyfill-renamed.js.map"), "{}")
    const r2 = await processDirectory({ dir: hidden.out, url: server.url, uploadKey: "up" })
    expect(r2).toMatchObject({ uploaded: 1, removedOrphans: 1 })
    expect(await readdir(join(hidden.out, "assets"))).toEqual(["index-4f9a.js"])
  })

  it("reports refused uploads with bertha's reason", async () => {
    server = await mockBertha(() => ({ status: 403, body: { error: "That's the ingest key." } }))
    const { out } = await bundle({ sourcemap: "linked" })
    const logs: string[] = []
    const report = await processDirectory({ dir: out, url: server.url, uploadKey: "ingest", log: (m) => logs.push(m) })
    expect(report.failed).toBe(1)
    expect(logs[0]).toBe("Couldn't upload the map for assets/index-4f9a.js: That's the ingest key. (HTTP 403)")
  })

  it("puts the snippet before a trailing map comment", () => {
    expect(stamp("a()\n//# sourceMappingURL=a.js.map", "id")).toMatch(/^a\(\)\n;!function.*\n\/\/# debugId=id\n\/\/# sourceMappingURL=a\.js\.map$/)
    expect(stamp("a()", "id")).toMatch(/^a\(\)\n;!function.*\n\/\/# debugId=id\n$/)
  })

  it("derives a stable v4-shaped uuid", () => {
    expect(idFor("x")).toBe(idFor("x"))
    expect(idFor("x")).not.toBe(idFor("y"))
    expect(idFor("x")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
