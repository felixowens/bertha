// The active OpenTelemetry span, when the app runs OpenTelemetry, read off the API's
// global so the SDK doesn't depend on @opentelemetry/api.

import type { IngestTrace } from "./types.ts"

interface Context {
  getValue?(key: symbol): unknown
}
interface Api {
  context?: { active?(): Context }
}
interface Span {
  spanContext?(): { traceId?: string; spanId?: string }
}

const API = Symbol.for("opentelemetry.js.api.1")
const SPAN = Symbol.for("OpenTelemetry Context Key SPAN")
const INVALID = /^0*$/

/** The span the code is running in, so an error lands on it in the trace. */
export function activeSpan(): IngestTrace | undefined {
  try {
    const api = (globalThis as Record<symbol, Api | undefined>)[API]
    const c = (api?.context?.active?.().getValue?.(SPAN) as Span | undefined)?.spanContext?.()
    if (!c?.traceId || !c.spanId || INVALID.test(c.traceId) || INVALID.test(c.spanId)) return undefined
    return { traceId: c.traceId, spanId: c.spanId }
  } catch {
    return undefined
  }
}
