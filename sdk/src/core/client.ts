// One client per app: builds events, scrubs them, batches them and sends them,
// backing off when bertha asks it to.

import type { IngestException, IngestFrame, IngestSdk } from "../generated/ingest.ts"
import { builtRelease, debugIdsFor } from "./debug-ids.ts"
import { scrubText, scrubUrl } from "./scrub.ts"
import { parseStack } from "./stack.ts"
import type { CaptureContext, IngestBreadcrumb, IngestEvent, IngestUser, Options, Transport } from "./types.ts"

export const MAX_BREADCRUMBS = 100
export const BATCH = 100
const DEBOUNCE_MS = 1000
const PER_MINUTE = 100
const MAX_CAUSES = 5
const RETRIES = 3

type Context = IngestEvent["context"]
/** Adds source lines to frames, where the runtime can read the files. */
export type AddContext = (frames: IngestFrame[]) => void

export class Client {
  readonly options: Options
  private readonly transport: Transport
  private readonly sdk: IngestSdk
  private readonly context: Context
  private readonly addContext: AddContext | undefined
  private user: IngestUser | undefined
  private tags: Record<string, string>
  private crumbs: IngestBreadcrumb[] = []
  private queue: IngestEvent[] = []
  private timer: ReturnType<typeof setTimeout> | undefined
  private sending: Promise<void> | undefined
  private seen = new WeakSet<object>()
  private window = { start: 0, count: 0 }
  private pausedUntil = 0
  private warned = false

  constructor(options: Options, transport: Transport, sdk: IngestSdk, context?: Context, addContext?: AddContext) {
    this.options = options
    this.transport = transport
    this.sdk = sdk
    this.context = context
    this.addContext = addContext
    this.tags = { ...options.tags }
  }

  captureException(error: unknown, ctx: CaptureContext = {}): string | undefined {
    if (error && typeof error === "object") {
      // The same error object often arrives twice (a boundary, then the global handler).
      if (this.seen.has(error)) return undefined
      this.seen.add(error)
    }
    const exception = toException(error, 0)
    if (this.addContext) {
      try {
        for (let x: IngestException | undefined = exception; x; x = x.cause) this.addContext(x.frames)
      } catch (e) {
        this.log("couldn't read source lines", e)
      }
    }
    return this.capture({ exception, level: ctx.level ?? "error" }, ctx)
  }

  captureMessage(message: string, ctx: CaptureContext = {}): string | undefined {
    return this.capture({ message, level: ctx.level ?? "warning" }, ctx)
  }

  setUser(user: IngestUser | null): void {
    this.user = user ?? undefined
  }

  setTag(key: string, value: string | null): void {
    if (value === null) delete this.tags[key]
    else this.tags[key] = value
  }

  addBreadcrumb(crumb: Omit<IngestBreadcrumb, "timestamp"> & { timestamp?: string }): void {
    this.crumbs.push({ ...crumb, timestamp: crumb.timestamp ?? new Date().toISOString() })
    if (this.crumbs.length > MAX_BREADCRUMBS) this.crumbs.shift()
  }

  /** Sends everything queued. `final` when the page or process is going away. */
  async flush(final = false): Promise<void> {
    clearTimeout(this.timer)
    this.timer = undefined
    while (this.sending) await this.sending
    if (!this.queue.length) return
    this.sending = this.drain(final).finally(() => (this.sending = undefined))
    await this.sending
  }

