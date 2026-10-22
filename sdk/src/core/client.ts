// One client per app: builds events and log lines, scrubs them, batches them and sends
// them, backing off when bertha asks it to. Lines go to the logs endpoint as OTLP JSON,
// without the per-minute cap: past 1,000 waiting, the oldest are dropped.

import type { IngestException, IngestFrame, IngestSdk } from "../generated/ingest.ts"
import { builtRelease, debugIdsFor } from "./debug-ids.ts"
import { activeSpan } from "./otel.ts"
import { scrubText, scrubUrl } from "./scrub.ts"
import { parseStack } from "./stack.ts"
import { versions } from "./versions.ts"
import type {
  CaptureContext,
  IngestBreadcrumb,
  IngestEvent,
  IngestTrace,
  IngestUser,
  LogFields,
  Logger,
  LogLevel,
  Options,
  Transport,
} from "./types.ts"

export const MAX_BREADCRUMBS = 100
export const BATCH = 100
const DEBOUNCE_MS = 1000
const PER_MINUTE = 100
const MAX_CAUSES = 5
const RETRIES = 3
const DATA_FIELDS = 20
const DATA_CHARS = 500
const MAX_LINES = 1000
/** OpenTelemetry severity numbers. */
const SEVERITY = { debug: 5, info: 9, warning: 13, error: 17, fatal: 21 } as const
/** Error fields dropped while scrubbing. */
const SENSITIVE_KEY = /password|passwd|secret|token|authorization|cookie|api_?key|credential|session/i

type Context = IngestEvent["context"]
/** Adds source lines to frames, where the runtime can read the files. */
export type AddContext = (frames: IngestFrame[]) => void
/** Adds what the runtime knows at capture time (the page, its state). Runs before scrubbing. */
export type Enrich = (event: IngestEvent) => void
/** Reads a framework's request passed as `req`. Server entries only, to keep the browser small. */
export type ReadRequest = (req: unknown) => CaptureContext

type Path = "events" | "logs"
type Attribute = { key: string; value: { stringValue: string } }
/** The error a line is about, until its event id is known. Symbols aren't serialised. */
const ERROR = Symbol()
/** An OTLP log record. */
export interface LogRecord {
  timeUnixNano: string
  observedTimeUnixNano: string
  severityNumber: number
  severityText: LogLevel
  body: { stringValue: string }
  attributes: Attribute[]
  traceId?: string
  spanId?: string
  [ERROR]?: object
}

