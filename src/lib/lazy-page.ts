import { lazy, type ComponentType } from "react"
import { scenario, usesFixtures } from "@/data/backend"

const RELOADED = "bertha:reloaded-for-chunk"
/** A second failure this soon after reloading for one is real, not a stale tab. */
const RELOAD_WINDOW_MS = 10_000

/**
 * A page loaded when first opened. A release replaces every fingerprinted chunk, so a tab
 * opened before it asks for files the server no longer has. Then the page reloads once,
 * to the same path, and gets the new release. If that already happened just now, the
 * failure goes to the page's error boundary instead of looping.
 */
export function lazyPage<P extends object>(load: () => Promise<ComponentType<P>>) {
  return lazy(async () => {
    try {
      // `?scenario=…&chunk=missing` shows what a missing chunk looks like.
      if (scenario.params.chunk === "missing") throw new TypeError("Failed to fetch dynamically imported module")
      return { default: await load() }
    } catch (error) {
      if (usesFixtures || reloadedRecently()) throw error
      remember(RELOADED, String(Date.now()))
      location.reload()
      // Stay on the loading state until the reload takes over.
      return new Promise<never>(() => {})
    }
  })
}

function reloadedRecently(): boolean {
  try {
    const at = Number(sessionStorage.getItem(RELOADED))
    return Date.now() - at < RELOAD_WINDOW_MS
  } catch {
    // No storage means no way to tell, so don't risk a loop.
    return true
  }
}

function remember(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // Unreachable in practice: reloadedRecently already said storage works.
  }
}
