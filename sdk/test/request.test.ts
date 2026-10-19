import { describe, expect, it } from "vitest"

import { fromAnyRequest, fromRequest } from "../src/core/request.ts"
import { parseTraceparent, randomHex, traceparent } from "../src/core/trace.ts"

const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736"
const SPAN = "00f067aa0ba902b7"

describe("traceparent", () => {
  it("round-trips, and rejects what the spec calls invalid", () => {
    expect(parseTraceparent(traceparent(TRACE, SPAN))).toEqual({ traceId: TRACE, spanId: SPAN })
    expect(parseTraceparent(` 00-${TRACE.toUpperCase()}-${SPAN}-00 `)).toEqual({ traceId: TRACE, spanId: SPAN })
    expect(parseTraceparent(undefined)).toBeUndefined()
    expect(parseTraceparent("garbage")).toBeUndefined()
    expect(parseTraceparent(`00-${"0".repeat(32)}-${SPAN}-01`)).toBeUndefined()
    expect(parseTraceparent(`00-${TRACE}-${"0".repeat(16)}-01`)).toBeUndefined()
  })

  it("makes random ids of the asked length", () => {
    const a = randomHex(32)
    expect(a).toMatch(/^[\da-f]{32}$/)
    expect(randomHex(16)).toMatch(/^[\da-f]{16}$/)
    expect(randomHex(32)).not.toBe(a)
  })
})

describe("fromRequest", () => {
  it("keeps headers but never credentials, and finds the client and trace", () => {
    const ctx = fromRequest(
      "POST",
      "https://api.test/orders",
      {
        Host: "api.test",
        Authorization: "Bearer secret",
        cookie: "sid=1",
        "x-api-key": "k",
        "proxy-authorization": "Basic x",
        "x-forwarded-for": "203.0.113.9, 10.0.0.1",
        accept: ["application/json", "text/plain"],
        traceparent: traceparent(TRACE, SPAN),
        "user-agent": "u".repeat(600),
        skipped: 3,
      },
      "10.0.0.2",
    )
    expect(ctx.request!.headers).toEqual({
      host: "api.test",
      "x-forwarded-for": "203.0.113.9, 10.0.0.1",
      accept: "application/json, text/plain",
      traceparent: traceparent(TRACE, SPAN),
      "user-agent": `${"u".repeat(511)}…`,
    })
    expect(ctx.user).toEqual({ ip: "203.0.113.9" })
    expect(ctx.trace).toEqual({ traceId: TRACE, spanId: SPAN })
  })

  it("falls back to the socket, and caps the headers", () => {
    const many = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`h${i}`, "v"]))
    const ctx = fromRequest("GET", "/", many, "10.0.0.2")
    expect(Object.keys(ctx.request!.headers!)).toHaveLength(30)
    expect(ctx.user).toEqual({ ip: "10.0.0.2" })
    expect(ctx.trace).toBeUndefined()
    expect(fromRequest("GET", "/", {}).user).toBeUndefined()
  })
})

describe("fromAnyRequest", () => {
  it("reads Node, Express and Koa requests", () => {
    const node = { method: "POST", url: "/pay", headers: { host: "api.test" }, socket: { remoteAddress: "10.0.0.2" } }
    expect(fromAnyRequest(node)).toEqual({
      request: { method: "POST", url: "http://api.test/pay", headers: { host: "api.test" } },
      user: { ip: "10.0.0.2" },
    })
    const express = { ...node, url: "/", originalUrl: "/v1/pay", headers: { host: "api.test", "x-forwarded-proto": "https,http" } }
    expect(fromAnyRequest(express).request!.url).toBe("https://api.test/v1/pay")
  })

  it("reads a Fetch request", () => {
    const req = new Request("https://api.test/orders?x=1", {
      method: "PUT",
      headers: { authorization: "Bearer secret", traceparent: traceparent(TRACE, SPAN) },
    })
    const ctx = fromAnyRequest(req)
    expect(ctx.request).toEqual({
      method: "PUT",
      url: "https://api.test/orders?x=1",
      headers: { traceparent: traceparent(TRACE, SPAN) },
    })
    expect(ctx.trace).toEqual({ traceId: TRACE, spanId: SPAN })
  })

  it("gives nothing for what isn't a request", () => {
    for (const r of [undefined, null, "GET /", { method: "GET" }, { url: "/", headers: {} }]) expect(fromAnyRequest(r)).toEqual({})
  })
})
