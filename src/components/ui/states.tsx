import type { ReactNode } from "react"
import { cn } from "cn"
import { RotateCw } from "lucide-react"
import { Button } from "./button"
import { Square } from "./primitives"

/** Loading: a short row of cells filling in turn. No spinners. */
export function LoadingCells({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn("flex items-center gap-[3px]", className)}>
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          className="size-2 animate-pulse-dot rounded-[1px] bg-cell-quiet"
          style={{ animationDelay: `${i * 110}ms` }}
        />
      ))}
    </div>
  )
}

/** Placeholder block: dim cell texture, same footprint as the content it stands for. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse-dot rounded-md bg-raised/70", className)} />
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex max-w-md flex-col items-start gap-4", className)}>
      <div className="flex items-center gap-2 font-mono text-xs text-danger">
        <Square tone="danger" />
        ERR · couldn't load
      </div>
      <p className="text-base text-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  )
}

/** Empty: says what's true, and what to do if anything. Never celebratory. */
export function EmptyState({
  title,
  children,
  action,
  className,
  cells = "quiet",
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
  cells?: "quiet" | "void"
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3", className)}>
      <div aria-hidden className="grid grid-cols-6 gap-[3px]">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className={cn("size-2 rounded-[1px]", cells === "void" ? "cell-void" : i === 11 ? "bg-foreground" : "bg-cell")} />
        ))}
      </div>
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
      {action}
    </div>
  )
}

/** Inline failure message for a form or action, named after what happened. */
export function InlineError({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn("flex items-start gap-2 text-xs text-danger", className)}>
      <Square tone="danger" className="mt-[5px]" />
      <span>{children}</span>
    </p>
  )
}
