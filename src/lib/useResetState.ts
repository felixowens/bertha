import { useCallback, useState, type Dispatch, type SetStateAction } from "react"

/**
 * State that goes back to `initial` whenever `deps` change, compared like an effect's:
 * a form that follows what the server saved, a draft cleared when its menu closes. It
 * resets during render, so nothing shows the stale value for a frame, unlike
 * `useEffect(() => setX(initial), [dep])`.
 */
export function useResetState<T>(initial: T | (() => T), deps: readonly unknown[]): [T, Dispatch<SetStateAction<T>>] {
  const fresh = () => (typeof initial === "function" ? (initial as () => T)() : initial)
  const [kept, setKept] = useState(() => ({ deps, value: fresh() }))
  let current = kept
  if (kept.deps.length !== deps.length || !kept.deps.every((d, i) => Object.is(d, deps[i]))) {
    // Adjusting state while rendering, as React suggests for state derived from props.
    current = { deps, value: fresh() }
    setKept(current)
  }
  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => setKept((k) => ({ deps: k.deps, value: typeof next === "function" ? (next as (t: T) => T)(k.value) : next })),
    [],
  )
  return [current.value, set]
}
