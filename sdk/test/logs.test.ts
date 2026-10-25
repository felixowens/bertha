import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import * as browser from "../src/browser/index.ts"
import { Client, type LogRecord } from "../src/core/client.ts"
import { instrumentConsole } from "../src/core/console.ts"
import { log, setClient } from "../src/core/hub.ts"
import { fromAnyRequest } from "../src/core/request.ts"
import { fetchTransport } from "../src/core/transport.ts"
import type { Options, SendResult, Transport } from "../src/core/types.ts"
import * as edge from "../src/edge/index.ts"
import * as next from "../src/next/index.ts"
import * as node from "../src/node/index.ts"

const SDK = { name: "bertha.test", version: "0" }

interface Logs {
  resourceLogs: {
    resource: { attributes: { key: string; value: { stringValue: string } }[] }
    scopeLogs: { scope: { name: string; version: string }; logRecords: LogRecord[] }[]
  }[]
}

function setup(options: Partial<Options> = {}, replies: SendResult[] = [], readRequest?: typeof fromAnyRequest) {
  const sent: { path: string; body: unknown; final: boolean }[] = []
  const transport: Transport = {
    async send(body, final, path = "events") {
      sent.push({ path, body: JSON.parse(body), final })
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
    readRequest,
  )
  const logs = () => sent.filter((s) => s.path === "logs").map((s) => s.body as Logs)
  const records = () => logs().flatMap((l) => l.resourceLogs[0]!.scopeLogs[0]!.logRecords)
  return { client, sent, logs, records }
}

const attrs = (r: LogRecord) => Object.fromEntries(r.attributes.map((a) => [a.key, a.value.stringValue]))

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  setClient(undefined)
})

