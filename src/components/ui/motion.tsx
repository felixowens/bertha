import { useLayoutEffect, useRef, type ReactNode } from "react"
import { cn } from "cn"

/** False when the viewer asked for less motion. CSS covers itself; this is for script-driven motion. */
export const motionOk = () => typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Opens and closes its children by height, without measuring: a grid row from 0fr to 1fr. */
export function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      inert={!open}
      className={cn("grid transition-[grid-template-rows,opacity] duration-200 ease-smooth", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0", className)}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

/**
 * A value that rises into place when it changes. The first value just shows, so a page
 * loading doesn't animate every number on it.
 */
export function Tick({ value, children, className }: { value: string | number; children?: ReactNode; className?: string }) {
  const last = useRef(value)
  const changes = useRef(0)
  if (last.current !== value) {
    last.current = value
    changes.current++
  }
  return (
    <span key={changes.current} className={cn("inline-block", changes.current > 0 && "animate-tick", className)}>
      {children ?? value}
    </span>
  )
}

const remembered = new Map<string, { width: string; height: string; translate: string }>()

/**
 * A highlight that slides to whichever child matches `selector` (the active tab, the
 * current nav item). The parent must be `relative`, and the children it moves behind
 * need `relative` so they paint above it. It lands without moving on first paint,
 * unless `remember` names where an earlier one stood (tabs that live on two pages).
 */
export function Indicator({ selector, className, watch, remember }: { selector: string; className?: string; watch: unknown; remember?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const place = () => {
      const target = parent.querySelector<HTMLElement>(selector)
      // Nothing to sit behind, or it's folded away in a closed group.
      if (!target || target.closest("[inert]")) {
        el.style.opacity = "0"
        return
      }
      const a = target.getBoundingClientRect()
      const b = parent.getBoundingClientRect()
      el.style.opacity = "1"
      el.style.width = `${a.width}px`
      el.style.height = `${a.height}px`
      el.style.translate = `${a.left - b.left + parent.scrollLeft - parent.clientLeft}px ${a.top - b.top + parent.scrollTop - parent.clientTop}px`
      if (remember) remembered.set(remember, { width: el.style.width, height: el.style.height, translate: el.style.translate })
    }
    const from = remember && el.dataset.placed !== "1" ? remembered.get(remember) : undefined
    if (from && motionOk()) {
      // Start where the last one stood, then slide on from there.
      el.style.transitionDuration = "0ms"
      Object.assign(el.style, from, { opacity: "1" })
      el.getBoundingClientRect()
      el.dataset.placed = "1"
    }
    const moving = el.dataset.placed === "1" && motionOk()
    el.style.transitionDuration = moving ? "" : "0ms"
    place()
    if (!moving) {
      // Let the first placement paint before transitions switch on.
      requestAnimationFrame(() => {
        el.dataset.placed = "1"
        el.style.transitionDuration = ""
      })
    }
    // Follow layout changes (the sidebar collapsing, a group above folding) without sliding.
    let initial = true
    const ro = new ResizeObserver(() => {
      if (initial) return void (initial = false)
      el.style.transitionDuration = "0ms"
      place()
      requestAnimationFrame(() => (el.style.transitionDuration = ""))
    })
    ro.observe(parent)
    for (const child of parent.children) if (child !== el) ro.observe(child)
    return () => ro.disconnect()
  }, [selector, watch, remember])
  return (
    <span
      ref={ref}
      aria-hidden
      className={cn("pointer-events-none absolute top-0 left-0 opacity-0 transition-[translate,width,height,opacity] duration-200 ease-smooth", className)}
    />
  )
}
