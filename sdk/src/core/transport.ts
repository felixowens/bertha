// Sending over fetch. Browsers authenticate with `?key=` and send `text/plain` so no
// CORS preflight is needed; servers use the Authorization header. Gzip is detected by
// the server from the bytes, so no Content-Encoding header is sent either.

import { retryAfter } from "./client.ts"
import type { SendResult, Transport } from "./types.ts"

/** Keepalive requests are capped at 64KB by browsers. */
const KEEPALIVE_BYTES = 60_000
const GZIP_FROM = 1024

export interface FetchTransportOptions {
  url: string
  key: string
  /** Key in the query string instead of a header (browsers). */
  keyInQuery?: boolean
  gzip?: (body: string) => Promise<BodyInit | undefined>
  /** Hand-off for unloads (navigator.sendBeacon). Returns false if it couldn't. */
  beacon?: (url: string, body: string) => boolean
  fetch?: typeof fetch
}

export function endpoint(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/ingest/v1/${path}`
}

export function fetchTransport(o: FetchTransportOptions): Transport {
  const f = o.fetch ?? globalThis.fetch.bind(globalThis)
  const url = endpoint(o.url, "events") + (o.keyInQuery ? `?key=${encodeURIComponent(o.key)}` : "")
  const headers: Record<string, string> = { "content-type": "text/plain" }
  if (!o.keyInQuery) headers.authorization = `Bearer ${o.key}`
  return {
    async send(body: string, final: boolean): Promise<SendResult> {
      if (final && o.beacon?.(url, body)) return { status: 202 }
      let payload: BodyInit = body
      if (o.gzip && body.length >= GZIP_FROM) payload = (await o.gzip(body).catch(() => undefined)) ?? body
      try {
        const res = await f(url, {
          method: "POST",
          headers,
          body: payload,
          keepalive: body.length < KEEPALIVE_BYTES,
          credentials: "omit",
        })
        return { status: res.status, retryAfter: res.status === 429 ? await retryAfter(res) : undefined }
      } catch {
        return "offline"
      }
    },
  }
}

/** Gzip with CompressionStream (browsers, edge runtimes, Node 18+). */
export async function streamGzip(body: string): Promise<BodyInit | undefined> {
  // Read off globalThis so bundlers' runtime checks don't flag it.
  const CS = (globalThis as { CompressionStream?: typeof CompressionStream }).CompressionStream
  if (!CS) return undefined
  const stream = new Blob([body]).stream().pipeThrough(new CS("gzip"))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
