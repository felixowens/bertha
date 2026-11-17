#!/usr/bin/env node
/**
 * The app's boundaries and the patterns that were copied once too often, as checks, over
 * the app (src/), the JavaScript SDK (sdk/src/) and the Rust SDK (bigbertha). Each rule
 * says what to do instead, because whoever reads it is about to copy something.
 *
 *   node scripts/patterns.ts            check them all, exit 1 on findings
 *   node scripts/patterns.ts --hook     PostToolUse hook: check the edited file (and run
 *                                       oxlint's errors on it), exit 2
 *
 * A deliberate exception carries `patterns-allow <rule>: <why>` on its line or the one
 * above. The why is required. Rules marked `strict` take no exceptions.
 */
import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, extname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
/** What's checked: folders (relative to the repo) and the files in them. Generated code isn't. */
const TREES = [
  { dir: "src/", ext: [".ts", ".tsx"] },
  { dir: "sdk/src/", ext: [".ts"], skip: "sdk/src/generated/" },
  { dir: "server/crates/bigbertha/src/", ext: [".rs"] },
]
const APP = ["src/"]
const SDKS = ["sdk/src/", "server/crates/bigbertha/src/"]

/** The values both SDKs share, by name, from the file bigbertha generates. */
const POLICY = [...readFileSync(join(ROOT, "sdk/src/generated/policy.ts"), "utf8").matchAll(/^export const (\w+)/gm)].map((m) => m[1]!)

export type Rule = {
  id: string
  re: RegExp
  /** Paths (relative to the repo, `/` separated) the rule applies to; the app's src/ unless it says. A trailing `/` means a folder. */
  only?: readonly string[]
  /** Paths the rule doesn't apply to, written the same way. */
  except?: readonly string[]
  strict?: boolean
  hint: string
}

