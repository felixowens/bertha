import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react"
import type { Routes } from "../contract/pages"

export type RoutePattern = keyof Routes

// Most specific first.
const PATTERNS: RoutePattern[] = [
  "/projects/new",
  "/projects/:projectId/settings",
  "/projects/:projectId/connect",
  "/projects/:projectId/logs",
  "/uptime/:monitorId/report",
  "/projects/:projectId",
  "/issues/:issueId",
  "/releases/:releaseId",
  "/uptime/:monitorId",
  "/invite/:token",
  "/settings/alerts",
  "/settings/team",
  "/settings/agents",
  "/sign-in",
  "/issues",
  "/releases",
  "/uptime",
  "/logs",
  "/projects",
  "/",
]

export type Match = { pattern: RoutePattern; params: Record<string, string> } | null

export function match(path: string): Match {
  for (const pattern of PATTERNS) {
    const keys: string[] = []
    const re = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, k: string) => (keys.push(k), "([^/]+)")) + "/?$")
    const m = path.match(re)
    if (m) return { pattern, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) }
  }
  return null
}

const subscribe = (cb: () => void) => {
  window.addEventListener("popstate", cb)
  window.addEventListener("bertha:navigate", cb)
  return () => {
    window.removeEventListener("popstate", cb)
    window.removeEventListener("bertha:navigate", cb)
  }
}
type Location = { path: string; query: URLSearchParams; href: string }
let current: Location | null = null
/** The same object until the URL changes, as useSyncExternalStore asks of a snapshot. */
const snapshot = (): Location => {
  const href = window.location.pathname + window.location.search
  if (current?.href !== href) {
    const url = new URL(href, window.location.origin)
    current = { path: url.pathname, query: url.searchParams, href }
  }
  return current
}

/**
 * The current path and query. The same objects come back until the URL changes, so
 * `query` can be a hook dependency. Don't mutate it; build a new URLSearchParams.
 */
export function useLocation(): Location {
  return useSyncExternalStore(subscribe, snapshot)
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (to === snapshot().href) return
  window.history[opts.replace ? "replaceState" : "pushState"](null, "", to)
  window.dispatchEvent(new Event("bertha:navigate"))
  if (!opts.replace) window.scrollTo(0, 0)
}

/** Fills a pattern: href("/issues/:issueId", { issueId }) */
export function href(pattern: RoutePattern, params: Record<string, string> = {}): string {
  return pattern.replace(/:(\w+)/g, (_, k: string) => encodeURIComponent(params[k] ?? ""))
}

export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    navigate(to)
  }
  return <a href={to} onClick={click} {...rest} />
}
