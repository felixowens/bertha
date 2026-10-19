// @bigbertha/sdk/edge: for edge runtimes (Next middleware and edge routes, Workers).
// No process to hook into, so errors are reported where they are caught.

import { Client } from "../core/client.ts"
import { firstEnv } from "../core/env.ts"
import { setClient } from "../core/hub.ts"
import { fromAnyRequest } from "../core/request.ts"
import { fetchTransport, streamGzip } from "../core/transport.ts"
import type { Options } from "../core/types.ts"
import { VERSION } from "../core/version.ts"

export { addBreadcrumb, captureException, captureMessage, flush, getClient, setTag, setUser } from "../core/hub.ts"
export type { CaptureContext, IngestEvent, Options } from "../core/types.ts"

export function init(options: Partial<Options> = {}): Client | undefined {
  const key = options.key ?? firstEnv("BERTHA_KEY", "NEXT_PUBLIC_BERTHA_KEY")
  const url = options.url ?? firstEnv("BERTHA_URL", "NEXT_PUBLIC_BERTHA_URL")
  if (!key || !url) {
    console.warn("[bertha] Set BERTHA_KEY and BERTHA_URL (or pass key and url). Nothing will be sent.")
    return undefined
  }
  const client = new Client(
    {
      ...options,
      key,
      url,
      release: options.release ?? firstEnv("BERTHA_RELEASE"),
      environment: options.environment ?? firstEnv("BERTHA_ENVIRONMENT", "VERCEL_ENV", "NODE_ENV"),
    },
    fetchTransport({ url, key, gzip: streamGzip }),
    { name: "bertha.edge", version: VERSION },
    { runtime: "Edge" },
    undefined,
    undefined,
    fromAnyRequest,
  )
  setClient(client)
  return client
}
