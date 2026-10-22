// @bigbertha/sdk/browser: uncaught errors and rejections, with the page they happened
// on and its state, breadcrumbs from fetch, XHR, navigation, clicks and the console, and
// log lines from `log` (and the console, with `captureConsole`).

import { Client } from "../core/client.ts"
import { instrumentConsole } from "../core/console.ts"
import { setClient } from "../core/hub.ts"
import { scrubUrl } from "../core/scrub.ts"
import { randomHex, traceparent } from "../core/trace.ts"
import { fetchTransport, streamGzip } from "../core/transport.ts"
import type { IngestEvent, Options } from "../core/types.ts"
import { VERSION } from "../core/version.ts"
import { type Spans, spans } from "./spans.ts"
import { userAgent } from "./user-agent.ts"

export { addBreadcrumb, captureException, captureMessage, flush, getClient, log, setTag, setUser } from "../core/hub.ts"
export type { CaptureContext, IngestEvent, LogFields, Logger, LogLevel, Options } from "../core/types.ts"

export interface BrowserOptions extends Options {
  /** Which breadcrumbs to record automatically. All on by default. */
  breadcrumbs?: Partial<Record<"fetch" | "xhr" | "navigation" | "click" | "console", boolean>>
  /** Store the visitor's IP address with each event (bertha reads it from the request). On by default. */
  sendIp?: boolean
  /**
   * Other origins whose requests get a `traceparent` header, so their errors link to this
   * page's: URL prefixes or patterns. Same-origin requests always get one. The server
   * must allow the header in CORS.
   */
  tracePropagationTargets?: (string | RegExp)[]
  /**
   * Record the page's requests as spans, and send them to the trace once the page has
   * had an error, so its waterfall shows what the browser did. On by default.
   */
  spans?: boolean
}

let installed = false
/** One trace per page load: every error and request from it shares this id. */
const traceId = randomHex(32)

export function init(options: BrowserOptions): Client | undefined {
  if (typeof window === "undefined") return undefined
  if (!options.key || !options.url) {
    console.warn("[bertha] init needs a key and a url. Nothing will be sent.")
    return undefined
  }
  const nativeFetch = window.fetch.bind(window)
  const beacon = (url: string, body: string) => !!navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }))
  const recorder = options.spans === false ? undefined : spans({ url: options.url, key: options.key, traceId, fetch: nativeFetch, beacon })
  const client = new Client(
    options,
    fetchTransport({
      url: options.url,
      key: options.key,
      keyInQuery: true,
      gzip: streamGzip,
      fetch: nativeFetch,
      beacon,
    }),
    { name: "bertha.browser", version: VERSION },
    { ...userAgent(navigator.userAgent), userAgent: navigator.userAgent },
    undefined,
    (event) => {
      enrich(event, options.sendIp !== false)
      recorder?.errored()
    },
  )
  client.pageTrace = () => ({ traceId })
  setClient(client)
  if (installed) return client
  installed = true

  window.addEventListener("error", (e) => {
    // Resource load errors (img, script) bubble here too, without an error object.
    if (!e.error && !e.message) return
    client.captureException(e.error ?? new ErrorFromEvent(e), {
      level: "error",
      mechanism: { handler: "onerror", handled: false },
    })
  })
  window.addEventListener("unhandledrejection", (e) =>
    client.captureException(e.reason, { mechanism: { handler: "onunhandledrejection", handled: false } }),
  )
  const final = () => {
    void client.flush(true)
    recorder?.flush(true)
  }
  addEventListener("pagehide", final)

  const on = { fetch: true, xhr: true, navigation: true, click: true, console: true, ...options.breadcrumbs }
  const base = options.url.replace(/\/+$/, "")
  const crumb = (category: string, message: string, level?: string, timestamp?: string) =>
    client.addBreadcrumb({ category, message, ...(level ? { level } : {}), ...(timestamp ? { timestamp } : {}) })
  document.addEventListener("visibilitychange", () => {
    const hidden = document.visibilityState === "hidden"
    if (on.navigation) crumb("navigation", hidden ? "Page hidden" : "Page visible")
    if (hidden) final()
  })
  const propagate = propagateTo(options.tracePropagationTargets ?? [])
  const quiet: Crumb = () => undefined
  if (on.fetch || recorder) instrumentFetch(base, on.fetch ? crumb : quiet, propagate, recorder)
  if (on.xhr || recorder) instrumentXhr(base, on.xhr ? crumb : quiet, propagate, recorder)
  if (on.navigation) instrumentHistory(crumb)
  if (on.click) instrumentClicks(crumb)
  if (on.console || options.captureConsole) instrumentConsole(on.console)
  return client
}

type Crumb = (category: string, message: string, level?: string, timestamp?: string) => void
/** The span id to send with a request to this URL, or undefined when it shouldn't carry one. */
type Propagate = (url: string) => string | undefined

/** What the page looked like when it failed. Called for every event. */
export function enrich(event: IngestEvent, sendIp: boolean): void {
  event.request ??= { method: "GET", url: scrubUrl(location.href) }
  if (sendIp && !event.user?.ip) event.user = { ...event.user, ip: "auto" }
  event.trace ??= { traceId }
  const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined
  const connection = (navigator as { connection?: { effectiveType?: string; saveData?: boolean } }).connection
  let timezone: string | undefined
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    // Old engines without Intl.
  }
  const next = (window as { next?: { version?: string } }).next?.version
  event.context = {
    ...event.context,
    viewport: `${innerWidth}×${innerHeight} @${Math.round(devicePixelRatio * 100) / 100}x`,
    online: navigator.onLine,
    visible: document.visibilityState === "visible",
    navigation: nav?.type,
    automated: !!navigator.webdriver,
    pageAgeMs: Math.round(performance.now()),
    referrer: document.referrer || undefined,
    language: navigator.language,
    timezone,
    connection: connection?.effectiveType && `${connection.effectiveType}${connection.saveData ? ", save data" : ""}`,
    versions: { ...(next ? { next } : {}), ...event.context?.versions },
  }
}

