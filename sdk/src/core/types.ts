import type {
  IngestBreadcrumb,
  IngestEvent,
  IngestLevel,
  IngestMechanism,
  IngestTrace,
  IngestUser,
} from "../generated/ingest.ts"

export type { IngestBreadcrumb, IngestEvent, IngestLevel, IngestMechanism, IngestTrace, IngestUser }

export interface Options {
  /** The project's ingest key. Public: safe to ship to browsers. */
  key: string
  /** Where bertha runs, e.g. "https://bertha.example.com". */
  url: string
  /** Defaults to the release stamped in at build time. */
  release?: string
  /** "production", "staging" or "development"; free text is mapped. */
  environment?: string
  /** Share of events to send, 0 to 1. Defaults to 1. */
  sampleRate?: number
  /** Change or drop (return null) an event before it is sent. */
  beforeSend?: (event: IngestEvent) => IngestEvent | null
  /** Redacts emails, bearer tokens and secret-looking query values. On by default. */
  scrub?: boolean
  /** Tags on every event. */
  tags?: Record<string, string>
  /** Log what the SDK does to the console. */
  debug?: boolean
  /** Framework versions on every event, e.g. `{ vue: "3.5.0" }`. React and Next.js are found by themselves. */
  versions?: Record<string, string>
  /** The lowest level sent to the project's logs. "info" by default; "off" sends none. */
  logLevel?: LogLevel | "off"
  /** Send console.debug, log, info, warn and error as log lines too. Off by default. */
  captureConsole?: boolean
}

export type LogLevel = "debug" | "info" | "warning" | "error" | "fatal"

/** A log line's fields: each is sent as an attribute, as text. */
export type LogFields = Record<string, unknown>

/** `client.log` and `log`: lines for the project's logs, not issues. */
export interface Logger {
  debug(message: string | Error, fields?: LogFields): void
  info(message: string | Error, fields?: LogFields): void
  warn(message: string | Error, fields?: LogFields): void
  /** A line, not an issue: use captureException when someone should act on it. */
  error(message: string | Error, fields?: LogFields): void
}

export interface CaptureContext {
  level?: IngestLevel
  tags?: Record<string, string>
  fingerprint?: string[]
  request?: IngestEvent["request"]
  /**
   * The framework's request: Node's `IncomingMessage`, Express's `req`, Koa's `ctx`, or a
   * Fetch `Request`. Its method, URL, headers (never credentials), the client IP and an
   * incoming `traceparent` are sent. `request`, `user` and `trace` win over what it gives.
   */
  req?: unknown
  /** The response status, sent with the request. */
  status?: number
  /** Merged over the user from `setUser`. */
  user?: IngestUser
  /** How the error reached the SDK. Defaults to `captureException`, handled. */
  mechanism?: IngestMechanism
  trace?: IngestTrace
  /** React's component stack, from an error boundary. */
  componentStack?: string
}

/** What a send came back with; "offline" means it never reached bertha. */
export type SendResult = { status: number; retryAfter?: number } | "offline"

export interface Transport {
  /** `final`: the page or process is going away, so don't wait on anything. */
  send(body: string, final: boolean, path?: "events" | "logs"): Promise<SendResult>
}
