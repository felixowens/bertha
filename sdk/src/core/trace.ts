// W3C trace context (`traceparent: 00-<trace id>-<span id>-<flags>`), so a page's
// requests and the server errors they cause share a trace id.

import type { IngestTrace } from "../generated/ingest.ts"

const TRACEPARENT = /^[\da-f]{2}-([\da-f]{32})-([\da-f]{16})-[\da-f]{2}$/

/** `n` random lowercase hex characters, never all zeros (the spec's invalid id). */
export function randomHex(n: number): string {
  const bytes = new Uint8Array(n / 2)
  const c = globalThis.crypto as Partial<Crypto> | undefined
  if (c?.getRandomValues) c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[0] ||= 1
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function traceparent(traceId: string, spanId: string): string {
  return `00-${traceId}-${spanId}-01`
}

/** The incoming request's trace: its trace id, and the caller's span. */
export function parseTraceparent(header: string | undefined): IngestTrace | undefined {
  const m = header && TRACEPARENT.exec(header.trim().toLowerCase())
  if (!m || /^0+$/.test(m[1]!) || /^0+$/.test(m[2]!)) return undefined
  return { traceId: m[1]!, spanId: m[2]! }
}
