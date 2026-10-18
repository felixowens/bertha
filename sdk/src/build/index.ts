// After a build: give each bundle that has a source map a debug id, upload the maps
// to bertha, and take them out of the output so they aren't served.
//
// The id goes in a line appended to the bundle. Appending (never prepending) keeps
// every existing mapping valid. A bundle that already has a debug id (from Sentry's
// plugin, or Rollup's `sourcemapDebugIds`) keeps it, and still gets bertha's line. At runtime that line records the bundle's own URL
// from `new Error().stack` against its id, so events can name the map for each frame
// wherever the file was served from.

import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { readdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join, relative, resolve, sep } from "node:path"
import { gzipSync } from "node:zlib"

export { detectRelease, lastCommit } from "./release.ts"

const JS = /\.(?:m|c)?js$/
const ORPHAN_MAP = /\.(?:m|c)?js\.map$/
const MAP_COMMENT = /\n?\/\/[#@] sourceMappingURL=(\S+)[ \t]*\r?\n?$/
const DEBUG_ID_COMMENT = /\/\/# debugId=([0-9a-fA-F-]{36})/
/** In every bundle this step has already stamped, so a second run changes nothing. */
const REGISTERED = "g.__berthaIds="
const CONCURRENCY = 4
const UPLOAD_TIMEOUT_MS = 60_000

export interface ProcessOptions {
  /** The build output. */
  dir: string
  release?: string
  /** bertha's URL. Without it (or the key) nothing is uploaded. */
  url?: string
  /** The project's upload key (BERTHA_UPLOAD_KEY). */
  uploadKey?: string
  /** Keep the .map files in the output. A function decides per bundle. Default false. */
  keepMaps?: boolean | ((file: string) => boolean)
  /** Directory names to skip. */
  skip?: string[]
  log?: (message: string) => void
  fetch?: typeof fetch
}

export interface Processed {
  file: string
  debugId: string
  uploaded: boolean
  error?: string
}

export interface Report {
  files: Processed[]
  uploaded: number
  failed: number
  /** Leftover .js.map files removed because no bundle referenced them. */
  removedOrphans: number
  /** Why nothing was uploaded, when nothing was. */
  skipped?: string
}

export async function processDirectory(o: ProcessOptions): Promise<Report> {
  const root = resolve(o.dir)
  const log = o.log ?? (() => {})
  const skip = new Set(["node_modules", ...(o.skip ?? [])])
  const bundles = (await walk(root, skip)).filter((f) => JS.test(f))
  const found: { file: string; code: string; map: MapSource }[] = []
  for (const file of bundles) {
    const code = await readFile(file, "utf8")
    const map = await findMap(file, code)
    if (map) found.push({ file, code, map })
  }

  const canUpload = !!(o.url && o.uploadKey)
  const report: Report = {
    files: [],
    uploaded: 0,
    failed: 0,
    removedOrphans: 0,
    skipped: canUpload ? undefined : "No upload key or URL, so the maps stay local.",
  }

  await pool(found, CONCURRENCY, async ({ file, code, map }) => {
    const debugId = DEBUG_ID_COMMENT.exec(code)?.[1]?.toLowerCase() ?? idFor(code)
    const rel = relative(root, file).split(sep).join("/")
    const keep = typeof o.keepMaps === "function" ? o.keepMaps(rel) : !!o.keepMaps
    const json = JSON.parse(map.text) as Record<string, unknown>
    json.debugId = debugId
    const mapText = JSON.stringify(json)

    let out = code.includes(REGISTERED) ? code : stamp(code, debugId, o.release, !DEBUG_ID_COMMENT.test(code))
    if (keep && map.path) await writeFile(map.path, mapText)
    else if (!keep) {
      out = out.replace(MAP_COMMENT, "\n")
      if (map.path) await rm(map.path, { force: true })
    }
    if (out !== code) await writeFile(file, out)

    const entry: Processed = { file: rel, debugId, uploaded: false }
    if (canUpload) {
      try {
        await upload(o, { debugId, file: rel, release: o.release }, mapText)
        entry.uploaded = true
        report.uploaded++
      } catch (e) {
        entry.error = e instanceof Error ? e.message : String(e)
        report.failed++
      }
    }
    report.files.push(entry)
  })
  // Maps no bundle points at (renamed polyfills and the like) are source code too.
  if (o.keepMaps !== true) {
    const keepFn = typeof o.keepMaps === "function" ? o.keepMaps : undefined
    for (const f of await walk(root, skip)) {
      if (!ORPHAN_MAP.test(f) || !existsSync(f)) continue
      if (keepFn?.(relative(root, f.replace(/\.map$/, "")).split(sep).join("/"))) continue
      await rm(f, { force: true })
      report.removedOrphans++
    }
  }
  report.files.sort((a, b) => a.file.localeCompare(b.file))
  for (const f of report.files) if (f.error) log(`Couldn't upload the map for ${f.file}: ${f.error}`)
  if (found.length === 0) log(`No bundles with source maps in ${o.dir}.`)
  else if (canUpload) log(`Uploaded ${report.uploaded} of ${found.length} source maps${o.release ? ` for ${o.release}` : ""}.`)
  else log(`Stamped ${found.length} bundles with debug ids. ${report.skipped}`)
  return report
}

type MapSource = { text: string; path?: string }

async function findMap(file: string, code: string): Promise<MapSource | undefined> {
  const ref = MAP_COMMENT.exec(code)?.[1]
  if (ref?.startsWith("data:")) {
    const comma = ref.indexOf(",")
    const data = ref.slice(comma + 1)
    const text = ref.slice(0, comma).endsWith(";base64")
      ? Buffer.from(data, "base64").toString("utf8")
      : decodeURIComponent(data)
    return { text }
  }
  const candidates = ref && !/^[a-z]+:/i.test(ref) ? [join(dirname(file), decodeURI(ref.split("?")[0]!))] : []
  candidates.push(`${file}.map`)
  for (const path of candidates) {
    if (existsSync(path)) return { text: await readFile(path, "utf8"), path }
  }
  return undefined
}

/** A stable UUID from the bundle's content, so rebuilding the same code gives the same id. */
export function idFor(code: string): string {
  const h = createHash("sha256").update(code).digest("hex")
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/**
 * The line appended to a bundle. Runs once when the bundle loads; never throws.
 * `comment: false` leaves out the `//# debugId=` comment, for a bundle that has one.
 */
export function snippet(debugId: string, release?: string, comment = true): string {
  const r = release ? `g.__berthaRelease=${JSON.stringify(release)}` : ""
  return (
    `;!function(){try{var g=typeof globalThis<"u"?globalThis:self,s=(new Error).stack;` +
    `s&&((${REGISTERED}g.__berthaIds||{})[s]="${debugId}");${r}}catch(e){}}();\n` +
    (comment ? `//# debugId=${debugId}\n` : "")
  )
}

/** Appends the snippet, before a trailing sourceMappingURL comment if there is one. */
export function stamp(code: string, debugId: string, release?: string, comment = true): string {
  const m = MAP_COMMENT.exec(code)
  const body = m ? code.slice(0, m.index) : code
  const tail = m ? m[0].replace(/^\n?/, "") : ""
  return `${body.endsWith("\n") ? body : `${body}\n`}${snippet(debugId, release, comment)}${tail}`
}

async function upload(
  o: ProcessOptions,
  q: { debugId: string; file: string; release?: string },
  map: string,
): Promise<void> {
  const f = o.fetch ?? fetch
  const params = new URLSearchParams({ debugId: q.debugId, file: q.file })
  if (q.release) params.set("release", q.release)
  const res = await f(`${o.url!.replace(/\/+$/, "")}/ingest/v1/sourcemaps?${params}`, {
    method: "POST",
    headers: { authorization: `Bearer ${o.uploadKey}`, "content-type": "application/json" },
    body: new Uint8Array(gzipSync(map)),
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(await reason(res))
}

export async function reason(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    if (body.error) return `${body.error} (HTTP ${res.status})`
  } catch {
    // not JSON
  }
  return `HTTP ${res.status}`
}

async function walk(dir: string, skip: Set<string>): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!skip.has(entry.name)) out.push(...(await walk(path, skip)))
    } else if (entry.isFile()) out.push(path)
  }
  return out
}

async function pool<T>(items: T[], n: number, run: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const worker = async () => {
    while (next < items.length) await run(items[next++]!)
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker))
}
