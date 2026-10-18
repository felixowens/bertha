import { useEffect, useSyncExternalStore, type ReactNode } from "react"
import { cn } from "cn"
import { Square, type Tone } from "./primitives"

type Toast = { id: number; tone: Tone; body: ReactNode; action?: { label: string; key?: string; run: () => void }; leaving?: boolean }

let toasts: Toast[] = []
const subs = new Set<() => void>()
const emit = () => subs.forEach((s) => s())
let next = 1
/** Time left on each toast's clock; hovering the stack stops every clock. */
const clocks = new Map<number, { left: number; started: number; timer?: number }>()
let held = false
const LEAVE_MS = 150

function start(id: number) {
  const c = clocks.get(id)
  if (!c || held) return
  c.started = Date.now()
  c.timer = window.setTimeout(() => dismiss(id), c.left)
}
function hold(on: boolean) {
  held = on
  for (const [id, c] of clocks) {
    if (on) {
      clearTimeout(c.timer)
      c.left = Math.max(1200, c.left - (Date.now() - c.started))
    } else start(id)
  }
}

export function toast(t: Omit<Toast, "id" | "leaving">, ms = 5000) {
  const id = next++
  // Three at most: the oldest gives way.
  const old = toasts.filter((x) => !x.leaving).slice(0, -2)
  toasts = [...toasts, { ...t, id }]
  old.forEach((x) => dismiss(x.id))
  clocks.set(id, { left: ms, started: Date.now() })
  start(id)
  emit()
  return id
}
/** Plays the toast out, then removes it. */
export function dismiss(id: number) {
  const t = toasts.find((x) => x.id === id)
  if (!t || t.leaving) return
  clearTimeout(clocks.get(id)?.timer)
  clocks.delete(id)
  toasts = toasts.map((x) => (x.id === id ? { ...x, leaving: true } : x))
  emit()
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== id)
    emit()
  }, LEAVE_MS)
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => (subs.add(cb), () => subs.delete(cb)),
    () => toasts,
  )
  // "z" runs the newest toast's action (undo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = list.filter((x) => !x.leaving).at(-1)
      if (!t?.action?.key || e.key !== t.action.key || e.metaKey || e.ctrlKey) return
      if ((e.target as HTMLElement).closest("input,textarea,[contenteditable]")) return
      e.preventDefault()
      t.action.run()
      dismiss(t.id)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [list])

  return (
    <div
      aria-live="polite"
      onPointerEnter={() => hold(true)}
      onPointerLeave={() => hold(false)}
      className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2"
    >
      {list.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-popover px-3.5 py-3 text-sm shadow-pop",
            t.leaving
              ? "pointer-events-none animate-out fade-out-0 slide-out-to-right-4 fill-mode-forwards duration-150 ease-in-quart"
              : "animate-in fade-in-0 zoom-in-[0.97] slide-in-from-bottom-3 duration-200 ease-smooth",
          )}
        >
          <Square tone={t.tone} className="mt-[6px]" />
          <div className="min-w-0 flex-1 text-foreground">{t.body}</div>
          {t.action && (
            <button
              onClick={() => {
                t.action!.run()
                dismiss(t.id)
              }}
              className="press flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              {t.action.label}
              {t.action.key && <span className="rounded-[3px] border border-border px-1 font-mono text-2xs">{t.action.key}</span>}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
