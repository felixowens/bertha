import type { ReactNode } from "react"
import { cn } from "cn"
import type { LucideIcon } from "lucide-react"
import { Mono, toneText, type Tone } from "./primitives"

/** A strip of headline numbers separated by hairlines. */
export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 border-b border-hairline lg:grid-cols-4 [&>*]:border-hairline max-lg:[&>*:nth-child(odd)]:border-r max-lg:[&>*:nth-child(-n+2)]:border-b lg:[&>*:not(:last-child)]:border-r",
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Headline number: large and light, a coloured mono delta beside it, a cell chart at right. */
export function Stat({
  icon: Icon,
  label,
  value,
  unit,
  delta,
  deltaTone = "quiet",
  chart,
  hint,
}: {
  icon?: LucideIcon
  label: string
  value: ReactNode
  unit?: string
  delta?: string
  deltaTone?: Tone
  chart?: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 px-4 py-5 md:px-6 md:py-6">
      {Icon && <Icon className="size-[18px] text-faint" strokeWidth={1.5} aria-hidden />}
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-[28px] leading-none font-light tracking-[-0.02em] text-foreground tabular md:text-[32px]">
            {value}
            {unit && <span className="text-[0.6em] text-muted-foreground">{unit}</span>}
          </span>
          {delta && <Mono className={cn("text-xs", toneText[deltaTone])}>{delta}</Mono>}
        </div>
        {chart && <div className="hidden shrink-0 sm:block">{chart}</div>}
      </div>
      {hint && <div className="-mt-1 text-xs text-faint">{hint}</div>}
    </div>
  )
}
