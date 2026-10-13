#!/usr/bin/env node
/**
 * design-lint.ts — invariants as checks, not prompt-nagging.
 *
 * Enforces token discipline mechanically. Flags and exits non-zero on:
 *   1. raw color utilities      text-white, bg-black, bg-gray-100, text-blue-600 …
 *   2. arbitrary color values   bg-[#fff], text-[rgb(...)], border-[hsl(...)], -[oklch(...)]
 *   3. inline color styles      style={{ color / background … }}
 *   4. the outline-light-text trap  <… variant="outline" … text-white/-primary-foreground …>
 *
 * Usage:
 *   node .prototype/design-lint.ts [paths…]   # standalone, exit 1 on issues
 *   node .prototype/design-lint.ts --hook      # PostToolUse hook (reads stdin JSON, exit 2 on issues)
 *
 * Escape hatches: .prototype/allowlist.txt (substrings/paths to ignore) and an
 * inline `design-lint-disable-line` / `design-lint-disable-next-line` comment.
 *
 * Pure core (lintText) + imperative shell. Zero dependencies.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, extname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(SCRIPT_DIR, "..")
const SRC = join(ROOT, "src")
const LINT_EXT = new Set([".tsx", ".jsx", ".ts", ".js", ".mts", ".cts"])

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose"
const PREFIX =
  "text|bg|border|ring|fill|stroke|decoration|outline|divide|from|via|to|placeholder|caret|accent|ring-offset|shadow"
const LIGHT_TEXT = ["text-white", "text-background", "text-primary-foreground", "text-card", "text-popover"]

type Rule = { id: string; re: RegExp; hint: string }
const RULES: readonly Rule[] = [
  {
    id: "raw-bw",
    re: new RegExp(`\\b(?:${PREFIX})-(?:white|black)\\b`),
    hint: "raw color — use a token (bg-background, bg-card, text-foreground, text-muted-foreground, border-border)",
  },
  {
    id: "raw-palette",
    re: new RegExp(`\\b(?:${PREFIX})-(?:${PALETTE})-(?:50|100|200|300|400|500|600|700|800|900|950)\\b`),
    hint: "raw palette color — map it to a semantic token in src/index.css and use that token",
  },
  {
    id: "arbitrary-color",
    re: new RegExp(`\\b(?:${PREFIX})-\\[\\s*(?:#|rgba?\\(|hsla?\\(|oklch\\(|oklab\\(|color\\()`),
    hint: "arbitrary color value — define a token in src/index.css instead of inlining a color",
  },
  {
    id: "arbitrary-color-prop",
    re: /\b(?:color|background(?:-color)?):\[/,
    hint: "arbitrary color property — use a token-backed utility",
  },
]

const INLINE_STYLE = /style=(?:\{\{([^}]*)\}\}|"([^"]*)")/g
const STYLE_COLORISH = /(?:^|[^-])(color|background)\b|#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|oklab\(/

export type Issue = { file: string; line: number; col: number; rule: string; text: string; hint: string }

const isDisabled = (lines: string[], idx: number): boolean => {
  const self = lines[idx] ?? ""
  const prev = idx > 0 ? lines[idx - 1] ?? "" : ""
  return self.includes("design-lint-disable-line") || prev.includes("design-lint-disable-next-line")
}

/** Pure: find the JSX opening tag enclosing position `pos` and return its text. */
const enclosingTag = (content: string, pos: number): string => {
  const start = content.lastIndexOf("<", pos)
  if (start < 0) return ""
  const end = content.indexOf(">", pos)
  return content.slice(start, end < 0 ? content.length : end + 1)
}

const lineColAt = (content: string, pos: number): { line: number; col: number } => {
  let line = 1
  let last = -1
  for (let i = 0; i < pos; i++) {
    if (content[i] === "\n") {
      line++
      last = i
    }
  }
  return { line, col: pos - last }
}

