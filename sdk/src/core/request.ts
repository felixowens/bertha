// The request a server-side error happened in, from its method, URL and headers.

import { parseTraceparent } from "./trace.ts"
import type { CaptureContext } from "./types.ts"

/** Never sent: they'd let anyone reading the event act as the user. */
const CREDENTIAL_HEADERS = new Set(["authorization", "proxy-authorization", "cookie", "set-cookie", "x-api-key"])
const HEADERS = 30
const HEADER_CHARS = 512

/**
 * The request an error happened in: its headers without credentials, the client's IP
 * (the first proxy hop, else the socket) and the trace from an incoming `traceparent`.
 */
export function fromRequest(
  method: string,
  url: string,
  headers: Record<string, unknown>,
  remoteAddress?: string,
): CaptureContext {
  const kept: Record<string, string> = {}
  let n = 0
  for (const [k, raw] of Object.entries(headers)) {
    const key = k.toLowerCase()
    const value = Array.isArray(raw) ? raw.join(", ") : typeof raw === "string" ? raw : undefined
    if (value === undefined || CREDENTIAL_HEADERS.has(key)) continue
    if (n++ >= HEADERS) break
    kept[key] = value.length > HEADER_CHARS ? `${value.slice(0, HEADER_CHARS - 1)}…` : value
  }
  const ip = kept["x-forwarded-for"]?.split(",")[0]?.trim() || remoteAddress
  const ctx: CaptureContext = { request: { method, url, headers: kept } }
  if (ip) ctx.user = { ip }
  const trace = parseTraceparent(kept.traceparent)
  if (trace) ctx.trace = trace
  return ctx
}
