// Stack strings into frames, innermost first. V8 (Chrome, Node, Edge, Deno) and
// SpiderMonkey/JavaScriptCore (Firefox, Safari) formats.

import type { IngestFrame } from "../generated/ingest.ts"

const V8 = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/
const GECKO = /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/
/** Safari's frame in code with no URL, like a script the browser injects: `name@`, `global code@`. */
const NO_URL = /^\s*([^\s@]*|\w+ code)@\s*$/

export const MAX_FRAMES = 100

export function parseStack(stack: string | undefined): IngestFrame[] {
  if (!stack) return []
  const frames: IngestFrame[] = []
  for (const line of stack.split("\n")) {
    const m = V8.exec(line) ?? GECKO.exec(line)
    if (!m) {
      const bare = NO_URL.exec(line)
      if (bare) frames.push(frameAt(NO_FILE, cleanFunction(bare[1])))
      if (frames.length >= MAX_FRAMES) break
      continue
    }
    const [, fn, rawFile, ln, col] = m
    // `at async /app/x.js:1:2`, an unnamed async frame, has no parentheses to split on.
    let file = fn ? rawFile! : rawFile!.replace(/^async /, "")
    // `at eval (eval at f (file.js:1:2), <anonymous>:1:1)`: keep the outer file.
    const evalAt = /\(eval at .*?\((.+?):\d+:\d+\)/.exec(line)
    if (evalAt) file = evalAt[1]!
    if (file === "<anonymous>" || file === "native") continue
    frames.push(frameAt(file, cleanFunction(fn), Number(ln), Number(col)))
    if (frames.length >= MAX_FRAMES) break
  }
  return frames
}

/** The file of code with no URL, like a script the browser injects. */
export const NO_FILE = "<anonymous>"

export function frameAt(file: string, name?: string, line?: number, column?: number): IngestFrame {
  const frame: IngestFrame = { file }
  if (name) frame.function = name
  if (line) frame.line = line
  if (column) frame.column = column
  if (isLibrary(file)) frame.inApp = false
  return frame
}

function cleanFunction(fn: string | undefined): string | undefined {
  if (!fn) return undefined
  const name = fn.replace(/^async /, "").replace(/^new /, "").replace(/ \[as .+\]$/, "").trim()
  if (!name || name === "<anonymous>" || name === "Object.<anonymous>") return undefined
  return name
}

/** Safari masks extension and injected scripts as `webkit-masked-url://hidden/`. */
const EXTENSION = /^(?:webkit-masked-url|safari-(?:web-)?extension|chrome-extension|moz-extension|ms-browser-extension):\/\//

/** Library code: the server decides the rest from the path. Code with no URL is never the app's bundle. */
export function isLibrary(file: string): boolean {
  return file === NO_FILE || file.includes("/node_modules/") || file.startsWith("node:") || file.startsWith("internal/") || EXTENSION.test(file)
}
