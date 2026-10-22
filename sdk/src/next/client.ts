// @bigbertha/sdk/next/client, for instrumentation-client.ts:
//   export { onRouterTransitionStart } from "@bigbertha/sdk/next/client"
// Importing it starts reporting. Next inlines the NEXT_PUBLIC_ variables below.

import { init } from "../browser/index.ts"
import { addBreadcrumb } from "../core/hub.ts"

export { captureException, captureMessage, log, setTag, setUser } from "../core/hub.ts"

function read(f: () => string | undefined): string | undefined {
  try {
    return f() || undefined
  } catch {
    return undefined
  }
}

// Written out in full so Next's compiler can replace each one.
const key = read(() => process.env.NEXT_PUBLIC_BERTHA_KEY)
const url = read(() => process.env.NEXT_PUBLIC_BERTHA_URL)
if (typeof window === "undefined") {
  // Prerendering on the server: instrumentation.ts covers that side.
} else if (key && url) {
  init({
    key,
    url,
    release: read(() => process.env.BERTHA_RELEASE),
    environment: read(() => process.env.BERTHA_ENVIRONMENT) ?? read(() => process.env.NODE_ENV),
  })
} else {
  console.warn("[bertha] Set NEXT_PUBLIC_BERTHA_KEY and NEXT_PUBLIC_BERTHA_URL. Nothing will be sent.")
}

export function onRouterTransitionStart(url: string, navigationType: "push" | "replace" | "traverse"): void {
  addBreadcrumb({ category: "navigation", message: `${navigationType} ${url}` })
}
