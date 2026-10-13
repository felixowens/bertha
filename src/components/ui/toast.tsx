import { useEffect, useSyncExternalStore, type ReactNode } from "react"
import { cn } from "cn"
import { Square, type Tone } from "./primitives"

type Toast = { id: number; tone: Tone; body: ReactNode; action?: { label: string; key?: string; run: () => void } }

let toasts: Toast[] = []
const subs = new Set<() => void>()
const emit = () => subs.forEach((s) => s())
let next = 1

export function toast(t: Omit<Toast, "id">, ms = 5000) {
  const id = next++
  toasts = [...toasts.slice(-2), { ...t, id }]
  emit()
  setTimeout(() => dismiss(id), ms)
  return id
}
export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => (subs.add(cb), () => subs.delete(cb)),
    () => toasts,
  )
  // "z" runs the newest toast's action (undo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = list.at(-1)
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
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
      {list.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex animate-in items-start gap-3 rounded-lg border border-border bg-popover px-3.5 py-3 text-sm shadow-pop fade-in-0 slide-in-from-bottom-2"
        >
          <Square tone={t.tone} className="mt-[6px]" />
          <div className="min-w-0 flex-1 text-foreground">{t.body}</div>
          {t.action && (
            <button
              onClick={() => {
                t.action!.run()
                dismiss(t.id)
              }}
              className={cn("flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground")}
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
