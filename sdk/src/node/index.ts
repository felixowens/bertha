// @bigbertha/sdk/node: uncaught exceptions and unhandled rejections, source lines from
// disk, a heartbeat so quiet hours read as "no errors" rather than "no data", and a
// handler wrapper.

import { createRequire } from "node:module"
import { arch, hostname, platform } from "node:os"
import { gzipSync } from "node:zlib"

import { Client } from "../core/client.ts"
import { envCommit, firstEnv } from "../core/env.ts"
import { getClient, setClient } from "../core/hub.ts"
import { fromAnyRequest } from "../core/request.ts"
import { endpoint, fetchTransport } from "../core/transport.ts"
import type { Options } from "../core/types.ts"
import { VERSION } from "../core/version.ts"
import { addContext } from "./context.ts"

export { addBreadcrumb, captureException, captureMessage, flush, getClient, setTag, setUser } from "../core/hub.ts"
export type { CaptureContext, IngestEvent, Options } from "../core/types.ts"

export interface NodeOptions extends Partial<Options> {
  /** Report uncaught exceptions and unhandled rejections, then exit as Node would. On by default. */
  handlers?: boolean
  /** Tell bertha the process is alive every 20 minutes. On by default. */
  heartbeat?: boolean
  /** Send the source lines around each frame in your code, read from disk. On by default. */
  contextLines?: boolean
  /**
   * The commit this process runs, so an agent can read the code that failed. Read from
   * BERTHA_COMMIT or the host's own variable (Heroku, Render, Railway, Vercel, GitHub
   * Actions) unless given; sent with the heartbeat.
   */
  commit?: string
}

export const HEARTBEAT_MS = 20 * 60 * 1000
/** V8 keeps 10 frames, which a framework's own calls can use up before reaching yours. */
export const STACK_FRAMES = 50
const V8_DEFAULT_FRAMES = 10
const EXIT_FLUSH_MS = 2000

let handlersInstalled = false
let heartbeat: ReturnType<typeof setInterval> | undefined

/** Reads BERTHA_KEY, BERTHA_URL, BERTHA_RELEASE, BERTHA_COMMIT and NODE_ENV unless given. */
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
    {
      runtime: `Node ${process.versions.node}`,
      os: `${platform()} ${arch()}`,
      host: process.env.DYNO ?? safe(hostname),
      versions: installedVersions(),
    },
    options.contextLines === false ? undefined : addContext,
    undefined,
    fromAnyRequest,
  )
  setClient(client)
  // Only V8's default: a limit the app set itself was a choice.
  if (Error.stackTraceLimit === V8_DEFAULT_FRAMES) Error.stackTraceLimit = STACK_FRAMES

  if (options.handlers !== false && !handlersInstalled) {
    handlersInstalled = true
    process.on("uncaughtException", sdkHandler((error) => void crash("uncaughtException", error)))
    process.on("unhandledRejection", sdkHandler((reason) => void crash("unhandledRejection", reason)))
    process.on("beforeExit", () => void getClient()?.flush())
  }
  if (options.heartbeat !== false) {
    clearInterval(heartbeat)
    const beat = () => void sendHeartbeat({ ...opts, commit: options.commit ?? envCommit() })
    beat()
    heartbeat = setInterval(beat, HEARTBEAT_MS)
    heartbeat.unref()
  }
  return client
}

/**
 * Error SDKs mark their process handlers with `_errorHandler` (Sentry's convention). Each
 * leaves the exit to the app's own handlers, so two SDKs that counted each other would
 * both wait and the process would carry on after an uncaught exception.
 */
function sdkHandler<T extends (...args: never[]) => void>(fn: T): T {
  return Object.assign(fn, { _errorHandler: true })
}

/** Whether the app itself handles the event, not counting error SDKs on uncaughtException. */
function appHandles(event: "uncaughtException" | "unhandledRejection"): boolean {
  // A rejection handler from another SDK may deliberately keep the process alive (Sentry
  // warns by default), so on that event every other listener counts.
  if (event === "unhandledRejection") return process.listenerCount(event) > 1
  return process.listeners(event).some((l) => !(l as { _errorHandler?: boolean })._errorHandler)
}

/** Reports, flushes and then, if the app isn't handling it, exits as Node would have. */
async function crash(event: "uncaughtException" | "unhandledRejection", error: unknown): Promise<void> {
  const client = getClient()
  client?.captureException(error, { level: "fatal", mechanism: { handler: event, handled: false } })
  await Promise.race([client?.flush(), new Promise((r) => setTimeout(r, EXIT_FLUSH_MS).unref())])
  if (appHandles(event)) return
  console.error(event === "unhandledRejection" && !(error instanceof Error) ? `Unhandled rejection: ${String(error)}` : error)
  process.exit(1)
}

export async function sendHeartbeat(o: Pick<Options, "url" | "key" | "release" | "environment"> & { commit?: string }): Promise<boolean> {
  try {
    const res = await fetch(endpoint(o.url, "heartbeat"), {
      method: "POST",
      headers: { authorization: `Bearer ${o.key}`, "content-type": "application/json" },
      body: JSON.stringify({ environment: o.environment, release: o.release, commit: o.commit }),
      signal: AbortSignal.timeout(10_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Wraps a request handler (Node http, Express, Fastify, Hono…): errors it throws
 * or rejects with are reported with the request, then rethrown.
 */
export function wrapHandler<A extends unknown[], R>(handler: (...args: A) => R): (...args: A) => R {
  return function (this: unknown, ...args: A): R {
    const report = (error: unknown) => {
      getClient()?.captureException(error, { req: args[0], mechanism: { handler: "wrapHandler", handled: false } })
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

/** Node's version, and Next.js's when the app has it installed. */
function installedVersions(): Record<string, string> {
  const out: Record<string, string> = { node: process.versions.node }
  try {
    const require = createRequire(`${process.cwd()}/`)
    const next = (require("next/package.json") as { version?: string }).version
    if (next) out.next = next
  } catch {
    // Not a Next.js app, or bundled without its package.json.
  }
  return out
}

function safe(f: () => string): string | undefined {
  try {
    return f()
  } catch {
    return undefined
  }
}
