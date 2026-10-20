import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { spans } from "../src/browser/spans.ts"
import { otlp } from "../src/core/otlp.ts"

interface OtlpSpan {
  spanId: string
  parentSpanId: string
  name: string
  kind: number
  startTimeUnixNano: string
  endTimeUnixNano: string
  attributes: { key: string; value: { stringValue: string } }[]
  status: { code?: number; message?: string }
}

const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736"
const ORIGIN = 1_760_000_000_000

function page() {
  vi.stubGlobal("location", new URL("https://shop.test/cart?token=t1"))
  vi.spyOn(performance, "timeOrigin", "get").mockReturnValue(ORIGIN)
  let t = 100
  vi.spyOn(performance, "now").mockImplementation(() => (t += 50))
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([
    { type: "navigate", startTime: 0, loadEventEnd: 420, domContentLoadedEventEnd: 300 } as unknown as PerformanceEntry,
  ])
  const posts: { url: string; spans: OtlpSpan[]; init: RequestInit }[] = []
  const beacons: { url: string; spans: OtlpSpan[] }[] = []
  const read = (body: string) => {
    const j = JSON.parse(body) as { resourceSpans: { resource: { attributes: { key: string }[] }; scopeSpans: { spans: OtlpSpan[] }[] }[] }
    expect(j.resourceSpans[0]!.resource.attributes.map((a) => a.key)).toContain("telemetry.sdk.language")
    return j.resourceSpans[0]!.scopeSpans[0]!.spans
  }
  const s = spans({
    url: "https://bertha.test/",
    key: "pk_1",
    traceId: TRACE,
    fetch: (async (url: string, init: RequestInit) => {
      posts.push({ url, spans: read(init.body as string), init })
      return new Response("{}")
    }) as typeof fetch,
    beacon: (url, body) => {
      beacons.push({ url, spans: read(body) })
      return true
    },
  })
  return { s, posts, beacons }
}

const attrs = (s: OtlpSpan) => Object.fromEntries(s.attributes.map((a) => [a.key, a.value.stringValue]))

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("browser spans", () => {
  it("holds requests until the page has an error, then sends them to the trace", async () => {
    const { s, posts } = page()
    s.request("get", "/api/cart?session_id=s1", "00f067aa0ba902b7")(200)
    s.request("POST", "https://pay.test/charge", "1111111111111111")(0, new TypeError("Failed to fetch"))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(posts).toEqual([])

    s.errored()
    const late = s.request("GET", "/api/slow", "2222222222222222")
    await vi.advanceTimersByTimeAsync(1000)
    late(502)
    await vi.advanceTimersByTimeAsync(3000)
    expect(posts).toHaveLength(1)
    const { url, spans: sent, init } = posts[0]!
    expect(url).toBe("https://bertha.test/ingest/v1/traces?key=pk_1")
    expect(init.headers).toEqual({ "content-type": "text/plain" })
    const [root, cart, pay, slow, load] = sent
    expect(sent.map((x) => x.name)).toEqual(["page /cart", "GET /api/cart", "POST pay.test/charge", "GET /api/slow", "document load"])
    expect(root!.parentSpanId).toBe("")
    expect(attrs(root!)["url.full"]).toBe("https://shop.test/cart?token=[redacted]")
    for (const child of [cart, pay, slow, load]) expect(child!.parentSpanId).toBe(root!.spanId)
    expect(cart!.spanId).toBe("00f067aa0ba902b7")
    expect(cart!.kind).toBe(3)
    expect(attrs(cart!)).toEqual({
      "http.request.method": "GET",
      "url.full": "https://shop.test/api/cart?session_id=[redacted]",
      "http.response.status_code": "200",
    })
    expect(cart!.status).toEqual({})
    expect(pay!.status).toEqual({ code: 2, message: "Failed to fetch" })
    expect(attrs(pay!)["http.response.status_code"]).toBeUndefined()
    expect(slow!.status).toEqual({ code: 2, message: "HTTP 502" })
    expect(BigInt(slow!.endTimeUnixNano) - BigInt(slow!.startTimeUnixNano)).toBe(50_000_000n)
    expect(load!.startTimeUnixNano).toBe(`${ORIGIN}000000`)
    expect(load!.endTimeUnixNano).toBe(`${ORIGIN + 420}000000`)
  })

  it("keeps sending after the error, and hands the rest to a beacon as the page goes", async () => {
    const { s, posts, beacons } = page()
    s.errored()
    await vi.advanceTimersByTimeAsync(3000)
    expect(posts[0]!.spans.map((x) => x.name)).toEqual(["page /cart", "document load"])
    s.request("GET", "/a", "3333333333333333")(200)
    s.flush(true)
    expect(beacons).toHaveLength(1)
    const [root, a] = beacons[0]!.spans
    expect(a!.name).toBe("GET /a")
    expect(BigInt(root!.endTimeUnixNano)).toBeGreaterThan(BigInt(posts[0]!.spans[0]!.endTimeUnixNano))
  })

  it("holds only the newest requests before an error", async () => {
    const { s, posts } = page()
    for (let i = 0; i < 250; i++) s.request("GET", `/r/${i}`, i.toString(16).padStart(16, "0"))(200)
    s.errored()
    await vi.advanceTimersByTimeAsync(3000)
    const names = posts[0]!.spans.map((x) => x.name)
    expect(names).toHaveLength(202)
    expect(names[1]).toBe("GET /r/50")
  })

  it("sends nothing on unload without an error", () => {
    const { s, posts, beacons } = page()
    s.request("GET", "/a", "3333333333333333")(200)
    s.flush(true)
    expect([...posts, ...beacons]).toEqual([])
  })
})

describe("otlp", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("points an exporter at bertha with the project key", () => {
    vi.stubEnv("BERTHA_URL", "https://bertha.test/")
    vi.stubEnv("BERTHA_KEY", "pk_env")
    expect(otlp()).toEqual({ url: "https://bertha.test/ingest/v1/traces", headers: { authorization: "Bearer pk_env" } })
    expect(otlp({ url: "https://b.test", key: "pk_2" })).toEqual({ url: "https://b.test/ingest/v1/traces", headers: { authorization: "Bearer pk_2" } })
  })

  it("warns and leaves the exporter's own settings without them", () => {
    vi.stubEnv("BERTHA_URL", "")
    vi.stubEnv("BERTHA_KEY", "")
    vi.stubEnv("NEXT_PUBLIC_BERTHA_URL", "")
    vi.stubEnv("NEXT_PUBLIC_BERTHA_KEY", "")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    expect(otlp()).toEqual({})
    expect(warn).toHaveBeenCalledOnce()
  })
})
