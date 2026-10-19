// Stack strings into frames, innermost first. V8 (Chrome, Node, Edge, Deno) and
// SpiderMonkey/JavaScriptCore (Firefox, Safari) formats.

import type { IngestFrame } from "../generated/ingest.ts"

const V8 = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/
const GECKO = /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/

export const MAX_FRAMES = 100

export function parseStack(stack: string | undefined): IngestFrame[] {
  if (!stack) return []
  const frames: IngestFrame[] = []
  for (const line of stack.split("\n")) {
    const m = V8.exec(line) ?? GECKO.exec(line)
    if (!m) continue
    const [, fn, rawFile, ln, col] = m
    // `at async /app/x.js:1:2`, an unnamed async frame, has no parentheses to split on.
    let file = fn ? rawFile! : rawFile!.replace(/^async /, "")
    // `at eval (eval at f (file.js:1:2), <anonymous>:1:1)`: keep the outer file.
    const evalAt = /\(eval at .*?\((.+?):\d+:\d+\)/.exec(line)
    if (evalAt) file = evalAt[1]!
    if (file === "<anonymous>" || file === "native") continue
    const name = cleanFunction(fn)
    const frame: IngestFrame = { file, line: Number(ln), column: Number(col) }
    if (name) frame.function = name
    if (isLibrary(file)) frame.inApp = false
    frames.push(frame)
    if (frames.length >= MAX_FRAMES) break
  }
  return frames
}

function cleanFunction(fn: string | undefined): string | undefined {
  if (!fn) return undefined
  const name = fn.replace(/^async /, "").replace(/^new /, "").replace(/ \[as .+\]$/, "").trim()
  if (!name || name === "<anonymous>" || name === "Object.<anonymous>") return undefined
  return name
}

/** Safari masks extension and injected scripts as `webkit-masked-url://hidden/`. */
const EXTENSION = /^(?:webkit-masked-url|safari-(?:web-)?extension|chrome-extension|moz-extension|ms-browser-extension):\/\//

/** Library code: the server decides the rest from the path. */
export function isLibrary(file: string): boolean {
  return file.includes("/node_modules/") || file.startsWith("node:") || file.startsWith("internal/") || EXTENSION.test(file)
}
