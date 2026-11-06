// Holds commits to the contract's process: `src/contract` is the spec, and it only changes
// through an applied entry in CONTRACT-REQUESTS.md.
//
//   node scripts/contract-guard.ts [RANGE]
//                     checks each commit in RANGE, by default everything since the last
//                     release tag. The pre-push hook and CI run it.
//
// A commit that really is an exception says why in a trailer:
//   Contract-Exempt: these types are only for the SDK, and the app never sees them
//
// Changes to comments don't count. Node 24 strips the types.
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const CONTRACT = "src/contract"
const GENERATED = "src/api/generated"
const REQUESTS = "CONTRACT-REQUESTS.md"

/** What the source says once comments and spacing are gone, leaving strings alone. */
export function code(source: string): string {
  return source
    .replace(/("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\/\*[\s\S]*?\*\/|\/\/.*$/gm, (_, text) => text ?? "")
    .replace(/\s+/g, "")
}

export type Commit = {
  sha: string
  subject: string
  message: string
  contractChanged: boolean
  generatedChanged: boolean
  /** The lines this commit added to CONTRACT-REQUESTS.md. */
  requestLines: string[]
}

/** What's wrong with one commit, one line each. */
export function problems(c: Commit): string[] {
  if (/^Contract-Exempt:\s*\S/m.test(c.message)) return []
  const out: string[] = []
  if (c.generatedChanged && !c.contractChanged) {
    out.push(`${GENERATED} changed but ${CONTRACT} didn't. Change the contract first, or say why not in a Contract-Exempt trailer.`)
  }
  if (c.contractChanged && !c.requestLines.some((l) => /\*\*Status:\*\*\s*applied/.test(l))) {
    out.push(`${CONTRACT} changed with no entry marked applied in ${REQUESTS}. Add the entry, get it approved and mark it applied in this commit.`)
  }
  return out
}

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 })

function codeChanged(sha: string, dir: string): boolean {
  const files = git("diff-tree", "--no-commit-id", "--name-only", "-r", "--root", sha, "--", dir).split("\n").filter(Boolean)
  const at = (rev: string, file: string) => {
    try {
      return code(execFileSync("git", ["show", `${rev}:${file}`], { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] }))
    } catch {
      return null // The file doesn't exist on that side.
    }
  }
  return files.some((f) => at(`${sha}^`, f) !== at(sha, f))
}

function read(sha: string): Commit {
  const added = git("show", "--format=", "--unified=0", sha, "--", REQUESTS)
  return {
    sha,
    subject: git("log", "-1", "--format=%s", sha).trim(),
    message: git("log", "-1", "--format=%B", sha),
    contractChanged: codeChanged(sha, CONTRACT),
    generatedChanged: codeChanged(sha, GENERATED),
    requestLines: added.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")),
  }
}

/** Everything since the last release tag, not counting a tag on HEAD itself. */
function defaultRange(): string {
  const tag = git("describe", "--tags", "--abbrev=0", "--match", "v*", "HEAD^").trim()
  return `${tag}..HEAD`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const range = process.argv[2] ?? defaultRange()
  const shas = git("rev-list", "--no-merges", "--reverse", range).split("\n").filter(Boolean)
  const found = shas.flatMap((sha) => {
    const commit = read(sha)
    return problems(commit).map((p) => `${sha.slice(0, 7)} ${commit.subject}\n  ${p}`)
  })
  if (found.length) {
    console.error(`The contract's process wasn't followed:\n\n${found.join("\n\n")}`)
    process.exit(1)
  }
  console.log(`contract-guard: ${shas.length} commits in ${range} are fine.`)
}
