// Holds migrations to "only add": one that has shipped is never edited, renamed or
// deleted, because every database it ran on keeps the old version (and sqlx refuses to
// start when a file's checksum no longer matches). Write a new migration instead.
//
//   node scripts/migrations-guard.ts [RANGE]
//                     checks the commits in RANGE (BASE..HEAD) against what had
//                     shipped by BASE: by default, since the last release tag. The
//                     pre-push hook and CI run it.
//
// A migration added and then edited inside RANGE hasn't shipped, so that's fine.
// Node 24 strips the types.
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

export const DIRS = ["server/crates/bertha-db/migrations", "server/crates/bertha-db/migrations-logs"]

/** One line of `git log --name-status`: what happened to a path. */
export type Change = { sha: string; status: string; path: string }

/** What's wrong, one line each. `shipped` says whether a path existed at the range's base. */
export function problems(changes: Change[], shipped: (path: string) => boolean): string[] {
  return changes
    .filter((c) => !c.status.startsWith("A") && shipped(c.path))
    .map((c) => {
      const what = c.status.startsWith("D") ? "deleted" : "edited"
      return `${c.sha.slice(0, 7)} ${what} ${c.path}, which has shipped. Put it back and write a new migration.`
    })
}

/** Parses `git log --format=%H --name-status --no-renames` output. */
export function parse(log: string): Change[] {
  const out: Change[] = []
  let sha = ""
  for (const line of log.split("\n")) {
    if (/^[0-9a-f]{40}$/.test(line)) sha = line
    else if (line.trim()) {
      const [status = "", path = ""] = line.split("\t")
      out.push({ sha, status, path })
    }
  }
  return out
}

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 })

function exists(rev: string, path: string): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", `${rev}:${path}`], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

/** Everything since the last release tag, or nothing shipped yet in a clone without tags. */
function defaultRange(): string | null {
  try {
    const tag = execFileSync("git", ["describe", "--tags", "--abbrev=0", "--match", "v*", "HEAD^"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    return `${tag}..HEAD`
  } catch {
    return null
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const range = process.argv[2] ?? defaultRange()
  if (!range) {
    console.log("migrations-guard: no release tag here, so nothing has shipped to check against.")
    process.exit(0)
  }
  const base = range.split("..")[0]!
  const changes = parse(git("log", "--format=%H", "--name-status", "--no-renames", range, "--", ...DIRS))
  const found = problems(changes, (path) => exists(base, path))
  if (found.length) {
    console.error(`Migrations only add:\n\n${found.join("\n")}`)
    process.exit(1)
  }
  console.log(`migrations-guard: no shipped migration changed in ${range}.`)
}
