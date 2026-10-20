// One client per app: builds events, scrubs them, batches them and sends them,
// backing off when bertha asks it to.

import type { IngestException, IngestFrame, IngestSdk } from "../generated/ingest.ts"
import { builtRelease, debugIdsFor } from "./debug-ids.ts"
import { activeSpan } from "./otel.ts"
import { scrubText, scrubUrl } from "./scrub.ts"
import { parseStack } from "./stack.ts"
import { versions } from "./versions.ts"
import type { CaptureContext, IngestBreadcrumb, IngestEvent, IngestUser, Options, Transport } from "./types.ts"

export const MAX_BREADCRUMBS = 100
export const BATCH = 100
const DEBOUNCE_MS = 1000
const PER_MINUTE = 100
const MAX_CAUSES = 5
const RETRIES = 3
const DATA_FIELDS = 20
const DATA_CHARS = 500
/** Error fields dropped while scrubbing. */
const SENSITIVE_KEY = /password|passwd|secret|token|authorization|cookie|api_?key|credential|session/i

type Context = IngestEvent["context"]
/** Adds source lines to frames, where the runtime can read the files. */
export type AddContext = (frames: IngestFrame[]) => void
/** Adds what the runtime knows at capture time (the page, its state). Runs before scrubbing. */
export type Enrich = (event: IngestEvent) => void
/** Reads a framework's request passed as `req`. Server entries only, to keep the browser small. */
export type ReadRequest = (req: unknown) => CaptureContext

export class Client {
  readonly options: Options
  private readonly transport: Transport
  private readonly sdk: IngestSdk
  private readonly context: Context
  private readonly addContext: AddContext | undefined
  private readonly enrich: Enrich | undefined
  private readonly readRequest: ReadRequest | undefined
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

  constructor(
    options: Options,
    transport: Transport,
    sdk: IngestSdk,
    context?: Context,
    addContext?: AddContext,
    enrich?: Enrich,
    readRequest?: ReadRequest,
  ) {
    this.options = options
    this.transport = transport
    this.sdk = sdk
    this.context = context
    this.addContext = addContext
    this.enrich = enrich
    this.readRequest = readRequest
    this.tags = { ...options.tags }
  }

  captureException(error: unknown, ctx: CaptureContext = {}): string | undefined {
    if (error && typeof error === "object") {
      // The same error object often arrives twice (a boundary, then the global handler).
      if (this.seen.has(error)) return undefined
      this.seen.add(error)
    }
    const exception = toException(error, 0)
    if (ctx.componentStack) exception.componentStack = ctx.componentStack
    if (this.addContext) {
      try {
        for (let x: IngestException | undefined = exception; x; x = x.cause) this.addContext(x.frames)
      } catch (e) {
        this.log("couldn't read source lines", e)
      }
    }
    const mechanism = ctx.mechanism ?? { handler: "captureException", handled: true }
    return this.capture({ exception, mechanism, level: ctx.level ?? "error" }, ctx)
  }

  captureMessage(message: string, ctx: CaptureContext = {}): string | undefined {
    const mechanism = ctx.mechanism ?? { handler: "captureMessage", handled: true }
    return this.capture({ message, mechanism, level: ctx.level ?? "warning" }, ctx)
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
    const fromReq = (ctx.req !== undefined && this.readRequest?.(ctx.req)) || {}
    const request = ctx.request ?? fromReq.request
    const user = fromReq.user || ctx.user ? { ...fromReq.user, ...ctx.user } : undefined
    let event: IngestEvent | null = {
      ...base,
      id,
      timestamp: new Date(now).toISOString(),
      release: o.release ?? builtRelease(),
      environment: o.environment,
      breadcrumbs: this.crumbs.slice(),
      user: user ? { ...this.user, ...user } : this.user,
      context: { ...this.context, versions: { ...versions(), ...o.versions, ...this.context?.versions } },
      tags: { ...this.tags, ...ctx.tags },
      fingerprint: ctx.fingerprint,
      request: request && ctx.status !== undefined ? { ...request, status: ctx.status } : request,
      trace: ctx.trace ?? activeSpan() ?? fromReq.trace,
    }
    try {
      this.enrich?.(event)
    } catch (e) {
      this.log("couldn't read the page's state", e)
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
  const data = ownFields(e)
  if (data) out.data = data
  if (e.cause !== undefined && depth < MAX_CAUSES) out.cause = toException(e.cause, depth + 1)
  return out
}

/** The error's own fields (`code`, `status`, a response…), each as JSON. */
function ownFields(e: object): Record<string, string> | undefined {
  let out: Record<string, string> | undefined
  let n = 0
  for (const key of Object.keys(e)) {
    if (key === "name" || key === "message" || key === "stack" || key === "cause") continue
    if (n++ >= DATA_FIELDS) break
    let text: string
    try {
      text = JSON.stringify((e as Record<string, unknown>)[key]) ?? String((e as Record<string, unknown>)[key])
    } catch {
      text = String((e as Record<string, unknown>)[key])
    }
    ;(out ??= {})[key] = text.length > DATA_CHARS ? `${text.slice(0, DATA_CHARS - 1)}…` : text
  }
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
  for (let x = e.exception; x; x = x.cause) {
    x.message = scrubText(x.message)
    if (x.data) {
      x.data = Object.fromEntries(
        Object.entries(x.data)
          .filter(([k]) => !SENSITIVE_KEY.test(k))
          .map(([k, v]) => [k, scrubText(v)]),
      )
    }
  }
  e.breadcrumbs = e.breadcrumbs?.map((b) => ({ ...b, message: scrubText(b.message) }))
  if (e.request) e.request = { ...e.request, url: scrubUrl(e.request.url) }
  if (e.context?.referrer) e.context = { ...e.context, referrer: scrubUrl(e.context.referrer) }
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
