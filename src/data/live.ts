import { useEffect, useRef, useSyncExternalStore } from "react"
import type { LiveEvent } from "@/api/generated/api"
import { usesFixtures } from "./backend"

/**
 * Change notices from `GET /api/v1/live` (server-sent events), outside `Backend`:
 * see CONTRACT-REQUESTS.md #4. One stream per tab, opened by the first subscriber.
 * The fixture backend has no stream; it reports itself connected and stays quiet.
 */

export type LiveStatus = "connecting" | "open" | "down"
export type { LiveEvent }

const handlers = new Set<(e: LiveEvent) => void>()
const watchers = new Set<() => void>()
let status: LiveStatus = usesFixtures ? "open" : "connecting"
let source: EventSource | null = null
let retry: ReturnType<typeof setTimeout> | null = null
let failures = 0
/** After a gap, the first open asks every page to refetch what it may have missed. */
let missed = false

function setStatus(s: LiveStatus) {
  if (s === status) return
  status = s
  for (const w of watchers) w()
}

function emit(e: LiveEvent) {
  for (const h of handlers) h(e)
}

function connect() {
  if (usesFixtures || source || retry) return
  const es = new EventSource("/api/v1/live", { withCredentials: true })
  source = es
  es.onopen = () => {
    failures = 0
    setStatus("open")
    if (missed) emit({ kind: "resync" })
    missed = false
  }
  es.onmessage = (m: MessageEvent<string>) => {
    try {
      emit(JSON.parse(m.data) as LiveEvent)
    } catch {
      emit({ kind: "resync" })
    }
  }
  es.onerror = () => {
    missed = true
    if (es.readyState === EventSource.CONNECTING) return setStatus("connecting")
    // Closed for good (signed out, or the server refused): try again, slower each time.
    es.close()
    source = null
    setStatus("down")
    failures++
    const wait = Math.min(60_000, 2_000 * 2 ** Math.min(failures, 5))
    retry = setTimeout(() => {
      retry = null
      if (handlers.size) connect()
    }, wait)
  }
}

function disconnect() {
  source?.close()
  source = null
  if (retry) clearTimeout(retry)
  retry = null
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
    connect()
    return () => {
      handlers.delete(h)
      if (!handlers.size) disconnect()
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
