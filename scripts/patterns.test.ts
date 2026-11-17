// node --test scripts/*.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { check } from "./patterns.ts"

const rules = (file: string, text: string) => check(file, text).map((f) => f.rule.id)

test("a suppressed deps list is caught, and can't be allowed", () => {
  const text = "// eslint-disable-next-line react-hooks/exhaustive-deps\n}, [key])"
  assert.deepEqual(rules("src/pages/A.tsx", text), ["deps-suppressed"])
  const allowed = "// patterns-allow deps-suppressed: just this once\n" + text
  assert.deepEqual(rules("src/pages/A.tsx", allowed), ["deps-suppressed"])
})

test("a hand-rolled loader is caught outside useLoadable", () => {
  const text = "useEffect(() => {\n  let live = true\n  backend.x().then((v) => live && set(v))"
  assert.deepEqual(rules("src/components/A.tsx", text), ["hand-rolled-loader"])
  assert.deepEqual(rules("src/data/useLoadable.ts", text), [])
})

test("an exception needs its reason", () => {
  const bare = "// patterns-allow hand-rolled-loader:\nlet live = true"
  assert.deepEqual(rules("src/pages/A.tsx", bare), ["hand-rolled-loader"])
  const wrong = "// patterns-allow raw-fetch: the wrong rule\nlet live = true"
  assert.deepEqual(rules("src/pages/A.tsx", wrong), ["hand-rolled-loader"])
  const reasoned = "// patterns-allow hand-rolled-loader: a poll, not a load\nlet live = true"
  assert.deepEqual(rules("src/pages/A.tsx", reasoned), [])
  const sameLine = "let live = true // patterns-allow hand-rolled-loader: a poll"
  assert.deepEqual(rules("src/pages/A.tsx", sameLine), [])
})

test("only the data layer reads scenarios and fixtures", () => {
  const scenario = `import { backend, scenario } from "@/data/backend"`
  assert.deepEqual(rules("src/pages/A.tsx", scenario), ["scenario-in-ui"])
  assert.deepEqual(rules("src/data/scenario.ts", scenario), [])
  assert.deepEqual(rules("src/pages/A.tsx", `import { backend } from "@/data/backend"`), [])

  const fixtures = `import { issues } from "../../fixtures/issues"`
  assert.deepEqual(rules("src/components/A.tsx", fixtures), ["fixtures-in-app"])
  assert.deepEqual(rules("src/data/fixtures.ts", fixtures), [])
})

test("fetch and generated types stay behind the adapter and the contract", () => {
  assert.deepEqual(rules("src/pages/A.tsx", `const r = await fetch("/api/x")`), ["raw-fetch"])
  assert.deepEqual(rules("src/pages/A.tsx", `await backend.fetchMore()`), [])
  assert.deepEqual(rules("src/data/http.ts", `res = await fetch(path)`), [])

  const generated = `import type { Issue } from "@/api/generated/Issue"`
  assert.deepEqual(rules("src/pages/A.tsx", generated), ["generated-types"])
  assert.deepEqual(rules("src/api/contract-check.ts", generated), [])
})

test("swallowed errors are caught in each shape", () => {
  for (const text of [".catch(() => {})", ".catch(() => undefined)", "} catch {}", "} catch (e) {}", "  () => {},"])
    assert.deepEqual(rules("src/pages/A.tsx", text), ["swallowed-error"], text)
  assert.deepEqual(rules("src/pages/A.tsx", ".catch((e) => toast(e.message))"), [])
  assert.deepEqual(rules("src/pages/A.tsx", "onClose={() => {}}"), [])
})
