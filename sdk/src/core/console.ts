// console.* as breadcrumbs (the browser) and, with `captureConsole`, as log lines.

import { describeValue } from "./client.ts"
import { getClient } from "./hub.ts"

const LEVELS = { debug: "debug", log: "info", info: "info", warn: "warning", error: "error" } as const
let installed = false

export function instrumentConsole(crumbs: boolean): void {
  if (installed) return
  installed = true
  for (const method of Object.keys(LEVELS) as (keyof typeof LEVELS)[]) {
    const original = console[method]
    console[method] = (...args: unknown[]) => {
      const client = getClient()
      const text = args.map((a) => (typeof a === "string" ? a : a instanceof Error ? a.message : describeValue(a))).join(" ")
      // The SDK's own warnings, which would otherwise loop.
      if (client && !text.startsWith("[bertha]")) {
        const level = LEVELS[method]
        if (crumbs && level !== "debug") client.addBreadcrumb({ category: "console", message: text.slice(0, 500), level })
        if (client.options.captureConsole) client.write(level, text, undefined, undefined, args.find((a) => a instanceof Error))
      }
      original.apply(console, args)
    }
  }
}
