import type { FailureInjection, Scenario as PacketScenario } from "../contract/scenarios"
import { scenarios } from "../../fixtures/scenarios"

/**
 * What `?scenario=` asks for. Either a generic state (every read does the same thing),
 * a bare failure kind, or one of the named scenarios in fixtures/scenarios.ts.
 */
export type ActiveScenario = {
  id: string | null
  reads: "normal" | "loading" | "empty" | "error"
  failure: FailureInjection | { op: null; kind: string } | null
  named: PacketScenario | null
  params: Record<string, string>
}

const GENERIC = ["loading", "empty", "error"] as const

export function readScenario(search = window.location.search): ActiveScenario {
  const q = new URLSearchParams(search)
  const id = q.get("scenario")
  const params: Record<string, string> = {}
  const named = id ? (scenarios.find((s) => s.id === id) ?? null) : null
  Object.assign(params, named?.params ?? {})
  // Query params beat scenario params, so a scenario can be explored further.
  for (const [k, v] of q) if (k !== "scenario") params[k] = v

  if (!id) return { id, reads: "normal", failure: null, named: null, params }
  if ((GENERIC as readonly string[]).includes(id)) {
    return { id, reads: id as ActiveScenario["reads"], failure: null, named: null, params }
  }
  if (named) return { id, reads: "normal", failure: named.failure ?? null, named, params }
  // A bare failure kind, e.g. ?scenario=conflict.
  return { id, reads: "normal", failure: { op: null, kind: id }, named: null, params }
}

/**
 * Puts a named scenario's params into the URL once, as the app loads, so pages read the
 * URL alone and the scenario can be explored further from there. Params the route's path
 * names are in the path already.
 */
export function seedUrl(): void {
  const q = new URLSearchParams(window.location.search)
  const named = scenarios.find((s) => s.id === q.get("scenario"))
  if (!named?.params) return
  const inPath = new Set([...named.route.matchAll(/:(\w+)/g)].map((m) => m[1]))
  let changed = false
  for (const [k, v] of Object.entries(named.params))
    if (!inPath.has(k) && !q.has(k)) {
      q.set(k, v)
      changed = true
    }
  if (changed) window.history.replaceState(null, "", `${window.location.pathname}?${q}${window.location.hash}`)
}

/** Concrete URL for a named scenario: fills `:params` in the route from its params. */
export function scenarioHref(s: PacketScenario): string {
  const params = { ...(s.params ?? {}) }
  const path = s.route.replace(/:(\w+)/g, (_, k: string) => {
    const v = params[k] ?? k
    delete params[k]
    return v
  })
  const q = new URLSearchParams({ scenario: s.id })
  return `${path}?${q}`
}

export { scenarios }
