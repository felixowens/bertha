import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BATCH, Client } from "../src/core/client.ts"
import { COMMIT_ENV, envCommit } from "../src/core/env.ts"
import { fromAnyRequest } from "../src/core/request.ts"
import type { IngestBatch } from "../src/generated/ingest.ts"
import type { Options, SendResult, Transport } from "../src/core/types.ts"

const SDK = { name: "bertha.test", version: "0" }

function setup(options: Partial<Options> = {}, replies: SendResult[] = []) {
  const sent: { batch: IngestBatch; final: boolean }[] = []
  const transport: Transport = {
    async send(body, final) {
      sent.push({ batch: JSON.parse(body) as IngestBatch, final })
      return replies.shift() ?? { status: 202 }
    },
  }
  const client = new Client(
    { key: "k", url: "https://b.test", ...options },
    transport,
    SDK,
    { runtime: "Test" },
    undefined,
    undefined,
    fromAnyRequest,
  )
  return { client, sent, events: () => sent.flatMap((s) => s.batch.events) }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  delete (globalThis as { __berthaIds?: unknown }).__berthaIds
  delete (globalThis as { __berthaRelease?: unknown }).__berthaRelease
})

describe("Client", () => {
  it("batches events a second after the first", async () => {
    const { client, sent, events } = setup({ release: "1.2.0", environment: "production", tags: { app: "shop" } })
    const id = client.captureException(new TypeError("x is undefined"))
    client.captureMessage("Cache warmed late", { tags: { region: "eu" } })
    expect(sent).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1000)
    expect(sent).toHaveLength(1)
    expect(sent[0]!.batch.sdk).toEqual(SDK)
    const [error, message] = events()
    expect(error).toMatchObject({
      id,
      level: "error",
      release: "1.2.0",
      environment: "production",
      context: { runtime: "Test" },
      tags: { app: "shop" },
      exception: { type: "TypeError", message: "x is undefined" },
    })
    expect(error!.exception!.frames[0]!.file).toContain("client.test.ts")
    expect(message).toMatchObject({ message: "Cache warmed late", level: "warning", tags: { app: "shop", region: "eu" } })
  })

  it("sends at once when a batch fills", async () => {
    const { client, sent } = setup()
    for (let i = 0; i < BATCH; i++) client.captureMessage(`m${i}`)
    await vi.advanceTimersByTimeAsync(0)
    expect(sent.map((s) => s.batch.events.length)).toEqual([BATCH])
  })

  it("reports an error object once", async () => {
    const { client, events } = setup()
    const e = new Error("twice")
    client.captureException(e)
    client.captureException(e)
    await client.flush()
    expect(events()).toHaveLength(1)
  })

  it("follows causes and describes non-errors", async () => {
    const { client, events } = setup()
    client.captureException(new Error("Couldn't save", { cause: new TypeError("Failed to fetch") }))
    client.captureException({ code: 42 })
    client.captureException("plain string")
    await client.flush()
    const [a, b, c] = events()
    expect(a!.exception!.cause).toMatchObject({ type: "TypeError", message: "Failed to fetch" })
    expect(b!.exception).toEqual({ type: "Error", message: 'Non-error thrown: {"code":42}', frames: [] })
    expect(c!.exception!.message).toBe("plain string")
  })

  it("scrubs by default, and not when asked", async () => {
    const on = setup()
    on.client.addBreadcrumb({ category: "fetch", message: "GET /me?token=abc 200" })
    on.client.captureException(new Error("No account for ana@example.com"), {
      request: { method: "GET", url: "https://a.test/?session=s1" },
    })
    await on.client.flush()
    const e = on.events()[0]!
    expect(e.exception!.message).toBe("No account for [email]")
    expect(e.breadcrumbs![0]!.message).toBe("GET /me?token=[redacted] 200")
    expect(e.request!.url).toBe("https://a.test/?session=[redacted]")

    const off = setup({ scrub: false })
    off.client.captureException(new Error("No account for ana@example.com"))
    await off.client.flush()
    expect(off.events()[0]!.exception!.message).toBe("No account for ana@example.com")
  })

  it("lets beforeSend change or drop events, and samples", async () => {
    const { client, events } = setup({
      beforeSend: (e) => (e.message === "drop" ? null : { ...e, tags: { ...e.tags, seen: "yes" } }),
    })
    client.captureMessage("drop")
    client.captureMessage("keep")
    await client.flush()
    expect(events().map((e) => [e.message, e.tags?.seen])).toEqual([["keep", "yes"]])

    const sampled = setup({ sampleRate: 0 })
    expect(sampled.client.captureMessage("never")).toBeUndefined()
  })

  it("keeps the newest hundred breadcrumbs", async () => {
    const { client, events } = setup()
    for (let i = 0; i < 120; i++) client.addBreadcrumb({ category: "ui", message: `b${i}` })
    client.captureMessage("x")
    await client.flush()
    const crumbs = events()[0]!.breadcrumbs!
    expect(crumbs).toHaveLength(100)
    expect(crumbs[0]!.message).toBe("b20")
  })

  it("caps a runaway loop at a hundred a minute", async () => {
    const { client, events } = setup()
    for (let i = 0; i < 150; i++) client.captureMessage(`m${i}`)
    await client.flush()
    expect(events()).toHaveLength(100)
    vi.advanceTimersByTime(61_000)
    expect(client.captureMessage("later")).toBeDefined()
  })

  it("waits as long as bertha asks after a 429", async () => {
    const { client, sent } = setup({}, [{ status: 429, retryAfter: 5 }])
    client.captureMessage("one")
    await client.flush()
    expect(sent).toHaveLength(1)
    client.captureMessage("two")
    await client.flush()
    expect(sent).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(sent).toHaveLength(2)
    expect(sent[1]!.batch.events.map((e) => e.message)).toEqual(["one", "two"])
  })

  it("retries when offline, then gives up", async () => {
    const { client, sent } = setup({}, ["offline", "offline", "offline", "offline"])
    client.captureMessage("lost")
    const done = client.flush()
    await vi.advanceTimersByTimeAsync(10_000)
    await done
    expect(sent).toHaveLength(4)
    const final = setup({}, ["offline"])
    final.client.captureMessage("gone")
    await final.client.flush(true)
    expect(final.sent).toHaveLength(1)
    expect(final.sent[0]!.final).toBe(true)
  })

  it("warns once when bertha refuses", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { client } = setup({}, [{ status: 401 }, { status: 401 }])
    client.captureMessage("a")
    await client.flush()
    client.captureMessage("b")
    await client.flush()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toContain("HTTP 401")
    warn.mockRestore()
  })

  it("says how each event was caught, unless the caller does", async () => {
    const { client, events } = setup()
    client.captureException(new Error("a"))
    client.captureMessage("b")
    client.captureException(new Error("c"), { mechanism: { handler: "onerror", handled: false } })
    await client.flush()
    expect(events().map((e) => e.mechanism)).toEqual([
      { handler: "captureException", handled: true },
      { handler: "captureMessage", handled: true },
      { handler: "onerror", handled: false },
    ])
  })

  it("reads the framework's request, with the caller's fields on top", async () => {
    const { client, events } = setup()
    const req = {
      method: "GET",
      url: "/faqs?page=2",
      headers: { host: "api.test", cookie: "sid=1", "x-forwarded-for": "203.0.113.9" },
      socket: { remoteAddress: "10.0.0.2" },
    }
    client.captureException(new Error("a"), { req, status: 500, mechanism: { handler: "koa", handled: false } })
    client.captureException(new Error("b"), {
      req,
      user: { id: "u_1" },
      trace: { traceId: "4bf92f3577b34da6a3ce929d0e0e4736", spanId: "00f067aa0ba902b7" },
    })
    client.captureException(new Error("c"), { req: "not a request" })
    await client.flush()
    const [a, b, c] = events()
    expect(a!.request).toEqual({
      method: "GET",
      url: "http://api.test/faqs?page=2",
      status: 500,
      headers: { host: "api.test", "x-forwarded-for": "203.0.113.9" },
    })
    expect(a!.user).toEqual({ ip: "203.0.113.9" })
    expect(a!.mechanism).toEqual({ handler: "koa", handled: false })
    expect(b!.user).toEqual({ ip: "203.0.113.9", id: "u_1" })
    expect(b!.trace).toEqual({ traceId: "4bf92f3577b34da6a3ce929d0e0e4736", spanId: "00f067aa0ba902b7" })
    expect(c!.request).toBeUndefined()
  })

  it("sends the error's own fields, without credentials", async () => {
    const { client, events } = setup()
    const e = Object.assign(new Error("No response"), {
      code: "ECONNRESET",
      status: 502,
      response: { retry: true },
      apiKey: "k-123",
      note: "for ana@example.com",
      long: "x".repeat(600),
    })
    client.captureException(e, { componentStack: "\n    at Cart\n    at App" })
    await client.flush()
    const ex = events()[0]!.exception!
    expect(ex.data).toEqual({
      code: '"ECONNRESET"',
      status: "502",
      response: '{"retry":true}',
      note: '"for [email]"',
      long: expect.stringMatching(/^"x+…$/),
    })
    expect(ex.data!.long).toHaveLength(500)
    expect(ex.componentStack).toBe("\n    at Cart\n    at App")

    const off = setup({ scrub: false })
    off.client.captureException(Object.assign(new Error("x"), { apiKey: "k-123" }))
    await off.client.flush()
    expect(off.events()[0]!.exception!.data).toEqual({ apiKey: '"k-123"' })
  })

  it("merges versions, the user and the trace", async () => {
    const g = globalThis as { __berthaVersions?: Record<string, string> }
    g.__berthaVersions = { react: "19.3.1" }
    const { client, events } = setup({ versions: { app: "7" } })
    client.setUser({ id: "u1", email: "ana@example.com" })
    client.captureException(new Error("x"), { user: { ip: "203.0.113.9" }, trace: { traceId: "a".repeat(32), spanId: "b".repeat(16) } })
    await client.flush()
    const e = events()[0]!
    expect(e.context!.versions).toEqual({ react: "19.3.1", app: "7" })
    expect(e.user).toEqual({ id: "u1", email: "ana@example.com", ip: "203.0.113.9" })
    expect(e.trace).toEqual({ traceId: "a".repeat(32), spanId: "b".repeat(16) })
    delete g.__berthaVersions
  })

  it("enriches before scrubbing, and survives an enrich that throws", async () => {
    const sent: IngestBatch[] = []
    const transport: Transport = {
      async send(body) {
        sent.push(JSON.parse(body) as IngestBatch)
        return { status: 202 }
      },
    }
    let calls = 0
    const client = new Client({ key: "k", url: "https://b.test" }, transport, SDK, {}, undefined, (e) => {
      if (calls++ === 1) throw new Error("broken")
      e.request = { method: "GET", url: "https://a.test/?token=t1" }
    })
    client.captureMessage("one")
    client.captureMessage("two")
    await client.flush()
    const events = sent.flatMap((b) => b.events)
    expect(events.map((e) => e.message)).toEqual(["one", "two"])
    expect(events[0]!.request!.url).toBe("https://a.test/?token=[redacted]")
  })

  it("names the debug id of each bundle in the stack", async () => {
    const bundle = "https://shop.test/assets/index-4f9a.js"
    const g = globalThis as { __berthaIds?: Record<string, string>; __berthaRelease?: string }
    g.__berthaIds = { [`Error\n    at ${bundle}:40:12\n    at load (https://shop.test/x.js:1:1)`]: "c0ffee00-0000-4000-8000-000000000001" }
    g.__berthaRelease = "abc123"
    const { client, events } = setup()
    const e = new Error("boom")
    e.stack = `Error: boom\n    at a (${bundle}:1:200)\n    at b (https://shop.test/vendor.js:1:1)`
    client.captureException(e)
    await client.flush()
    expect(events()[0]!.debugIds).toEqual({ [bundle]: "c0ffee00-0000-4000-8000-000000000001" })
    expect(events()[0]!.release).toBe("abc123")
  })
})

describe("envCommit", () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  it("takes the first variable that holds a sha", () => {
    for (const n of COMMIT_ENV) delete process.env[n]
    expect(envCommit()).toBeUndefined()
    process.env.GITHUB_SHA = "AB12CD34EF"
    process.env.HEROKU_SLUG_COMMIT = "not a sha"
    expect(envCommit()).toBe("ab12cd34ef")
    process.env.BERTHA_COMMIT = "1234567"
    expect(envCommit()).toBe("1234567")
  })
})