describe("log lines", () => {
  it("are batched a second after the first, as OTLP JSON", async () => {
    const { client, sent, logs, records } = setup({ release: "1.2.0", environment: "production" })
    client.service = "shop"
    client.log.info("Synced orders", { count: 41, source: "stripe", retry: { after: 2 } })
    client.log.debug("not sent at info")
    client.log.warn("Used the fallback")
    client.log.error(new TypeError("x is undefined"))
    expect(sent).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1000)
    expect(sent.map((s) => s.path)).toEqual(["logs"])
    const body = logs()[0]!.resourceLogs[0]!
    expect(body.resource.attributes).toEqual([
      { key: "service.name", value: { stringValue: "shop" } },
      { key: "service.version", value: { stringValue: "1.2.0" } },
      { key: "deployment.environment.name", value: { stringValue: "production" } },
    ])
    expect(body.scopeLogs[0]!.scope).toEqual(SDK)
    const [info, warn, error] = records()
    expect(info).toMatchObject({ severityNumber: 9, severityText: "info", body: { stringValue: "Synced orders" } })
    expect(attrs(info!)).toEqual({ count: "41", source: "stripe", retry: '{"after":2}' })
    expect(info!.timeUnixNano).toMatch(/^\d{19}$/)
    expect(info!.traceId).toBeUndefined()
    expect(warn).toMatchObject({ severityNumber: 13, severityText: "warning" })
    expect(error).toMatchObject({ severityNumber: 17, body: { stringValue: "TypeError: x is undefined" } })
    expect(records()).toHaveLength(3)
  })

  it("open no issues and keep events apart", async () => {
    const { client, sent } = setup()
    client.log.error("Webhook rejected")
    client.captureMessage("Cache warmed late")
    await client.flush()
    expect(sent.map((s) => s.path)).toEqual(["events", "logs"])
  })

  it("follow logLevel, and none are sent when it's off", async () => {
    const debug = setup({ logLevel: "debug" })
    debug.client.log.debug("cache miss")
    await debug.client.flush()
    expect(debug.records()).toHaveLength(1)

    const error = setup({ logLevel: "error" })
    error.client.log.warn("fallback")
    error.client.log.error("failed")
    await error.client.flush()
    expect(error.records().map((r) => r.body.stringValue)).toEqual(["failed"])

    const off = setup({ logLevel: "off" })
    off.client.log.error("failed")
    await off.client.flush()
    expect(off.sent).toHaveLength(0)
  })

  it("are scrubbed like events, and not when asked", async () => {
    const { client, records } = setup()
    client.log.warn("No account for ana@example.com", { apiKey: "k_1", url: "/cb?token=abc" })
    await client.flush()
    expect(records()[0]!.body.stringValue).toBe("No account for [email]")
    expect(attrs(records()[0]!)).toEqual({ url: "/cb?token=[redacted]" })

    const raw = setup({ scrub: false })
    raw.client.log.warn("ana@example.com")
    await raw.client.flush()
    expect(raw.records()[0]!.body.stringValue).toBe("ana@example.com")
  })

  it("carry the active trace, or the page's", async () => {
    const { client, records } = setup()
    client.pageTrace = () => ({ traceId: "a".repeat(32) })
    client.log.info("on the page")
    await client.flush()
    expect(records()[0]!.traceId).toBe("a".repeat(32))
    expect(records()[0]!.spanId).toBeUndefined()
  })

  it("stay on the request's trace when another tracer's span is active", async () => {
    const API = Symbol.for("opentelemetry.js.api.1")
    const SPAN = Symbol.for("OpenTelemetry Context Key SPAN")
    const g = globalThis as Record<symbol, unknown>
    let current: unknown = { spanContext: () => ({ traceId: "a".repeat(32), spanId: "d".repeat(16) }) }
    g[API] = { context: { active: () => ({ getValue: (k: symbol) => (k === SPAN ? current : undefined) }) } }
    const { client, records } = setup({}, [], fromAnyRequest)
    const req = { method: "GET", url: "/x", headers: { traceparent: `00-${"a".repeat(32)}-${"b".repeat(16)}-01` } }
    client.log.info("in the request's span", {}, { req })
    // Sentry's span, on its own trace: the request's traceparent wins.
    current = { spanContext: () => ({ traceId: "c".repeat(32), spanId: "e".repeat(16) }) }
    client.log.info("on another trace", {}, { req })
    client.log.info("no request")
    client.log.info("given", {}, { req, trace: { traceId: "f".repeat(32) } })
    current = undefined
    client.log.info("no span", {}, { req })
    client.log.info("a request without a traceparent", {}, { req: { method: "GET", url: "/", headers: {} } })
    await client.flush()
    expect(records().map((r) => [r.traceId, r.spanId])).toEqual([
      ["a".repeat(32), "d".repeat(16)],
      ["a".repeat(32), "b".repeat(16)],
      ["c".repeat(32), "e".repeat(16)],
      ["f".repeat(32), undefined],
      ["a".repeat(32), "b".repeat(16)],
      [undefined, undefined],
    ])
    delete g[API]
  })

  it("about a captured error carry its event id", async () => {
    const { client, records } = setup()
    const e = new Error("Couldn't save")
    const id = client.captureException(e)
    client.log.error(e)
    // Logged first and captured after, as error boundaries do.
    const later = new Error("Render failed")
    client.write("error", "Render failed", undefined, undefined, later)
    const laterId = client.captureException(later)
    client.log.error("Unrelated")
    await client.flush()
    expect(attrs(records()[0]!)["bertha.event_id"]).toBe(id)
    expect(attrs(records()[1]!)["bertha.event_id"]).toBe(laterId)
    expect(attrs(records()[2]!)["bertha.event_id"]).toBeUndefined()
    expect(JSON.stringify(records())).not.toContain("Symbol")
  })

  it("keep the last thousand while bertha asks to wait, and say how many were dropped", async () => {
    const { client, logs, records } = setup({}, [{ status: 429, retryAfter: 2 }])
    client.log.info("first")
    await client.flush()
    for (let i = 0; i < 1100; i++) client.log.info(`line ${i}`)
    await vi.advanceTimersByTimeAsync(2000)
    await client.flush()
    // The throttled try, then a thousand lines in batches of a hundred, the note first.
    expect(logs()).toHaveLength(1 + 10)
    const sent = records().slice(1)
    expect(sent[0]).toMatchObject({ severityText: "warning" })
    expect(attrs(sent[0]!)).toEqual({ "bertha.dropped": "101" })
    expect(sent[1]!.body.stringValue).toBe("line 100")
    expect(sent.at(-1)!.body.stringValue).toBe("line 1099")
    expect(sent).toHaveLength(1001)
  })

  it("stop when bertha doesn't take logs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const { client, sent } = setup({}, [{ status: 404 }])
    client.log.info("one")
    await client.flush()
    client.log.info("two")
    client.captureMessage("x")
    await client.flush()
    expect(sent.map((s) => s.path)).toEqual(["logs", "events"])
    expect(warn).toHaveBeenCalledWith(`[bertha] This bertha doesn't take logs. Upgrade it, or set logLevel to "off".`)
  })

  it("go on the final flush, as events do", async () => {
    const { client, sent } = setup()
    client.log.info("leaving")
    await client.flush(true)
    expect(sent).toMatchObject([{ path: "logs", final: true }])
  })
})

