import { useCallback, useEffect, useEffectEvent, useState } from "react"
import type { Loadable } from "../contract/domain"
import type { Routes } from "../contract/pages"
import { scenario } from "./backend"

const isEmpty = (v: unknown) => v === null || (Array.isArray(v) && v.length === 0)

/** What a read says when it fails without a message of its own. */
export const LOAD_FAILED = "bertha couldn't load this. Try again."

export type LoadOptions = {
  /** Show loading again on every load, not only the first. For lists whose old rows would mislead. */
  blank?: boolean
  /** Hold off until there is something to load. Nothing is fetched while false. */
  enabled?: boolean
  /** A page's route: a named scenario's `state` for it (loading, error…) wins over the read. */
  route?: keyof Routes
}

/**
 * The one way to read from `backend` in a component: runs `load` when `deps` change or
 * `reload` is called, drops answers that arrive after a newer load started, and returns
 * the result as a Loadable. `null` or `[]` is empty. List every value `load` uses in
 * `deps`; the lint checks this as it does for useEffect.
 */
export function useLoadable<T>(
  load: () => Promise<T | null>,
  deps: readonly unknown[],
  { blank = false, enabled = true, route }: LoadOptions = {},
): { state: Loadable<T>; reload: () => void; set: (fn: (t: T) => T) => void } {
  const [state, setState] = useState<Loadable<T>>({ status: "loading" })
  const [tick, setTick] = useState(0)
  const generation = useGeneration(deps)
  const read = useEffectEvent(load)

  useEffect(() => {
    if (!enabled) return
    let current = true
    // Keep what's shown while a refresh runs, unless asked to blank.
    setState((s) => (!blank && (s.status === "ready" || s.status === "empty") ? s : { status: "loading" }))
    read().then(
      (v) => current && setState(isEmpty(v) ? { status: "empty" } : { status: "ready", data: v as T }),
      (e: unknown) => current && setState({ status: "error", message: e instanceof Error ? e.message : LOAD_FAILED, retryable: true }),
    )
    return () => {
      current = false
    }
  }, [generation, tick, enabled, blank])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const set = useCallback((fn: (t: T) => T) => setState((s) => (s.status === "ready" ? { status: "ready", data: fn(s.data) } : s)), [])
  const override = route ? scenarioState<Loadable<T>>(route) : null
  return { state: override && "status" in override ? (override as Loadable<T>) : state, reload, set }
}

/** Counts changes to `deps`, compared item by item like an effect's. */
function useGeneration(deps: readonly unknown[]): number {
  const [seen, setSeen] = useState({ deps, n: 0 })
  if (seen.deps.length === deps.length && seen.deps.every((d, i) => Object.is(d, deps[i]))) return seen.n
  // Adjusting state while rendering, as React suggests for values derived from props.
  const next = { deps, n: seen.n + 1 }
  setSeen(next)
  return next.n
}

/**
 * `value`, or the one from the last render while it is JSON-equal to it. For a value
 * rebuilt on every render (a filter parsed from the URL) that a load depends on.
 */
export function useStableValue<T>(value: T): T {
  const [kept, setKept] = useState(value)
  if (kept === value || JSON.stringify(kept) === JSON.stringify(value)) return kept
  setKept(value)
  return value
}

/**
 * A named scenario may override part of a route's view model (`state` in
 * fixtures/scenarios.ts). Returns that override when it targets `route`.
 */
export function scenarioState<V>(route: keyof Routes): Partial<V> | null {
  const named = scenario.named
  return named && named.route === route && named.state ? (named.state as Partial<V>) : null
}

export type Ready<L> = L extends { status: "ready"; data: infer T } ? T : never
