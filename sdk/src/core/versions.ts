// Framework versions found at runtime (React from its entry, Next.js from the page),
// shared through globalThis so a second copy of the SDK in the bundle sees them too.

const KEY = "__berthaVersions"

type Holder = { [KEY]?: Record<string, string> }

export function registerVersion(name: string, version: string | undefined): void {
  if (!version) return
  const g = globalThis as Holder
  ;(g[KEY] ??= {})[name] = version
}

export function versions(): Record<string, string> {
  return { ...(globalThis as Holder)[KEY] }
}
