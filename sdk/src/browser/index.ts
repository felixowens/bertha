// @bigbertha/sdk/browser: uncaught errors and rejections, with breadcrumbs from
// fetch, XHR, navigation, clicks and the console.

import { Client } from "../core/client.ts"
import { setClient } from "../core/hub.ts"
import { scrubUrl } from "../core/scrub.ts"
import { fetchTransport, streamGzip } from "../core/transport.ts"
import type { Options } from "../core/types.ts"
import { VERSION } from "../core/version.ts"
import { userAgent } from "./user-agent.ts"

export { addBreadcrumb, captureException, captureMessage, flush, getClient, setTag, setUser } from "../core/hub.ts"
export type { CaptureContext, IngestEvent, Options } from "../core/types.ts"

export interface BrowserOptions extends Options {
  /** Which breadcrumbs to record automatically. All on by default. */
  breadcrumbs?: Partial<Record<"fetch" | "xhr" | "navigation" | "click" | "console", boolean>>
}

let installed = false

export function init(options: BrowserOptions): Client | undefined {
  if (typeof window === "undefined") return undefined
  if (!options.key || !options.url) {
    console.warn("[bertha] init needs a key and a url. Nothing will be sent.")
    return undefined
  }
  const nativeFetch = window.fetch.bind(window)
  const client = new Client(
    options,
    fetchTransport({
      url: options.url,
      key: options.key,
      keyInQuery: true,
      gzip: streamGzip,
      fetch: nativeFetch,
      beacon: (url, body) => !!navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" })),
    }),
    { name: "bertha.browser", version: VERSION },
    { ...userAgent(navigator.userAgent), userAgent: navigator.userAgent },
  )
  setClient(client)
  if (installed) return client
  installed = true

  window.addEventListener("error", (e) => {
    // Resource load errors (img, script) bubble here too, without an error object.
    if (!e.error && !e.message) return
    client.captureException(e.error ?? new ErrorFromEvent(e), { level: "error" })
  })
  window.addEventListener("unhandledrejection", (e) => client.captureException(e.reason))
  addEventListener("pagehide", () => void client.flush(true))
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void client.flush(true)
  })

  const on = { fetch: true, xhr: true, navigation: true, click: true, console: true, ...options.breadcrumbs }
  const base = options.url.replace(/\/+$/, "")
  const crumb = (category: string, message: string, level?: string) =>
    client.addBreadcrumb(level ? { category, message, level } : { category, message })
  if (on.fetch) instrumentFetch(base, crumb)
  if (on.xhr) instrumentXhr(base, crumb)
  if (on.navigation) instrumentHistory(crumb)
  if (on.click) instrumentClicks(crumb)
  if (on.console) instrumentConsole(crumb)
  return client
}

type Crumb = (category: string, message: string, level?: string) => void

class ErrorFromEvent extends Error {
  constructor(e: ErrorEvent) {
    super(e.message)
    this.name = "Error"
    this.stack = `${e.message}\n    at ${e.filename}:${e.lineno}:${e.colno}`
  }
}

function requestLine(method: string, url: string, status: number | string): string {
  return `${method.toUpperCase()} ${scrubUrl(url)} ${status}`
}

function instrumentFetch(base: string, crumb: Crumb): void {
  const original = window.fetch
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? (input instanceof Request ? input.method : "GET")
    if (url.startsWith(base)) return original.call(window, input, init)
    try {
      const res = await original.call(window, input, init)
      crumb("fetch", requestLine(method, url, res.status), res.status >= 400 ? "error" : undefined)
      return res
    } catch (e) {
      crumb("fetch", requestLine(method, url, "failed"), "error")
      throw e
    }
  }
}

function instrumentXhr(base: string, crumb: Crumb): void {
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
      this.addEventListener("loadend", () =>
        crumb("fetch", requestLine(m[0], m[1], this.status || "failed"), !this.status || this.status >= 400 ? "error" : undefined),
      )
    }
    return send.call(this, body)
  }
}

function instrumentHistory(crumb: Crumb): void {
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

function instrumentConsole(crumb: Crumb): void {
  for (const level of ["warn", "error"] as const) {
    const original = console[level]
    console[level] = (...args: unknown[]) => {
      const text = args.map((a) => (typeof a === "string" ? a : a instanceof Error ? a.message : safeJson(a))).join(" ")
      if (!text.startsWith("[bertha]")) crumb("console", text.slice(0, 500), level === "warn" ? "warning" : "error")
      original.apply(console, args)
    }
  }
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v) ?? String(v)
  } catch {
    return String(v)
  }
}
