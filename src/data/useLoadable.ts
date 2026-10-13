import { useCallback, useEffect, useRef, useState } from "react"
import type { Loadable } from "../../packet/contract/domain"
import { scenario } from "./backend"

const isEmpty = (v: unknown) =>
  v === null || (Array.isArray(v) && v.length === 0)

/** Runs a Backend read and returns it as a Loadable. `null` or `[]` → empty. */
export function useLoadable<T>(
  load: () => Promise<T | null>,
  deps: unknown[],
): { state: Loadable<T>; reload: () => void; set: (fn: (t: T) => T) => void } {
  const [state, setState] = useState<Loadable<T>>({ status: "loading" })
  const [tick, setTick] = useState(0)
  const first = useRef(true)

  useEffect(() => {
    let live = true
    // Keep showing current data while a refresh runs; only the first load blanks.
    if (first.current) setState({ status: "loading" })
    load().then(
      (v) => {
        if (!live) return
        first.current = false
        setState(isEmpty(v) ? { status: "empty" } : { status: "ready", data: v as T })
      },
      (e: Error) => live && setState({ status: "error", message: e.message, retryable: true }),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const set = useCallback(
    (fn: (t: T) => T) => setState((s) => (s.status === "ready" ? { status: "ready", data: fn(s.data) } : s)),
    [],
  )
  return { state, reload, set }
}

/**
 * A named scenario may override part of a route's view model (`state` in
 * packet/fixtures/scenarios.ts). Returns that override when it targets `route`.
 */
export function scenarioState<V>(route: string): Partial<V> | null {
  const named = scenario.named
  return named && named.route === route && named.state ? (named.state as Partial<V>) : null
}

export type Ready<L> = L extends { status: "ready"; data: infer T } ? T : never

/**
 * useLoadable for a whole page: a named scenario's `state` override for this route
 * (loading, error…) wins over the live read.
 */
export function usePageLoadable<T>(route: string, load: () => Promise<T | null>, deps: unknown[]) {
  const l = useLoadable(load, deps)
  const o = scenarioState<Loadable<T>>(route) as Loadable<T> | null
  return o && "status" in o ? { ...l, state: o } : l
}
