// The module-level client behind `captureException` and friends, so apps don't
// have to pass a client around.

import { type Client, logger } from "./client.ts"
import type { CaptureContext, IngestBreadcrumb, IngestUser, Logger } from "./types.ts"

let current: Client | undefined

export function setClient(c: Client | undefined): void {
  current = c
}

export function getClient(): Client | undefined {
  return current
}

export function captureException(error: unknown, ctx?: CaptureContext): string | undefined {
  return current?.captureException(error, ctx)
}

export function captureMessage(message: string, ctx?: CaptureContext): string | undefined {
  return current?.captureMessage(message, ctx)
}

export function setUser(user: IngestUser | null): void {
  current?.setUser(user)
}

export function setTag(key: string, value: string | null): void {
  current?.setTag(key, value)
}

export function addBreadcrumb(crumb: Omit<IngestBreadcrumb, "timestamp"> & { timestamp?: string }): void {
  current?.addBreadcrumb(crumb)
}

/**
 * Lines for the project's logs: `log.warn("Used the fallback", { status: 502 })`. Not
 * issues: `log.error` writes a line and opens nothing.
 */
export const log: Logger = logger((...line) => current?.write(...line))

export function flush(): Promise<void> {
  return current?.flush() ?? Promise.resolve()
}
