// Environment variables, wherever the runtime keeps them.

export function env(name: string): string | undefined {
  try {
    const v = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name]
    return v === "" ? undefined : v
  } catch {
    return undefined
  }
}

/** Where hosts and CI put the commit a process was built from, most specific first. */
export const COMMIT_ENV = [
  "BERTHA_COMMIT",
  "HEROKU_BUILD_COMMIT",
  "HEROKU_SLUG_COMMIT",
  "SOURCE_VERSION",
  "RENDER_GIT_COMMIT",
  "RAILWAY_GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_SHA",
  "CF_PAGES_COMMIT_SHA",
  "GITHUB_SHA",
  "COMMIT_SHA",
]

/** The commit the environment names, if it looks like one. */
export function envCommit(): string | undefined {
  for (const n of COMMIT_ENV) {
    const v = env(n)?.trim()
    if (v && /^[0-9a-f]{7,64}$/i.test(v)) return v.toLowerCase()
  }
  return undefined
}

export function firstEnv(...names: string[]): string | undefined {
  for (const n of names) {
    const v = env(n)
    if (v) return v
  }
  return undefined
}