/** Pure core: lint one file's content. */
export function lintText(file: string, content: string, allow: readonly string[]): Issue[] {
  const lines = content.split("\n")
  const issues: Issue[] = []
  const allowed = (text: string) => allow.some((a) => a.length > 0 && text.includes(a))

  lines.forEach((raw, i) => {
    if (isDisabled(lines, i) || allowed(raw)) return
    for (const rule of RULES) {
      const re = new RegExp(rule.re.source, "g")
      for (const m of raw.matchAll(re)) {
        issues.push({ file, line: i + 1, col: m.index + 1, rule: rule.id, text: m[0], hint: rule.hint })
      }
    }
    // inline style with a color
    INLINE_STYLE.lastIndex = 0
    let sm: RegExpExecArray | null
    while ((sm = INLINE_STYLE.exec(raw)) !== null) {
      const body = sm[1] ?? sm[2] ?? ""
      if (STYLE_COLORISH.test(body)) {
        issues.push({
          file,
          line: i + 1,
          col: sm.index + 1,
          rule: "inline-style-color",
          text: sm[0].slice(0, 40),
          hint: "inline color style — move the color to a token-based class",
        })
      }
    }
  })

  // outline + light-text trap (needs tag context, so scan the whole file)
  const outline = /variant=(?:"outline"|'outline'|\{["']outline["']\})/g
  let om: RegExpExecArray | null
  while ((om = outline.exec(content)) !== null) {
    const tag = enclosingTag(content, om.index)
    const light = LIGHT_TEXT.find((c) => new RegExp(`\\b${c}\\b`).test(tag))
    if (light && !allowed(tag)) {
      const { line, col } = lineColAt(content, om.index)
      issues.push({
        file,
        line,
        col,
        rule: "outline-light-text",
        text: `variant="outline" + ${light}`,
        hint: 'outline keeps bg-background, so light text vanishes — use variant="default"/"hero" or an explicit dark surface',
      })
    }
  }

  return issues.sort((a, b) => a.line - b.line || a.col - b.col)
}

// ── imperative shell ─────────────────────────────────────────────────────────
function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(p))
    else if (LINT_EXT.has(extname(entry.name))) out.push(p)
  }
  return out
}

function loadAllowlist(): string[] {
  const p = join(SCRIPT_DIR, "allowlist.txt")
  if (!existsSync(p)) return []
  return readFileSync(p, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
}

function report(issues: Issue[]): string {
  if (issues.length === 0) return ""
  const byFile = new Map<string, Issue[]>()
  for (const it of issues) (byFile.get(it.file) ?? byFile.set(it.file, []).get(it.file)!).push(it)
  const out: string[] = [`design-lint: ${issues.length} issue(s) — every color must come from a token.\n`]
  for (const [file, list] of byFile) {
    out.push(relative(ROOT, file))
    for (const it of list) out.push(`  ${it.line}:${it.col}  ${it.text}\n        → ${it.hint}`)
    out.push("")
  }
  return out.join("\n")
}

function lintFiles(files: string[], allow: string[]): Issue[] {
  return files
    .filter((f) => existsSync(f) && statSync(f).isFile() && LINT_EXT.has(extname(f)))
    .flatMap((f) => lintText(f, readFileSync(f, "utf8"), allow))
}

function readStdin(): Promise<string> {
  return new Promise((res) => {
    let data = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (c) => (data += c))
    process.stdin.on("end", () => res(data))
    process.stdin.on("error", () => res(data))
  })
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const allow = loadAllowlist()

  if (args.includes("--hook")) {
    // PostToolUse: lint only the edited file if it lives under src/.
    const raw = await readStdin()
    let filePath = ""
    try {
      filePath = JSON.parse(raw)?.tool_input?.file_path ?? ""
    } catch {
      /* no payload — nothing to lint */
    }
    if (!filePath) process.exit(0)
    const abs = resolve(filePath)
    if (!abs.startsWith(SRC) || !LINT_EXT.has(extname(abs))) process.exit(0)
    const issues = lintFiles([abs], allow)
    if (issues.length > 0) {
      process.stderr.write(report(issues))
      process.exit(2) // surfaces stderr to the agent for self-correction
    }
    process.exit(0)
  }

  const targets = args.filter((a) => !a.startsWith("-"))
  const files = targets.length > 0 ? targets.flatMap((t) => (statSync(t).isDirectory() ? walk(t) : [t])) : walk(SRC)
  const issues = lintFiles(files, allow)
  if (issues.length > 0) {
    process.stdout.write(report(issues))
    process.exit(1)
  }
  process.stdout.write("design-lint: clean — all colors come from tokens.\n")
  process.exit(0)
}

main().catch((err) => {
  process.stderr.write(`design-lint failed: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
