// @bigbertha/sdk/node: uncaught exceptions and unhandled rejections, a heartbeat so
// quiet hours read as "no errors" rather than "no data", and a handler wrapper.

import { arch, platform } from "node:os"
import { gzipSync } from "node:zlib"

import { Client } from "../core/client.ts"
import { firstEnv } from "../core/env.ts"
import { getClient, setClient } from "../core/hub.ts"
import { endpoint, fetchTransport } from "../core/transport.ts"
import type { CaptureContext, Options } from "../core/types.ts"
import { VERSION } from "../core/version.ts"

export { addBreadcrumb, captureException, captureMessage, flush, getClient, setTag, setUser } from "../core/hub.ts"
export type { CaptureContext, IngestEvent, Options } from "../core/types.ts"

export interface NodeOptions extends Partial<Options> {
  /** Report uncaught exceptions and unhandled rejections, then exit as Node would. On by default. */
  handlers?: boolean
  /** Tell bertha the process is alive every 20 minutes. On by default. */
  heartbeat?: boolean
}

export const HEARTBEAT_MS = 20 * 60 * 1000
const EXIT_FLUSH_MS = 2000

let handlersInstalled = false
let heartbeat: ReturnType<typeof setInterval> | undefined

/** Reads BERTHA_KEY, BERTHA_URL, BERTHA_RELEASE and NODE_ENV unless given. */
export function init(options: NodeOptions = {}): Client | undefined {
  const key = options.key ?? firstEnv("BERTHA_KEY", "NEXT_PUBLIC_BERTHA_KEY")
  const url = options.url ?? firstEnv("BERTHA_URL", "NEXT_PUBLIC_BERTHA_URL")
  if (!key || !url) {
    console.warn("[bertha] Set BERTHA_KEY and BERTHA_URL (or pass key and url). Nothing will be sent.")
    return undefined
  }
  const opts: Options = {
    ...options,
    key,
    url,
    release: options.release ?? firstEnv("BERTHA_RELEASE"),
    environment: options.environment ?? firstEnv("BERTHA_ENVIRONMENT", "VERCEL_ENV", "NODE_ENV"),
  }
  const client = new Client(
    opts,
    fetchTransport({ url, key, gzip: async (body) => new Uint8Array(gzipSync(body)) }),
    { name: "bertha.node", version: VERSION },
    { runtime: `Node ${process.versions.node}`, os: `${platform()} ${arch()}` },
  )
  setClient(client)

  if (options.handlers !== false && !handlersInstalled) {
    handlersInstalled = true
    process.on("uncaughtException", (error) => void crash("uncaughtException", error))
    process.on("unhandledRejection", (reason) => void crash("unhandledRejection", reason))
    process.on("beforeExit", () => void getClient()?.flush())
  }
  if (options.heartbeat !== false) {
    clearInterval(heartbeat)
    const beat = () => void sendHeartbeat(opts)
    beat()
    heartbeat = setInterval(beat, HEARTBEAT_MS)
    heartbeat.unref()
  }
  return client
}

/** Reports, flushes and then, if nothing else is listening, exits as Node would have. */
async function crash(event: "uncaughtException" | "unhandledRejection", error: unknown): Promise<void> {
  const client = getClient()
  client?.captureException(error, { level: "fatal" })
  await Promise.race([client?.flush(), new Promise((r) => setTimeout(r, EXIT_FLUSH_MS).unref())])
  if (process.listenerCount(event) > 1) return
  console.error(event === "unhandledRejection" && !(error instanceof Error) ? `Unhandled rejection: ${String(error)}` : error)
  process.exit(1)
}

export async function sendHeartbeat(o: Pick<Options, "url" | "key" | "release" | "environment">): Promise<boolean> {
  try {
    const res = await fetch(endpoint(o.url, "heartbeat"), {
      method: "POST",
      headers: { authorization: `Bearer ${o.key}`, "content-type": "application/json" },
      body: JSON.stringify({ environment: o.environment, release: o.release }),
      signal: AbortSignal.timeout(10_000),
    })
    return res.ok
  } catch {
    return false
  }
}

type Req = { method?: string; url?: string; originalUrl?: string; headers?: Record<string, unknown> }

/**
 * Wraps a request handler (Node http, Express, Fastify, Hono…): errors it throws
 * or rejects with are reported with the request, then rethrown.
 */
export function wrapHandler<A extends unknown[], R>(handler: (...args: A) => R): (...args: A) => R {
  return function (this: unknown, ...args: A): R {
    const report = (error: unknown) => {
      getClient()?.captureException(error, requestContext(args[0]))
      throw error
    }
    try {
      const r = handler.apply(this, args)
      return (r instanceof Promise ? r.catch(report) : r) as R
    } catch (error) {
      return report(error)
    }
  }
}

function requestContext(req: unknown): CaptureContext {
  const r = req as Req | undefined
  if (!r || typeof r.method !== "string") return {}
  const path = r.originalUrl ?? r.url ?? "/"
  const host = typeof r.headers?.host === "string" ? r.headers.host : undefined
  const proto = typeof r.headers?.["x-forwarded-proto"] === "string" ? r.headers["x-forwarded-proto"] : "http"
  return { request: { method: r.method, url: host && path.startsWith("/") ? `${proto}://${host}${path}` : path } }
}
