// @bigbertha/sdk/next, for instrumentation.ts:
//   export { register, onRequestError } from "@bigbertha/sdk/next"

import { captureException, flush } from "../core/hub.ts"
import { fromRequest } from "../core/request.ts"

export { log } from "../core/hub.ts"
export { otlp } from "../core/otlp.ts"
export type { OtlpOptions } from "../core/otlp.ts"

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") (await import("../node/index.ts")).init()
  else if (process.env.NEXT_RUNTIME === "edge") (await import("../edge/index.ts")).init()
}

interface NextRequestInfo {
  path: string
  method: string
  headers: Record<string, string | string[] | undefined>
}

interface NextErrorContext {
  routerKind: "Pages Router" | "App Router"
  routePath: string
  routeType: "render" | "route" | "action" | "middleware" | "proxy"
  renderSource?: string
  revalidateReason?: string
}

/** Next calls this for errors in server components, route handlers, actions and middleware. */
export async function onRequestError(error: unknown, request: NextRequestInfo, context: NextErrorContext): Promise<void> {
  const host = header(request.headers.host)
  const proto = header(request.headers["x-forwarded-proto"]) ?? "https"
  const url = host ? `${proto}://${host}${request.path}` : request.path
  captureException(error, {
    ...fromRequest(request.method, url, request.headers),
    tags: { route: context.routePath, routeType: context.routeType },
    mechanism: { handler: "onRequestError", handled: false },
  })
  await flush()
}

function header(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}
