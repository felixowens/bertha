import { createServer, type IncomingMessage } from "node:http"
import type { AddressInfo } from "node:net"
import { gunzipSync } from "node:zlib"

export interface Received {
  method: string
  path: string
  query: URLSearchParams
  headers: IncomingMessage["headers"]
  body: string
  gzipped: boolean
}

/** A stand-in bertha: records requests, answers with `reply`. */
export async function mockBertha(reply: (r: Received) => { status: number; body?: unknown } = () => ({ status: 202 })) {
  const received: Received[] = []
  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on("data", (c: Buffer) => chunks.push(c))
    req.on("end", () => {
      const raw = Buffer.concat(chunks)
      const gzipped = raw[0] === 0x1f && raw[1] === 0x8b
      const url = new URL(req.url ?? "/", "http://x")
      const r: Received = {
        method: req.method ?? "",
        path: url.pathname,
        query: url.searchParams,
        headers: req.headers,
        body: (gzipped ? gunzipSync(raw) : raw).toString("utf8"),
        gzipped,
      }
      received.push(r)
      const out = reply(r)
      res.writeHead(out.status, { "content-type": "application/json", "access-control-allow-origin": "*" })
      res.end(out.body === undefined ? "" : JSON.stringify(out.body))
    })
  })
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return { url, received, close: () => new Promise<void>((r) => server.close(() => r())) }
}
