// node --test scripts/*.test.ts
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { ChangelogError, compare, notes, parse, release, render, unwrap } from "./changelog.ts"

const file = (body: string) => `# Changelog\n\nIntro.\n\n${body}`
const problems = (text: string) => {
  try {
    parse(text)
    return []
  } catch (e) {
    return (e as ChangelogError).problems
  }
}

test("the repo's own changelog is well formed", () => {
  const c = parse(readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8"))
  assert.ok(c.sections.length > 1)
  for (const s of c.sections.slice(1)) notes(c, s.version!)
})

test("release moves Unreleased under the version and leaves Unreleased empty", () => {
  const c = parse(file("## Unreleased\n\n### Rust SDK\n\n- Headers are scrubbed.\n\n### bertha\n\n- Faster.\n\n## 0.9.0 · 2026-10-21\n\n### bertha\n\n- Old.\n"))
  const out = render(release(c, "0.9.1", "2026-10-22"))
  assert.equal(
    out,
    file(
      "## Unreleased\n\n## 0.9.1 · 2026-10-22\n\n### bertha\n\n- Faster.\n\n### Rust SDK\n\n- Headers are scrubbed.\n\n## 0.9.0 · 2026-10-21\n\n### bertha\n\n- Old.\n",
    ),
  )
  // Releasing again is a no-op, so a retried version.sh set doesn't fail.
  assert.equal(render(release(parse(out), "0.9.1", "2026-10-23")), out)
})

test("release refuses nothing to say, and a version that isn't newer", () => {
  const c = parse(file("## Unreleased\n\n## 0.9.0 · 2026-10-21\n\n### bertha\n\n- Old.\n"))
  assert.throws(() => release(c, "0.9.1", "2026-10-22"), /Nothing under "## Unreleased"/)
  const more = parse(file("## Unreleased\n\n### bertha\n\n- New.\n\n## 0.9.0 · 2026-10-21\n\n### bertha\n\n- Old.\n"))
  assert.throws(() => release(more, "0.8.9", "2026-10-22"), /isn't newer than 0.9.0/)
})

test("a final release takes in its prereleases", () => {
  let c = parse(file("## Unreleased\n\n### bertha\n\n- One.\n\n## 0.9.0 · 2026-10-21\n\n### bertha\n\n- Old.\n"))
  c = release(c, "1.0.0-rc.1", "2026-10-22")
  c.sections[0]!.groups.set("Rust SDK", "- Two.")
  c = release(c, "1.0.0", "2026-10-23")
  assert.deepEqual(
    c.sections.map((s) => s.version),
    [null, "1.0.0", "0.9.0"],
  )
  assert.equal(c.sections[1]!.groups.get("bertha"), "- One.")
  assert.equal(c.sections[1]!.groups.get("Rust SDK"), "- Two.")
})

test("notes are the section, with a link to the commits since the last final release", () => {
  const c = parse(file("## Unreleased\n\n## 0.9.1 · 2026-10-22\n\nOne line.\n\n### bertha\n\n- New.\n\n## 0.9.1-rc.1 · 2026-10-21\n\n### bertha\n\n- New.\n\n## 0.9.0 · 2026-10-20\n\n### bertha\n\n- Old.\n"))
  assert.equal(
    notes(c, "0.9.1"),
    "One line.\n\n### bertha\n\n- New.\n\n[Every commit since 0.9.0](https://github.com/felixowens/bertha/compare/v0.9.0...v0.9.1)\n",
  )
  assert.throws(() => notes(c, "0.9.2"), /No entries for 0.9.2/)
})

test("check names what's wrong", () => {
  assert.deepEqual(problems(file("## 0.9.0 · 2026-10-21\n\n### bertha\n\n- Old.\n")), ['There should be one "## Unreleased", first.'])
  assert.deepEqual(problems(file("## Unreleased\n\n## 0.9.0\n")), ['Line 7: "## 0.9.0" should be "## Unreleased" or "## 1.2.3 · 2026-10-22".'])
  assert.match(problems(file("## Unreleased\n\n### Fixes\n\n- x\n"))[0]!, /"Fixes" isn't a group/)
  assert.match(
    problems(file("## Unreleased\n\n## 0.8.0 · 2026-10-20\n\n### bertha\n\n- a\n\n## 0.9.0 · 2026-10-21\n\n### bertha\n\n- b\n"))[0]!,
    /0.9.0 should come below 0.8.0/,
  )
  assert.match(
    problems(file("## Unreleased\n\n## 0.9.0 · 2026-10-21\n\n### Rust SDK\n\n- a\n\n### bertha\n\n- b\n"))[0]!,
    /put the groups in this order/,
  )
})

test("semver order", () => {
  assert.ok(compare("0.10.0", "0.9.1") > 0)
  assert.ok(compare("1.0.0", "1.0.0-rc.2") > 0)
  assert.ok(compare("1.0.0-rc.10", "1.0.0-rc.2") > 0)
  assert.equal(compare("0.9.1", "0.9.1"), 0)
})

test("notes join wrapped lines, but not code or new items", () => {
  assert.equal(
    unwrap("- One that\n  wraps.\n- Two.\n\nA paragraph\nthat wraps.\n\n```bash\nnpm install\nnpm test\n```"),
    "- One that wraps.\n- Two.\n\nA paragraph that wraps.\n\n```bash\nnpm install\nnpm test\n```",
  )
})
