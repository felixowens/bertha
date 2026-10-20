// Where an OpenTelemetry exporter sends spans to bertha.

import { firstEnv } from "./env.ts"
import { endpoint } from "./transport.ts"

export interface OtlpOptions {
  url?: string
  key?: string
}

/**
 * Settings for an OTLP/HTTP trace exporter (protobuf or JSON) that sends to bertha:
 *   new OTLPTraceExporter(otlp())
 * Reads BERTHA_URL and BERTHA_KEY unless given.
 */
export function otlp(options: OtlpOptions = {}): { url?: string; headers?: Record<string, string> } {
  const key = options.key ?? firstEnv("BERTHA_KEY", "NEXT_PUBLIC_BERTHA_KEY")
  const url = options.url ?? firstEnv("BERTHA_URL", "NEXT_PUBLIC_BERTHA_URL")
  if (!key || !url) {
    console.warn("[bertha] Set BERTHA_KEY and BERTHA_URL (or pass key and url). No spans will reach bertha.")
    return {}
  }
  return { url: endpoint(url, "traces"), headers: { authorization: `Bearer ${key}` } }
}
