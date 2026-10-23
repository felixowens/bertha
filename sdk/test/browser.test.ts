import { afterEach, describe, expect, it, vi } from "vitest"

import { enrich, eventFrame } from "../src/browser/index.ts"
import type { IngestEvent } from "../src/core/types.ts"

function page(o: { webdriver?: boolean; referrer?: string; next?: string } = {}) {
  vi.stubGlobal("location", new URL("https://shop.test/courses/discounted-packages?token=t1"))
  vi.stubGlobal("navigator", {
    onLine: false,
    webdriver: o.webdriver ?? false,
    language: "en-GB",
    connection: { effectiveType: "3g", saveData: true },
  })
  vi.stubGlobal("document", { visibilityState: "hidden", referrer: o.referrer ?? "" })
  vi.stubGlobal("window", o.next ? { next: { version: o.next } } : {})
  vi.stubGlobal("innerWidth", 1194)
  vi.stubGlobal("innerHeight", 702)
  vi.stubGlobal("devicePixelRatio", 2)
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([{ type: "back_forward" } as unknown as PerformanceEntry])
  vi.spyOn(performance, "now").mockReturnValue(192_000.4)
}

const event = (e: Partial<IngestEvent> = {}): IngestEvent => ({ id: "e1", timestamp: "2026-10-19T00:00:00Z", level: "error", ...e })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("enrich", () => {
  it("records the page, its state and the visitor's IP", () => {
    page({ referrer: "https://search.test/?q=x&session=s1", next: "15.5.2" })
    const e = event({ context: { runtime: "Safari 18", versions: { react: "19.3.1" } } })
    enrich(e, true)
    expect(e.request).toEqual({ method: "GET", url: "https://shop.test/courses/discounted-packages?token=[redacted]" })
    expect(e.user).toEqual({ ip: "auto" })
    expect(e.trace!.traceId).toMatch(/^[\da-f]{32}$/)
    expect(e.trace!.spanId).toBeUndefined()
    expect(e.context).toEqual({
      runtime: "Safari 18",
      viewport: "1194×702 @2x",
      online: false,
      visible: false,
      navigation: "back_forward",
      automated: false,
      pageAgeMs: 192_000,
      referrer: "https://search.test/?q=x&session=s1",
      language: "en-GB",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      connection: "3g, save data",
      versions: { next: "15.5.2", react: "19.3.1" },
    })
  })

  it("keeps what the caller set, and the IP off when asked", () => {
    page({ webdriver: true })
    const e = event({ request: { method: "POST", url: "https://shop.test/pay" }, user: { id: "u1" } })
    enrich(e, false)
    expect(e.request).toEqual({ method: "POST", url: "https://shop.test/pay" })
    expect(e.user).toEqual({ id: "u1" })
    expect(e.context!.automated).toBe(true)
    expect(e.context!.referrer).toBeUndefined()

    const set = event({ user: { ip: "203.0.113.9" } })
    enrich(set, true)
    expect(set.user).toEqual({ ip: "203.0.113.9" })
  })
})

describe("eventFrame", () => {
  it("is where the page's script threw", () => {
    expect(eventFrame({ filename: "https://shop.test/assets/index.js", lineno: 3, colno: 14 })).toEqual({
      file: "https://shop.test/assets/index.js",
      line: 3,
      column: 14,
    })
    expect(eventFrame({ filename: "chrome-extension://abcd/inject.js", lineno: 1, colno: 2 }).inApp).toBe(false)
  })

  it("marks a script with no URL as not the app's", () => {
    expect(eventFrame({ filename: "", lineno: 0, colno: 0 })).toEqual({ file: "<anonymous>", inApp: false })
  })
})
