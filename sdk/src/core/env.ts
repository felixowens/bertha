// Environment variables, wherever the runtime keeps them.

export function env(name: string): string | undefined {
  try {
    const v = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name]
    return v === "" ? undefined : v
  } catch {
    return undefined
  }
}

export function firstEnv(...names: string[]): string | undefined {
  for (const n of names) {
    const v = env(n)
    if (v) return v
  }
  return undefined
}
