import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/** The release for this build: env first (CI sets these), then git, then package.json. */
export function detectRelease(cwd = process.cwd()): string | undefined {
  for (const name of ["BERTHA_RELEASE", "VERCEL_GIT_COMMIT_SHA", "GITHUB_SHA", "CF_PAGES_COMMIT_SHA", "COMMIT_SHA"]) {
    const v = process.env[name]?.trim()
    if (v) return v
  }
  const sha = git(cwd, ["rev-parse", "HEAD"])
  if (sha) return sha
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as { version?: string }
    return pkg.version
  } catch {
    return undefined
  }
}

export interface Commit {
  sha: string
  message: string
  author: string
}

export function lastCommit(cwd = process.cwd()): Commit | undefined {
  const out = git(cwd, ["log", "-1", "--format=%H%x00%s%x00%an"])
  if (!out) return undefined
  const [sha, message, author] = out.split("\0")
  return sha && message !== undefined && author !== undefined ? { sha, message, author } : undefined
}

function git(cwd: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined
  } catch {
    return undefined
  }
}
