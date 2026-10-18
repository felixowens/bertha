import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react"
import type { Routes } from "../contract/pages"

export type RoutePattern = keyof Routes

// Most specific first.
const PATTERNS: RoutePattern[] = [
  "/projects/new",
  "/projects/:projectId/settings",
  "/issues/:issueId",
  "/releases/:releaseId",
  "/uptime/:monitorId",
  "/invite/:token",
  "/settings/alerts",
  "/settings/team",
  "/sign-in",
  "/issues",
  "/releases",
  "/uptime",
  "/",
]

export type Match = { pattern: RoutePattern; params: Record<string, string> } | null

export function match(path: string): Match {
  for (const pattern of PATTERNS) {
    const keys: string[] = []
    const re = new RegExp(
      "^" + pattern.replace(/:(\w+)/g, (_, k: string) => (keys.push(k), "([^/]+)")) + "/?$",
    )
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
const snapshot = () => window.location.pathname + window.location.search

export function useLocation() {
  const href = useSyncExternalStore(subscribe, snapshot)
  const url = new URL(href, window.location.origin)
  return { path: url.pathname, query: url.searchParams, href }
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (to === snapshot()) return
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
