// Which bundle files have uploaded source maps. The build step appends a line to
// each bundle that records `new Error().stack` against the bundle's debug id; here
// those stacks are read back to learn each bundle's URL (whatever CDN or path it was
// served from).

import { parseStack } from "./stack.ts"

type Ids = Record<string, string>
type BerthaGlobal = { __berthaIds?: Ids; __berthaRelease?: string }

const byFile = new Map<string, string>()
let seen = 0

function registry(): BerthaGlobal {
  return globalThis as unknown as BerthaGlobal
}

export function debugIdsFor(files: Iterable<string>): Record<string, string> | undefined {
  const ids = registry().__berthaIds
  if (!ids) return undefined
  const stacks = Object.keys(ids)
  if (stacks.length !== seen) {
    for (const stack of stacks) {
      const file = parseStack(stack)[0]?.file
      if (file) byFile.set(file, ids[stack]!)
    }
    seen = stacks.length
  }
  let out: Record<string, string> | undefined
  for (const f of files) {
    const id = byFile.get(f)
    if (id) (out ??= {})[f] = id
  }
  return out
}

/** The release the build step stamped into the bundles, if any. */
export function builtRelease(): string | undefined {
  return registry().__berthaRelease
}
