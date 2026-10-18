import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = join(import.meta.dirname, "..")
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  exports: Record<string, string>
  typesVersions: { "*": Record<string, string[]> }
}

// TypeScript's older `moduleResolution: "node"` ignores `exports`, so each entry
// also needs a typesVersions path or `@bigbertha/sdk/browser` has no types there.
describe("package.json", () => {
  it("gives every entry a typesVersions path beside its module", () => {
    const entries = Object.entries(pkg.exports).filter(([k]) => k !== "./package.json")
    expect(Object.keys(pkg.typesVersions["*"])).toEqual(entries.map(([k]) => k.slice(2)))
    for (const [key, js] of entries) {
      expect(pkg.typesVersions["*"][key.slice(2)]).toEqual([js.slice(2).replace(/\.js$/, ".d.ts")])
    }
  })

  it.runIf(existsSync(join(root, "dist")))("points at types the build emits", () => {
    for (const [path] of Object.values(pkg.typesVersions["*"])) expect(existsSync(join(root, path!)), path).toBe(true)
  })
})
