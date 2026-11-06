// node --test scripts/*.test.ts
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { code, problems, type Commit } from "./contract-guard.ts"

const commit = (over: Partial<Commit>): Commit => ({
  sha: "abc1234",
  subject: "A change",
  message: "A change\n",
  contractChanged: false,
  generatedChanged: false,
  requestLines: [],
  ...over,
})
const applied = ["+- **Status:** applied (approved 2026-11-06)."]

test("comments and spacing aren't code, and strings are", () => {
  assert.equal(code("/** Doc. */\ntype A = { a: string } // why\n"), code("type A = {\n  a: string\n}\n"))
  assert.notEqual(code("type A = { a: string }"), code("type A = { b: string }"))
  assert.notEqual(code(`type A = "https://a"`), code(`type A = "https://b"`))
  assert.notEqual(code(`type A = "/* a */"`), code(`type A = "/* b */"`))
})

test("a commit that touches neither is fine", () => {
  assert.deepEqual(problems(commit({})), [])
})

test("generated types can't change without the contract", () => {
  assert.equal(problems(commit({ generatedChanged: true })).length, 1)
  assert.deepEqual(problems(commit({ generatedChanged: true, contractChanged: true, requestLines: applied })), [])
})

test("the contract can't change without an applied request", () => {
  assert.equal(problems(commit({ contractChanged: true })).length, 1)
  assert.equal(problems(commit({ contractChanged: true, requestLines: ["+- **Status:** requested."] })).length, 1)
  assert.deepEqual(problems(commit({ contractChanged: true, requestLines: applied })), [])
})

test("an exemption needs a reason", () => {
  const generatedChanged = true
  assert.deepEqual(problems(commit({ generatedChanged, message: "A change\n\nContract-Exempt: only the SDK uses these\n" })), [])
  assert.equal(problems(commit({ generatedChanged, message: "A change\n\nContract-Exempt:\n" })).length, 1)
})

test("it reads a real history", () => {
  const dir = mkdtempSync(join(tmpdir(), "contract-guard-"))
  const script = resolve(import.meta.dirname, "contract-guard.ts")
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@e2e.test", ...args], { cwd: dir, encoding: "utf8" })
  const save = (message: string, files: Record<string, string>) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true })
      writeFileSync(join(dir, path), text)
    }
    git("add", "-A")
    git("commit", "-qm", message)
  }
  const guard = (range: string) => {
    try {
      execFileSync(process.execPath, [script, range], { cwd: dir, encoding: "utf8", stdio: "pipe" })
      return ""
    } catch (e) {
      return (e as { stderr: string }).stderr
    }
  }
  try {
    git("init", "-q")
    save("Start", { "src/contract/domain.ts": "export type A = { a: string }\n", "src/api/generated/api.ts": "export type A = { a: string }\n", "CONTRACT-REQUESTS.md": "# Requests\n" })
    save("Explain A", { "src/contract/domain.ts": "/** Why A. */\nexport type A = { a: string }\n", "src/api/generated/api.ts": "// Regenerated.\nexport type A = { a: string }\n" })
    assert.equal(guard("HEAD~1..HEAD"), "", "comments alone pass")

    save("Widen A", { "src/contract/domain.ts": "/** Why A. */\nexport type A = { a: string; b: string }\n" })
    assert.match(guard("HEAD~1..HEAD"), /Widen A[\s\S]*no entry marked applied/)

    save("Regenerate", { "src/api/generated/api.ts": "export type A = { a: string; b: string }\n" })
    assert.match(guard("HEAD~1..HEAD"), /Regenerate[\s\S]*didn't/)

    save("Narrow A", {
      "src/contract/domain.ts": "export type A = { a: string }\n",
      "src/api/generated/api.ts": "export type A = { a: string }\n",
      "CONTRACT-REQUESTS.md": "# Requests\n\n- **Status:** applied (approved).\n",
    })
    assert.equal(guard("HEAD~1..HEAD"), "", "an applied request passes")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
