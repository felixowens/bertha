// Source lines for frames in the app's own files. Code that Node runs as-is (no bundler)
// has no source map, so the lines come from disk; bertha prefers a map when there is one.

import { readFileSync, statSync } from "node:fs"
import { isAbsolute } from "node:path"
import { fileURLToPath } from "node:url"

import type { IngestFrame } from "../generated/ingest.ts"

/** Lines either side of the frame's line, as bertha shows them. */
export const CONTEXT_LINES = 5
/** Longer lines are cut, as bertha would. */
export const LINE_CHARS = 300
/** Frames per exception that get lines: the ones nearest the throw matter most. */
export const CONTEXT_FRAMES = 20
/** Bigger files are build output, not source worth reading. */
const FILE_BYTES = 1024 * 1024
const CACHED_FILES = 100

// File → its lines, or null when it can't be read. Oldest first, for eviction.
const cache = new Map<string, string[] | null>()

export function addContext(frames: IngestFrame[]): void {
  let done = 0
  for (const f of frames) {
    if (done >= CONTEXT_FRAMES) break
    if (f.inApp === false || f.line === undefined || f.context) continue
    const lines = read(f.file)
    if (!lines || f.line > lines.length) continue
    const start = Math.max(1, f.line - CONTEXT_LINES)
    f.context = { startLine: start, lines: lines.slice(start - 1, f.line + CONTEXT_LINES).map(cut) }
    done++
  }
}

function read(file: string): string[] | null {
  const path = toPath(file)
  if (!path) return null
  const hit = cache.get(path)
  if (hit !== undefined) return hit
  let lines: string[] | null = null
  try {
    if (statSync(path).size <= FILE_BYTES) lines = readFileSync(path, "utf8").split(/\r?\n/)
  } catch {
    // Gone, moved or unreadable: no lines, and no second try.
  }
  cache.set(path, lines)
  if (cache.size > CACHED_FILES) cache.delete(cache.keys().next().value!)
  return lines
}

function toPath(file: string): string | undefined {
  if (file.startsWith("file://")) {
    try {
      return fileURLToPath(file)
    } catch {
      return undefined
    }
  }
  return isAbsolute(file) ? file : undefined
}

function cut(line: string): string {
  return line.length > LINE_CHARS ? `${line.slice(0, LINE_CHARS - 1)}…` : line
}

/** For tests. */
export function clearContextCache(): void {
  cache.clear()
}
