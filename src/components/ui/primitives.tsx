import type { ComponentProps, ReactNode } from "react"
import { cn } from "cn"
import { initials } from "@/lib/format"
import { Indicator } from "./motion"

/** Meaning carried by colour. Every coloured thing in bertha is one of these. */
export type Tone = "danger" | "warn" | "ok" | "info" | "quiet" | "cell" | "void" | "fg"

export const toneBg: Record<Tone, string> = {
  danger: "bg-danger",
  warn: "bg-warn",
  ok: "bg-ok",
  info: "bg-info",
  quiet: "bg-cell-quiet",
  cell: "bg-cell",
  void: "cell-void",
  fg: "bg-foreground",
}
export const toneText: Record<Tone, string> = {
  danger: "text-danger",
  warn: "text-warn",
  ok: "text-ok",
  info: "text-info",
  quiet: "text-muted-foreground",
  cell: "text-faint",
  void: "text-faint",
  fg: "text-foreground",
}

/** A legend chip: the square that keys a colour. */
export function Square({ tone, className, hollow }: { tone: Tone; className?: string; hollow?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-[1px]", hollow ? "border border-current bg-transparent" : toneBg[tone], hollow && toneText[tone], className)}
    />
  )
}

/**
 * A level's marker. The shape carries the level too, so colour is never the only signal:
 * a triangle for a crash, a filled square for an error, a hollow square for a warning, and
 * for log lines a dot for info and a dash for debug.
 */
export function LevelGlyph({ level, className }: { level: "fatal" | "error" | "warning" | "info" | "debug"; className?: string }) {
  if (level === "info") return <span aria-hidden className={cn("grid size-2 shrink-0 place-items-center", className)}><span className="size-1 rounded-full bg-faint" /></span>
  if (level === "debug") return <span aria-hidden className={cn("grid size-2 shrink-0 place-items-center", className)}><span className="h-px w-1.5 bg-faint" /></span>
  if (level === "fatal")
    return (
      <svg aria-hidden viewBox="0 0 10 10" className={cn("inline-block size-2.5 shrink-0 fill-current text-danger", className)}>
        <path d="M5 0.5 9.6 9.3H0.4Z" />
      </svg>
    )
  return <Square tone={level === "error" ? "quiet" : "cell"} hollow={level === "warning"} className={cn(level === "warning" && "text-faint", className)} />
}

/** Square marker with an inner dot, used for saved views (like a framed square). */
export function FramedSquare({ tone }: { tone: Tone }) {
  return (
    <span aria-hidden className={cn("grid size-3.5 shrink-0 place-items-center rounded-[2px] border", toneText[tone], "border-current")}>
      <span className={cn("size-1.5 rounded-[1px]", toneBg[tone])} />
    </span>
  )
}

export function Mono({ className, ...p }: ComponentProps<"span">) {
  return <span className={cn("font-mono tabular", className)} {...p} />
}

export function Label({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("text-xs text-faint", className)} {...p} />
}

export function Card({ className, ...p }: ComponentProps<"section">) {
  return <section className={cn("rounded-lg border border-hairline bg-card", className)} {...p} />
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn("inline-grid h-[18px] min-w-[18px] place-items-center rounded-[3px] border border-border bg-raised px-1 font-mono text-2xs text-muted-foreground", className)}
    >
      {children}
    </kbd>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      title={name}
      className={cn("inline-grid size-6 shrink-0 place-items-center rounded-[4px] border border-border bg-raised font-mono text-2xs text-muted-foreground", className)}
    >
      {initials(name)}
    </span>
  )
}

/** Small bordered pill with a status dot: "Live", "Down", "Paused". */
export function StatusPill({ tone, children, pulse, className }: { tone: Tone; children: ReactNode; pulse?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-[5px] border border-border bg-card px-2 text-xs text-muted-foreground", className)}>
      <Square tone={tone} className={cn("size-1.5", pulse && "animate-pulse-dot")} />
      {children}
    </span>
  )
}

/** Segmented range tabs: small bordered pills, one active. */
export function PillTabs<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="relative flex items-center gap-1">
      <Indicator selector='[aria-selected="true"]' watch={value} className="rounded-[5px] border border-border bg-raised" />
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "press relative h-7 rounded-[5px] border px-2.5 text-xs",
            o.value === value ? "border-transparent text-foreground" : "border-hairline text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-hairline", className)} />
}
