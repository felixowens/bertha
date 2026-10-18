import { expect, it } from "vitest"

import { scrubText, scrubUrl } from "../src/core/scrub.ts"

it("redacts emails, tokens and secret query values", () => {
  expect(scrubText("No account for ana.b+x@example.co.uk")).toBe("No account for [email]")
  expect(scrubText("Authorization: Bearer eyJhbGciOi.J9x-y_z")).toBe("Authorization: Bearer [redacted]")
  expect(scrubUrl("https://a.test/cb?code=abc&state=1&api_key=k#x")).toBe(
    "https://a.test/cb?code=[redacted]&state=1&api_key=[redacted]#x",
  )
  expect(scrubUrl("https://a.test/search?q=shoes&page=2")).toBe("https://a.test/search?q=shoes&page=2")
})