/** Same-origin URLs, and those the app listed, get a new span. */
function propagateTo(targets: (string | RegExp)[]): Propagate {
  return (url) => {
    let abs: URL
    try {
      abs = new URL(url, location.href)
    } catch {
      return undefined
    }
    const listed = targets.some((t) => (typeof t === "string" ? abs.href.startsWith(t) : t.test(abs.href)))
    return abs.origin === location.origin || listed ? randomHex(16) : undefined
  }
}

class ErrorFromEvent extends Error {
  constructor(e: ErrorEvent) {
    super(e.message)
    this.name = "Error"
    this.stack = `${e.message}\n    at ${e.filename}:${e.lineno}:${e.colno}`
  }
}

/** `GET /x 200 in 34ms, span 00f067aa0ba902b7` */
function requestLine(method: string, url: string, status: number | string, start: number, span?: string): string {
  const ms = Math.round(performance.now() - start)
  return `${method.toUpperCase()} ${scrubUrl(url)} ${status} in ${ms}ms${span ? `, span ${span}` : ""}`
}

function instrumentFetch(base: string, crumb: Crumb, propagate: Propagate, recorder?: Spans): void {
  const original = window.fetch
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? (input instanceof Request ? input.method : "GET")
    if (url.startsWith(base)) return original.call(window, input, init)
    const span = propagate(url)
    if (span) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
      if (!headers.has("traceparent")) headers.set("traceparent", traceparent(traceId, span))
      init = { ...init, headers }
    }
    const start = performance.now()
    const done = recorder?.request(method, url, span ?? randomHex(16))
    try {
      const res = await original.call(window, input, init)
      crumb("fetch", requestLine(method, url, res.status, start, span), res.status >= 400 ? "error" : undefined)
      done?.(res.status)
      return res
    } catch (e) {
      crumb("fetch", requestLine(method, url, "failed", start, span), "error")
      done?.(0, e)
      throw e
    }
  }
}

function instrumentXhr(base: string, crumb: Crumb, propagate: Propagate, recorder?: Spans): void {
  const proto = XMLHttpRequest.prototype
  const open = proto.open
  const send = proto.send
  const meta = new WeakMap<XMLHttpRequest, [string, string]>()
  proto.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    meta.set(this, [method, String(url)])
    return (open as (...a: unknown[]) => void).call(this, method, url, ...rest)
  } as typeof proto.open
  proto.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const m = meta.get(this)
    if (m && !m[1].startsWith(base)) {
      const span = propagate(m[1])
      // Throws once the request was sent, or when the app set the header itself.
      if (span) {
        try {
          this.setRequestHeader("traceparent", traceparent(traceId, span))
        } catch {
          // Leave the request as the app made it.
        }
      }
      const start = performance.now()
      const done = recorder?.request(m[0], m[1], span ?? randomHex(16))
      this.addEventListener("loadend", () => {
        crumb("fetch", requestLine(m[0], m[1], this.status || "failed", start, span), !this.status || this.status >= 400 ? "error" : undefined)
        done?.(this.status, this.status ? undefined : "The request failed: no response")
      })
    }
    return send.call(this, body)
  }
}

function instrumentHistory(crumb: Crumb): void {
  const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined
  const loaded = new Date(performance.timeOrigin || Date.now()).toISOString()
  crumb("navigation", `Loaded ${scrubUrl(path(location.href))}${nav ? ` (${nav.type})` : ""}`, undefined, loaded)
  addEventListener("pageshow", (e) => {
    if (e.persisted) crumb("navigation", `Restored ${scrubUrl(path(location.href))} from the back-forward cache`)
  })
  let last = location.href
  const record = () => {
    const to = location.href
    if (to === last) return
    crumb("navigation", `${scrubUrl(path(last))} → ${scrubUrl(path(to))}`)
    last = to
  }
  for (const m of ["pushState", "replaceState"] as const) {
    const original = history[m]
    history[m] = function (this: History, ...args: Parameters<History["pushState"]>) {
      const r = original.apply(this, args)
      record()
      return r
    }
  }
  addEventListener("popstate", record)
}

function path(href: string): string {
  try {
    const u = new URL(href)
    return u.pathname + u.search
  } catch {
    return href
  }
}

function instrumentClicks(crumb: Crumb): void {
  document.addEventListener(
    "click",
    (e) => {
      const el = (e.target as Element | null)?.closest?.("a,button,[role=button],input,select,label,summary")
      if (el) crumb("ui", describeElement(el))
    },
    { capture: true, passive: true },
  )
}

function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const label =
    el.getAttribute("aria-label") ??
    el.getAttribute("data-testid") ??
    (tag === "input" ? el.getAttribute("name") : el.textContent?.trim().replace(/\s+/g, " ").slice(0, 60))
  const id = el.id ? `#${el.id}` : ""
  return label ? `Clicked ${tag}${id} "${label}"` : `Clicked ${tag}${id}`
}