export const RULES: readonly Rule[] = [
  {
    id: "deps-suppressed",
    re: /(?:eslint|oxlint)-disable\S*\s+\S*exhaustive-deps/,
    strict: true,
    hint: "List every dep. Callbacks an effect calls but shouldn't re-run for go through useEffectEvent; a value rebuilt each render (a filter parsed from the URL) through useStableValue.",
  },
  {
    id: "hand-rolled-loader",
    re: /\blet (?:live|alive|current|cancell?ed|stale|active|mounted|unmounted|gone|ignore|disposed) = (?:true|false)\b/,
    except: ["src/data/useLoadable.ts"],
    hint: "Read from backend with useLoadable (src/data/useLoadable.ts). It drops late answers and gives loading, empty and error states with reload.",
  },
  {
    id: "reset-in-effect",
    re: /useEffect\(\s*\(\)\s*=>\s*\{?\s*(?:if\s*\(.*\)\s*)?set[A-Z]\w*\(/,
    except: ["src/lib/useResetState.ts"],
    strict: true,
    hint: "State that resets when something changes is useResetState(initial, deps) (src/lib/useResetState.ts). A draft that starts afresh when a popover opens is set in onOpenChange.",
  },
  {
    id: "scenario-in-ui",
    re: /import\s*\{[^}]*\bscenario\b[^}]*\}\s*from\s*["']@\/data\/backend["']/,
    except: ["src/data/"],
    hint: "Pages read the URL (useLocation().query). A named scenario's params are written into the URL before the app starts, and its `state` reaches a page through useLoadable's `route` option.",
  },
  {
    id: "fixtures-in-app",
    re: /from\s*["'][^"']*\bfixtures(?:\/[^"']*)?["']/,
    except: ["src/data/"],
    strict: true,
    hint: "Components get data only through `backend` from src/data/backend.ts. Fixtures must never reach a production bundle.",
  },
  {
    id: "raw-fetch",
    re: /(?<![.\w])fetch\(/,
    except: ["src/data/http.ts"],
    hint: "Talk to the server through `backend`. Add the route to the contract and src/data/http.ts if it's missing.",
  },
  {
    id: "generated-types",
    re: /from\s*["'][^"']*api\/generated/,
    except: ["src/api/"],
    strict: true,
    hint: "Import types from src/contract. src/api/contract-check.ts proves the generated ones equal them.",
  },
  {
    id: "swallowed-error",
    re: /\.catch\(\s*\(\s*\w*\s*\)\s*=>\s*(?:\{\s*\}|undefined|null|void 0)\s*\)|catch\s*(?:\(\s*\w*\s*\))?\s*\{\s*\}|^\s*\(\s*\w*\s*\)\s*=>\s*\{\s*\},?\s*$/,
    only: [...APP, "sdk/src/"],
    hint: "Handle the failure: in the app show it (a toast, an inline error or the error state); in the SDK retry, or say so with the debug note. Or say on the line why dropping it is right.",
  },
  {
    id: "policy-copy",
    // A shared name given a literal of its own: a number, a string, a regex or a Duration.
    re: new RegExp(String.raw`^\s*(?:export\s+|pub(?:\(crate\))?\s+)?(?:const|static)\s+(?:${POLICY.join("|")})\b[^=]*=\s*(?:[\d"'\x60/]|r#*"|Duration::from_\w+\(\s*\d)`),
    only: SDKS,
    except: ["server/crates/bigbertha/src/policy.rs"],
    strict: true,
    hint: "Both SDKs share this value. Import it from sdk/src/generated/policy.ts (JavaScript) or crate::policy (Rust); change it in server/crates/bigbertha/src/policy.rs and run its tests.",
  },
]

export type Finding = { file: string; line: number; rule: Rule }

const ALLOW = /patterns-allow ([\w-]+):\s*(\S.*)?$/

function allowed(lines: readonly string[], i: number, rule: Rule): boolean {
  if (rule.strict) return false
  return [lines[i], lines[i - 1]].some((l) => {
    const m = l?.match(ALLOW)
    return !!m && m[1] === rule.id && !!m[2]?.trim()
  })
}

const matches = (file: string, paths: readonly string[]) => paths.some((e) => (e.endsWith("/") ? file.startsWith(e) : file === e))
const exempt = (file: string, rule: Rule) => !matches(file, rule.only ?? APP) || matches(file, rule.except ?? [])

/** One file's findings. `file` is relative to the repo, `/` separated. */
export function check(file: string, text: string): Finding[] {
  const lines = text.split("\n")
  const out: Finding[] = []
  for (const rule of RULES) {
    if (exempt(file, rule)) continue
    lines.forEach((l, i) => {
      if (rule.re.test(l) && !allowed(lines, i, rule)) out.push({ file, line: i + 1, rule })
    })
  }
  return out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
}

const rel = (abs: string) => relative(ROOT, abs).split("\\").join("/")

/** Whether a file (relative to the repo) is one that's checked. */
export function checked(file: string): boolean {
  return TREES.some((t) => file.startsWith(t.dir) && !(t.skip && file.startsWith(t.skip)) && t.ext.includes(extname(file)))
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    return e.isDirectory() ? walk(p) : checked(rel(p)) ? [p] : []
  })
}
const checkFile = (abs: string) => check(rel(abs), readFileSync(abs, "utf8"))

export function report(found: readonly Finding[]): string {
  return found.map((f) => `${f.file}:${f.line}  ${f.rule.id}\n    ${f.rule.hint}`).join("\n") + "\n"
}

async function stdin(): Promise<string> {
  let data = ""
  for await (const chunk of process.stdin) data += chunk
  return data
}

async function main() {
  if (process.argv.includes("--hook")) {
    let path = ""
    try {
      path = JSON.parse(await stdin())?.tool_input?.file_path ?? ""
    } catch {
      // patterns-allow swallowed-error: no payload means there's no file to check.
    }
    const abs = path && resolve(path)
    if (!abs || !checked(rel(abs)) || !existsSync(abs) || !statSync(abs).isFile()) return
    const found = checkFile(abs)
    // oxlint's errors (hooks deps, setState in effects, refs in render) for the app's files
    // now, not only in CI. Its warnings are left to `npx oxlint`.
    const lint = rel(abs).startsWith("src/")
      ? spawnSync(join(ROOT, "node_modules/.bin/oxlint"), ["--quiet", abs], { cwd: ROOT, encoding: "utf8" })
      : undefined
    const lintFailed = !!lint && lint.status !== 0 && lint.status !== null
    if (found.length || lintFailed) {
      if (found.length) process.stderr.write(`patterns: ${found.length} finding(s)\n${report(found)}`)
      if (lintFailed) process.stderr.write(`oxlint:\n${lint.stdout}${lint.stderr}`)
      process.exit(2)
    }
    return
  }
  const found = TREES.flatMap((t) => walk(join(ROOT, t.dir))).flatMap(checkFile)
  if (found.length) {
    process.stdout.write(`patterns: ${found.length} finding(s)\n${report(found)}`)
    process.exit(1)
  }
  process.stdout.write("patterns: clean\n")
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
