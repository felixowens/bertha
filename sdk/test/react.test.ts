import { version } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { Client } from "../src/core/client.ts"
import { setClient } from "../src/core/hub.ts"
import type { IngestBatch } from "../src/generated/ingest.ts"
import { ErrorBoundary, type ErrorBoundaryProps, type FallbackProps } from "../src/react/index.ts"

afterEach(() => setClient(undefined))

function boundary(props: ErrorBoundaryProps) {
  const sent: IngestBatch[] = []
  const client = new Client({ key: "k", url: "https://b.test" }, {
    async send(body) {
      sent.push(JSON.parse(body) as IngestBatch)
      return { status: 202 }
    },
  }, { name: "bertha.test", version: "0" })
  setClient(client)
  const b = new ErrorBoundary(props)
  // Unmounted, so apply state the way React would.
  b.setState = ((s: object) => void (b.state = { ...b.state, ...s })) as typeof b.setState
  const fail = (error: unknown) => {
    b.state = { ...b.state, ...ErrorBoundary.getDerivedStateFromError(error) }
    b.componentDidCatch(error, { componentStack: "\n    at Cart\n    at App" })
  }
  return { b, fail, client, events: () => sent.flatMap((s) => s.events) }
}

it("reports what it catches with the component stack, and React's version", async () => {
  const onError = vi.fn()
  const { b, fail, client, events } = boundary({ children: "page", fallback: "Something went wrong.", onError, tags: { area: "cart" } })
  expect(b.render()).toBe("page")
  const error = new TypeError("price is undefined")
  fail(error)
  expect(b.render()).toBe("Something went wrong.")
  await client.flush()
  const [e] = events()
  expect(e).toMatchObject({
    mechanism: { handler: "ErrorBoundary", handled: true },
    exception: { type: "TypeError", componentStack: "\n    at Cart\n    at App" },
    tags: { area: "cart" },
    context: { versions: { react: version } },
  })
  expect(onError).toHaveBeenCalledWith(error, "\n    at Cart\n    at App", e!.id)
})

it("hands a fallback function the error and a reset", () => {
  let given: FallbackProps | undefined
  const { b, fail } = boundary({
    children: "page",
    fallback: (p) => {
      given = p
      return (p.error as Error).message
    },
  })
  fail(new Error("No response"))
  expect(b.render()).toBe("No response")
  expect(given!.eventId).toMatch(/^[\da-f-]+$/)
  given!.reset()
  expect(b.render()).toBe("page")
})

it("renders nothing without a fallback", () => {
  const { b, fail } = boundary({ children: "page" })
  fail("plain")
  expect(b.render()).toBeNull()
})
