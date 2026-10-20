// The page's own requests as OpenTelemetry spans, so a trace shows what the browser did
// around the server's spans. They wait in memory and are sent only once the page has
// had an error: bertha keeps a trace only when an error names it.

import { scrubUrl } from "../core/scrub.ts"
import { randomHex } from "../core/trace.ts"
import { endpoint } from "../core/transport.ts"
import { VERSION } from "../core/version.ts"

/** Spans a page holds before its first error, and sends in all. */
const HELD = 200
const SENT = 1000
/** Time for the requests in flight when the error happened to finish. */
const SETTLE_MS = 3000

interface Span {
  spanId: string
  parentSpanId: string
  name: string
  kind: 1 | 3
  start: number
  end: number
  attributes: Record<string, string | number>
  error?: string
}

export interface Spans {
  /** Starts a request span; call what it returns with the status or the error. */
  request(method: string, url: string, spanId: string): (status: number, error?: unknown) => void
  /** The page has an event: send what it has, and keep sending. */
  errored(): void
  flush(final: boolean): void
}

export function spans(o: {
  url: string
  key: string
  traceId: string
  fetch: typeof fetch
  beacon: (url: string, body: string) => boolean
}): Spans {
  const target = `${endpoint(o.url, "traces")}?key=${encodeURIComponent(o.key)}`
  const origin = performance.timeOrigin || Date.now() - performance.now()
  const now = () => origin + performance.now()
  const page: Span = { spanId: randomHex(16), parentSpanId: "", name: `page ${location.pathname}`, kind: 1, start: origin, end: origin, attributes: { "url.full": scrubUrl(location.href) } }
  let held: Span[] = []
  let sent = 0
  let loaded = false
  let armed = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const later = () => (timer ??= setTimeout(() => flush(false), SETTLE_MS))

  function flush(final: boolean) {
    clearTimeout(timer)
    timer = undefined
    if (!armed) return
    const batch = held.splice(0, SENT - sent)
    const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined
    const end = nav && (nav.loadEventEnd || nav.domContentLoadedEventEnd)
    if (!loaded && nav && end) {
      loaded = true
      batch.push({ spanId: randomHex(16), parentSpanId: page.spanId, name: "document load", kind: 1, start: origin + nav.startTime, end: origin + end, attributes: { "navigation.type": nav.type } })
    }
    if (!batch.length && !final) return
    sent += batch.length
    // The page span grows with the page; bertha keeps its longest copy.
    page.end = now()
    batch.unshift(page)
    const body = JSON.stringify(otlpJson(o.traceId, batch))
    if (final && o.beacon(target, body)) return
    o.fetch(target, { method: "POST", headers: { "content-type": "text/plain" }, body, keepalive: body.length < 60_000, credentials: "omit" }).catch(() => undefined)
  }

  return {
    request(method, url, spanId) {
      const start = now()
      let abs: URL | undefined
      try {
        abs = new URL(url, location.href)
      } catch {
        // Recorded as the app wrote it.
      }
      const where = !abs ? url : abs.origin === location.origin ? abs.pathname : abs.host + abs.pathname
      return (status, error) => {
        if (sent + held.length >= SENT) return
        const span: Span = {
          spanId,
          parentSpanId: page.spanId,
          name: `${method.toUpperCase()} ${where}`,
          kind: 3,
          start,
          end: now(),
          attributes: { "http.request.method": method.toUpperCase(), "url.full": scrubUrl(abs?.href ?? url), ...(status ? { "http.response.status_code": status } : {}) },
          error: error !== undefined ? (error instanceof Error ? error.message : String(error)) : status >= 400 ? `HTTP ${status}` : undefined,
        }
        held.push(span)
        if (!armed && held.length > HELD) held = held.slice(-HELD)
        if (armed) later()
      }
    },
    errored() {
      armed = true
      later()
    },
    flush,
  }
}

/** Epoch milliseconds as OTLP's nanoseconds, in a string: they're past 2^53. */
function nanos(ms: number): string {
  return `${Math.round(ms * 1000)}000`
}

function otlpJson(traceId: string, batch: Span[]) {
  // bertha keeps every attribute as text.
  const attr = (key: string, v: string | number) => ({ key, value: { stringValue: String(v) } })
  return {
    resourceSpans: [
      {
        resource: { attributes: [attr("telemetry.sdk.language", "webjs"), attr("telemetry.sdk.name", "@bigbertha/sdk"), attr("telemetry.sdk.version", VERSION)] },
        scopeSpans: [
          {
            scope: { name: "@bigbertha/sdk", version: VERSION },
            spans: batch.map((s) => ({
              traceId,
              spanId: s.spanId,
              parentSpanId: s.parentSpanId,
              name: s.name,
              kind: s.kind,
              startTimeUnixNano: nanos(s.start),
              endTimeUnixNano: nanos(s.end),
              attributes: Object.entries(s.attributes).map(([k, v]) => attr(k, v)),
              status: s.error ? { code: 2, message: s.error } : {},
            })),
          },
        ],
      },
    ],
  }
}