describe("log", () => {
  it("writes through the current client, and does nothing without one", async () => {
    log.info("before init")
    const { client, records } = setup()
    setClient(client)
    log.warn("Used the fallback", { status: 502 })
    await client.flush()
    expect(records().map((r) => [r.severityText, r.body.stringValue, attrs(r)])).toEqual([
      ["warning", "Used the fallback", { status: "502" }],
    ])
  })

  it("is exported from every entry", () => {
    for (const entry of [browser, node, edge, next]) expect(entry.log).toBe(log)
  })
})

describe("fetchTransport", () => {
  it("sends lines to the logs endpoint, keyed like events", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 202 }))
    const t = fetchTransport({ url: "https://b.test/", key: "k 1", keyInQuery: true, fetch })
    await t.send("{}", false, "logs")
    await t.send("{}", false)
    expect(fetch.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      "https://b.test/ingest/v1/logs?key=k%201",
      "https://b.test/ingest/v1/events?key=k%201",
    ])
  })
})

describe("captureConsole", () => {
  it("sends console calls as lines, keeps the breadcrumbs, and skips its own warnings", async () => {
    const quiet = () => undefined
    for (const m of ["debug", "log", "info", "warn", "error"] as const) vi.spyOn(console, m).mockImplementation(quiet)
    const { client, records } = setup({ captureConsole: true, logLevel: "debug" })
    setClient(client)
    instrumentConsole(true)
    const e = new Error("Couldn't save")
    const id = client.captureException(e)
    console.debug("cache miss")
    console.log("Loaded", { page: 2 })
    console.warn("Slow response")
    console.error("Save failed:", e)
    console.warn("[bertha] about itself")
    await client.flush()
    expect(records().map((r) => [r.severityText, r.body.stringValue])).toEqual([
      ["debug", "cache miss"],
      ["info", 'Loaded {"page":2}'],
      ["warning", "Slow response"],
      ["error", "Save failed: Couldn't save"],
    ])
    expect(attrs(records()[3]!)["bertha.event_id"]).toBe(id)

    // Without captureConsole, breadcrumbs only.
    const crumbs = setup()
    setClient(crumbs.client)
    console.warn("Slow again")
    crumbs.client.captureMessage("x")
    await crumbs.client.flush()
    expect(crumbs.records()).toHaveLength(0)
    const event = (crumbs.sent[0]!.body as { events: { breadcrumbs: unknown[] }[] }).events[0]!
    expect(event.breadcrumbs).toMatchObject([{ category: "console", level: "warning", message: "Slow again" }])
  })
})