  private capture(base: Partial<IngestEvent>, ctx: CaptureContext): string | undefined {
    const o = this.options
    if (o.sampleRate !== undefined && Math.random() >= o.sampleRate) return undefined
    const now = Date.now()
    if (now - this.window.start > 60_000) this.window = { start: now, count: 0 }
    if (++this.window.count > PER_MINUTE) return undefined

    const id = uuid()
    let event: IngestEvent | null = {
      ...base,
      id,
      timestamp: new Date(now).toISOString(),
      release: o.release ?? builtRelease(),
      environment: o.environment,
      breadcrumbs: this.crumbs.slice(),
      user: this.user,
      context: this.context,
      tags: { ...this.tags, ...ctx.tags },
      fingerprint: ctx.fingerprint,
      request: ctx.request,
    }
    if (o.scrub !== false) scrubEvent(event)
    if (event.exception) event.debugIds = debugIdsFor(files(event.exception))
    try {
      event = o.beforeSend ? o.beforeSend(event) : event
    } catch (e) {
      this.log("beforeSend threw; sending the event as it was", e)
    }
    if (!event) return undefined
    this.queue.push(event)
    this.log("queued", event)
    if (this.queue.length >= BATCH) void this.flush()
    else this.timer ??= setTimeout(() => void this.flush(), DEBOUNCE_MS)
    return id
  }

  private async drain(final: boolean): Promise<void> {
    while (this.queue.length) {
      if (Date.now() < this.pausedUntil && !final) {
        this.timer ??= setTimeout(() => void this.flush(), this.pausedUntil - Date.now())
        return
      }
      const batch = this.queue.splice(0, BATCH)
      const body = JSON.stringify({ sdk: this.sdk, events: batch })
      let attempt = 0
      for (;;) {
        const res = await this.transport.send(body, final).catch(() => "offline" as const)
        if (res === "offline") {
          if (final || ++attempt > RETRIES) break
          await sleep(500 * 2 ** attempt)
          continue
        }
        if (res.status === 429 || res.status === 503) {
          this.pausedUntil = Date.now() + (res.retryAfter ?? 60) * 1000
          if (!final) this.queue.unshift(...batch)
          break
        }
        if (res.status >= 400 && !this.warned) {
          this.warned = true
          console.warn(`[bertha] bertha refused the events (HTTP ${res.status}). Check the key and URL.`)
        }
        break
      }
    }
  }

  private log(...args: unknown[]): void {
    if (this.options.debug) console.debug("[bertha]", ...args)
  }
}

export function toException(error: unknown, depth: number): IngestException {
  if (!(error instanceof Error) && !isErrorLike(error)) {
    return { type: "Error", message: describe(error), frames: [] }
  }
  const e = error as Error
  const out: IngestException = {
    type: e.name || e.constructor?.name || "Error",
    message: String(e.message ?? ""),
    frames: parseStack(e.stack),
  }
  if (e.cause !== undefined && depth < MAX_CAUSES) out.cause = toException(e.cause, depth + 1)
  return out
}

function isErrorLike(v: unknown): boolean {
  return !!v && typeof v === "object" && "message" in v && "stack" in v
}

function describe(v: unknown): string {
  if (typeof v === "string") return v
  try {
    return `Non-error thrown: ${JSON.stringify(v)?.slice(0, 500) ?? String(v)}`
  } catch {
    return `Non-error thrown: ${String(v)}`
  }
}

function* files(e: IngestException | undefined): Generator<string> {
  for (; e; e = e.cause) for (const f of e.frames) yield f.file
}

function scrubEvent(e: IngestEvent): void {
  if (e.message) e.message = scrubText(e.message)
  for (let x = e.exception; x; x = x.cause) x.message = scrubText(x.message)
  e.breadcrumbs = e.breadcrumbs?.map((b) => ({ ...b, message: scrubText(b.message) }))
  if (e.request) e.request = { ...e.request, url: scrubUrl(e.request.url) }
}

export function uuid(): string {
  // randomUUID is missing on plain-http pages.
  const c = globalThis.crypto as Partial<Crypto> | undefined
  if (c?.randomUUID) return c.randomUUID()
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16),
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Seconds from a 429 body or Retry-After header. */
export async function retryAfter(res: Response): Promise<number | undefined> {
  const header = Number(res.headers.get("retry-after"))
  if (header > 0) return header
  try {
    const body = (await res.json()) as { retryAfter?: number }
    return body.retryAfter
  } catch {
    return undefined
  }
}
