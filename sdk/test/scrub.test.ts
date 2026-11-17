import { readFileSync } from "node:fs"

import { expect, it } from "vitest"

import { scrubFields, scrubText, scrubUrl } from "../src/core/scrub.ts"

/** The cases bigbertha checks too, so both SDKs scrub alike. */
const cases = JSON.parse(readFileSync(new URL("../../server/crates/bigbertha/src/scrub_cases.json", import.meta.url), "utf8")) as {
  text: [string, string][]
  url: [string, string][]
  fields: [Record<string, string>, Record<string, string>][]
}

it("redacts emails, tokens and secret query values", () => {
  for (const [input, want] of cases.text) expect(scrubText(input), input).toBe(want)
  for (const [input, want] of cases.url) expect(scrubUrl(input), input).toBe(want)
})

it("drops fields with secret names and scrubs the rest", () => {
  for (const [input, want] of cases.fields) expect(scrubFields(input)).toEqual(want)
})