export class Client {
  readonly options: Options
  private readonly transport: Transport
  private readonly sdk: IngestSdk
  private readonly context: Context
  private readonly addContext: AddContext | undefined
  private readonly enrich: Enrich | undefined
  private readonly readRequest: ReadRequest | undefined
  /** Lines for the project's logs, not issues. */
  readonly log: Logger
  /** The trace for a log line when no span is active: the browser's page trace. */
  pageTrace: (() => IngestTrace) | undefined
  /** The app's name, sent with log lines as `service.name`. */
  service: string | undefined
  private user: IngestUser | undefined
  private tags: Record<string, string>
  private crumbs: IngestBreadcrumb[] = []
  private queue: IngestEvent[] = []
  private timer: ReturnType<typeof setTimeout> | undefined
  private sending: Promise<void> | undefined
  /** Event ids by the error captured, so a line about the same error links to it. */
  private ids = new WeakMap<object, string>()
  private window = { start: 0, count: 0 }
  private paused = { events: 0, logs: 0 }
  private warned = false
  private lines: LogRecord[] = []
  /** Lines dropped since the last batch, because more than MAX_LINES waited. */
  private dropped = 0
  /** Set when this bertha has no logs endpoint. */
  private logsOff = false

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
    this.log = logger((level, message, fields) => this.write(level, message, fields))
  }

  captureException(error: unknown, ctx: CaptureContext = {}): string | undefined {
    const object = error && typeof error === "object" ? error : undefined
    if (object) {
      // The same error object often arrives twice (a boundary, then the global handler).
      if (this.ids.has(object)) return undefined
      this.ids.set(object, "")
    }
    const exception = toException(error, 0)
    if (ctx.componentStack) exception.componentStack = ctx.componentStack
    if (this.addContext) {
      try {
        for (let x: IngestException | undefined = exception; x; x = x.cause) this.addContext(x.frames)
      } catch (e) {
        this.note("couldn't read source lines", e)
      }
    }
    const mechanism = ctx.mechanism ?? { handler: "captureException", handled: true }
    const id = this.capture({ exception, mechanism, level: ctx.level ?? "error" }, ctx)
    if (object && id) this.ids.set(object, id)
    return id
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

  /**
   * Queues a log line, when its level is sent. A line about an `error` that was also
   * captured carries the event's id (`bertha.event_id`).
   */
  write(level: LogLevel, message: string | Error, fields?: LogFields, error?: unknown): void {
    const min = this.options.logLevel ?? "info"
    if (this.logsOff || min === "off" || SEVERITY[level] < SEVERITY[min]) return
    if (message instanceof Error) error ??= message
    let text = message instanceof Error ? `${message.name}: ${message.message}` : String(message)
    let attrs: Record<string, string> = {}
    for (const [k, v] of Object.entries(fields ?? {})) attrs[k] = typeof v === "string" ? v : describeValue(v)
    if (this.options.scrub !== false) {
      text = scrubText(text)
      attrs = scrubFields(attrs)
    }
    const line = record(level, text, attrs, activeSpan() ?? this.pageTrace?.())
    if (error && typeof error === "object") line[ERROR] = error
    if (this.lines.push(line) > MAX_LINES) {
      this.lines.shift()
      this.dropped++
    }
    if (this.lines.length === BATCH) void this.flush()
    else this.timer ??= setTimeout(() => void this.flush(), DEBOUNCE_MS)
  }

  /** Sends everything queued. `final` when the page or process is going away. */
  async flush(final = false): Promise<void> {
    clearTimeout(this.timer)
    this.timer = undefined
    while (this.sending) await this.sending
    if (!this.queue.length && !this.lines.length) return
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
    // The active span names where in the request it happened, but only when it's on the
    // request's own trace. Sentry runs OpenTelemetry on its own trace ids, and taking its
    // span would cut the error off from the page that sent the request.
    const span = activeSpan()
    const trace = ctx.trace ?? (span && (!fromReq.trace || span.traceId === fromReq.trace.traceId) ? span : fromReq.trace)
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
      trace,
    }
    try {
      this.enrich?.(event)
    } catch (e) {
      this.note("couldn't read the page's state", e)
    }
    if (o.scrub !== false) scrubEvent(event)
    if (event.exception) event.debugIds = debugIdsFor(files(event.exception))
    try {
      event = o.beforeSend ? o.beforeSend(event) : event
    } catch (e) {
      this.note("beforeSend threw; sending the event as it was", e)
    }
    if (!event) return undefined
    this.queue.push(event)
    this.note("queued", event)
    if (this.queue.length >= BATCH) void this.flush()
    else this.timer ??= setTimeout(() => void this.flush(), DEBOUNCE_MS)
    return id
  }

  private async drain(final: boolean): Promise<void> {
    await this.drainQueue("events", this.queue, (events) => JSON.stringify({ sdk: this.sdk, events }), final)
    await this.drainQueue("logs", this.lines, (lines) => this.logsBody(lines), final)
  }

  private async drainQueue<T>(path: Path, queue: T[], body: (batch: T[]) => string, final: boolean): Promise<void> {
    while (queue.length) {
      const until = this.paused[path]
      if (Date.now() < until && !final) {
        this.timer ??= setTimeout(() => void this.flush(), until - Date.now())
        return
      }
      const batch = queue.splice(0, BATCH)
      if (!(await this.deliver(path, body(batch), final)) && !final) queue.unshift(...batch)
    }
  }

  /** Sends one batch, retrying while offline. False when bertha asked to wait. */
  private async deliver(path: Path, body: string, final: boolean): Promise<boolean> {
    for (let attempt = 0; ; ) {
      const res = await this.transport.send(body, final, path).catch(() => "offline" as const)
      if (res === "offline") {
        if (final || ++attempt > RETRIES) return true
        await sleep(500 * 2 ** attempt)
        continue
      }
      if (res.status === 429 || res.status === 503) {
        this.paused[path] = Date.now() + (res.retryAfter ?? 60) * 1000
        return false
      }
      if (path === "logs" && res.status === 404) {
        this.logsOff = true
        this.lines.length = 0
        console.warn(`[bertha] This bertha doesn't take logs. Upgrade it, or set logLevel to "off".`)
      } else if (res.status >= 400 && !this.warned) {
        this.warned = true
        console.warn(`[bertha] bertha refused the ${path} (HTTP ${res.status}). Check the key and URL.`)
      }
      return true
    }
  }

  /** An OTLP/HTTP JSON logs request. Lines dropped from a full buffer become a line of their own. */
  private logsBody(lines: LogRecord[]): string {
    if (this.dropped) {
      const note = `bertha dropped ${this.dropped} log lines: too many were waiting to be sent.`
      lines.unshift(record("warning", note, { "bertha.dropped": String(this.dropped) }))
      this.dropped = 0
    }
    for (const line of lines) {
      const id = line[ERROR] && this.ids.get(line[ERROR])
      if (id) {
        line.attributes.push(attribute("bertha.event_id", id))
        delete line[ERROR]
      }
    }
    const o = this.options
    const resource = {
      "service.name": this.service,
      "service.version": o.release ?? builtRelease(),
      "deployment.environment.name": o.environment,
    }
    return JSON.stringify({
      resourceLogs: [{ resource: { attributes: attributes(resource) }, scopeLogs: [{ scope: this.sdk, logRecords: lines }] }],
    })
  }

  private note(...args: unknown[]): void {
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

/** `log` for a write function: `warn` writes at "warning". */
export function logger(write: (level: LogLevel, message: string | Error, fields?: LogFields) => void): Logger {
  const at = (level: LogLevel) => (message: string | Error, fields?: LogFields) => write(level, message, fields)
  return { debug: at("debug"), info: at("info"), warn: at("warning"), error: at("error") }
}

function record(level: LogLevel, text: string, attrs: Record<string, string | undefined>, trace?: IngestTrace): LogRecord {
  const time = `${Date.now()}000000`
  return {
    timeUnixNano: time,
    observedTimeUnixNano: time,
    severityNumber: SEVERITY[level],
    severityText: level,
    body: { stringValue: text },
    attributes: attributes(attrs),
    ...trace,
  }
}

function attributes(attrs: Record<string, string | undefined>): Attribute[] {
  return Object.entries(attrs).flatMap(([k, v]) => (v === undefined ? [] : [attribute(k, v)]))
}

function attribute(key: string, value: string): Attribute {
  return { key, value: { stringValue: value } }
}

/** A value as text: an error's name and message, anything else as JSON. */
export function describeValue(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}`
  try {
    return JSON.stringify(v) ?? String(v)
  } catch {
    return String(v)
  }
}

/** Fields whose names say they hold a secret are dropped, and the rest scrubbed. */
function scrubFields(fields: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([k]) => !SENSITIVE_KEY.test(k))
      .map(([k, v]) => [k, scrubText(v)]),
  )
}

function scrubEvent(e: IngestEvent): void {
  if (e.message) e.message = scrubText(e.message)
  for (let x = e.exception; x; x = x.cause) {
    x.message = scrubText(x.message)
    if (x.data) x.data = scrubFields(x.data)
  }
  e.breadcrumbs = e.breadcrumbs?.map((b) => ({ ...b, message: scrubText(b.message) }))
  if (e.request) {
    const { headers } = e.request
    e.request = { ...e.request, url: scrubUrl(e.request.url), ...(headers && { headers: scrubFields(headers) }) }
  }
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
