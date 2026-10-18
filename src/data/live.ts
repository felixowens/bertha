import { useEffect, useRef, useSyncExternalStore } from "react"
import type { LiveEvent, LiveStatus } from "../../packet/contract/domain"
import { backend } from "./backend"

/**
 * Shares one `backend.subscribe` among every component that listens: opened by the
 * first, closed with the last. The live dot reads the status.
 */

export type { LiveEvent, LiveStatus }

const handlers = new Set<(e: LiveEvent) => void>()
const watchers = new Set<() => void>()
let status: LiveStatus = "connecting"
let unsubscribe: (() => void) | null = null

function setStatus(s: LiveStatus) {
  if (s === status) return
  status = s
  for (const w of watchers) w()
}

function open() {
  if (unsubscribe) return
  unsubscribe = backend.subscribe({
    event: (e) => {
      for (const h of handlers) h(e)
    },
    status: setStatus,
  })
}

function close() {
  unsubscribe?.()
  unsubscribe = null
}

/** Calls `handler` for each notice while mounted. */
export function useLive(handler: (e: LiveEvent) => void) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    const h = (e: LiveEvent) => ref.current(e)
    handlers.add(h)
    open()
    return () => {
      handlers.delete(h)
      if (!handlers.size) close()
    }
  }, [])
}

/**
 * Re-runs `reload` after notices that `matters` says are relevant, at most once per
 * `wait` ms, so a burst of events is one refetch. A resync always counts.
 */
export function useLiveReload(reload: () => void, matters: (e: LiveEvent) => boolean, wait = 1_000) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  useLive((e) => {
    if (e.kind !== "resync" && !matters(e)) return
    if (timer.current) return
    timer.current = setTimeout(() => {
      timer.current = null
      reload()
    }, wait)
  })
}

export const useLiveStatus = () =>
  useSyncExternalStore(
    (fn) => {
      watchers.add(fn)
      return () => watchers.delete(fn)
    },
    () => status,
  )

/** Every issue a notice names. */
export function issuesIn(e: LiveEvent): string[] {
  if (e.kind === "ingested") return [...e.newIssues, ...e.regressed, ...e.touched]
  if (e.kind === "issuesChanged") return e.issueIds
  return []
}
