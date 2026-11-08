// node --test scripts/*.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { parse, problems } from "./migrations-guard.ts"

const A = "a".repeat(40)
const B = "b".repeat(40)
const M = "server/crates/bertha-db/migrations"

test("reads git's name-status log", () => {
  const log = `${A}\n\nA\t${M}/0012_new.sql\n${B}\n\nM\t${M}/0001_init.sql\nD\t${M}/0002_x.sql\n`
  assert.deepEqual(parse(log), [
    { sha: A, status: "A", path: `${M}/0012_new.sql` },
    { sha: B, status: "M", path: `${M}/0001_init.sql` },
    { sha: B, status: "D", path: `${M}/0002_x.sql` },
  ])
})

test("adding a migration is fine", () => {
  assert.deepEqual(problems([{ sha: A, status: "A", path: `${M}/0012_new.sql` }], () => false), [])
})

test("editing or deleting one that shipped isn't", () => {
  const found = problems(
    [
      { sha: B, status: "M", path: `${M}/0001_init.sql` },
      { sha: B, status: "D", path: `${M}/0002_x.sql` },
    ],
    () => true,
  )
  assert.equal(found.length, 2)
  assert.match(found[0]!, /^bbbbbbb edited .*0001_init\.sql, which has shipped/)
  assert.match(found[1]!, /deleted .*0002_x\.sql/)
})

test("editing one that hasn't shipped yet is fine", () => {
  const changes = [
    { sha: A, status: "A", path: `${M}/0012_new.sql` },
    { sha: B, status: "M", path: `${M}/0012_new.sql` },
  ]
  assert.deepEqual(problems(changes, (p) => !p.endsWith("0012_new.sql")), [])
})
