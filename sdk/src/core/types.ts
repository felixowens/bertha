import type { IngestBreadcrumb, IngestEvent, IngestLevel, IngestUser } from "../generated/ingest.ts"

export type { IngestBreadcrumb, IngestEvent, IngestLevel, IngestUser }

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
}

export interface CaptureContext {
  level?: IngestLevel
  tags?: Record<string, string>
  fingerprint?: string[]
  request?: IngestEvent["request"]
}

/** What a send came back with; "offline" means it never reached bertha. */
export type SendResult = { status: number; retryAfter?: number } | "offline"

export interface Transport {
  /** `final`: the page or process is going away, so don't wait on anything. */
  send(body: string, final: boolean): Promise<SendResult>
}
