import { useSyncExternalStore } from "react"

/**
 * "Now" for every relative time on screen. The real clock in production; the fixture
 * backend stops it at the fixtures' moment so "4m ago" matches the seeded data.
 */
let frozen: number | null = null

export function freezeClock(at: number) {
  frozen = at
}

export const now = () => frozen ?? Date.now()

// One shared timer re-renders whoever reads the minute, so "4m ago" stays true.
const listeners = new Set<() => void>()
let minute = Math.floor(now() / 60_000)
let timer: ReturnType<typeof setInterval> | null = null

function subscribe(fn: () => void) {
  listeners.add(fn)
  if (!timer && frozen === null)
    timer = setInterval(() => {
      const m = Math.floor(now() / 60_000)
      if (m === minute) return
      minute = m
      for (const l of listeners) l()
    }, 5_000)
  return () => {
    listeners.delete(fn)
    if (!listeners.size && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

/** The current minute; the caller re-renders when it changes. */
export const useMinute = () => useSyncExternalStore(subscribe, () => minute)
