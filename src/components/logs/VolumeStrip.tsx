import { useState } from "react"
import { cn } from "cn"
import type { LogLevel, LogVolume } from "../../contract/domain"
import { Mono } from "@/components/ui/primitives"
import { logLevelLabel, logVolumeFill } from "@/lib/meaning"
import { day, num, plural, time } from "@/lib/format"

const ROWS = 5
/** Worst first: they sit at the base of each column. */
const STACK: LogLevel[] = ["fatal", "error", "warning", "info", "debug"]

type Column = { at: number; total: number | null; byLevel: Record<LogLevel, number>; cells: LogLevel[] }

function columns(v: LogVolume): Column[] {
  const start = Date.parse(v.start)
  const n = v.byLevel.info.length
  const totals = Array.from({ length: n }, (_, i) => (STACK.every((l) => v.byLevel[l][i] === null) ? null : STACK.reduce((s, l) => s + (v.byLevel[l][i] ?? 0), 0)))
  const max = Math.max(1, ...totals.map((t) => t ?? 0))
  return totals.map((total, i) => {
    const byLevel = Object.fromEntries(STACK.map((l) => [l, v.byLevel[l][i] ?? 0])) as Record<LogLevel, number>
    const cells: LogLevel[] = []
    if (total) {
      // A column's height is its share of the busiest bucket, at least one cell; each level
      // present gets its share of that, and a fatal or error line always shows.
      let room = Math.max(1, Math.round((total / max) * ROWS))
      for (const l of STACK) {
        if (!byLevel[l] || !room) continue
        const k = Math.min(room, Math.max(1, Math.round((byLevel[l] / total) * room)))
        for (let j = 0; j < k; j++) cells.push(l)
        room -= k
      }
    }
    return { at: start + i * v.bucketSeconds * 1000, total, byLevel, cells }
  })
}

function span(c: Column, seconds: number) {
  const end = new Date(c.at + seconds * 1000).toISOString()
  const from = new Date(c.at).toISOString()
  return `${day(from)} ${time(from)}–${time(end)}`
}

/**
 * Lines per bucket across the range, as columns of square cells stacked worst first.
 * Hatched columns are times bertha has no logs for. Clicking a column looks closer at it.
 */
export function VolumeStrip({ volume, onPick, className }: { volume: LogVolume | null; onPick?: (bucketEnd: string) => void; className?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  if (!volume)
    return (
      <div className={cn("px-4 py-3 md:px-6", className)} aria-busy>
        <div className="flex h-[48px] items-end gap-px md:gap-[2px]">
          {Array.from({ length: 48 }, (_, i) => (
            <span key={i} className="h-2 flex-1 animate-pulse-dot rounded-[1px] bg-cell" style={{ animationDelay: `${(i % 8) * 110}ms` }} />
          ))}
        </div>
        <Mono className="mt-1.5 block text-2xs text-faint">&nbsp;</Mono>
      </div>
    )
  const cols = columns(volume)
  const step = volume.bucketSeconds
  const h = hover === null ? null : cols[hover]!
  const first = new Date(cols[0]!.at).toISOString()
  const last = new Date(cols.at(-1)!.at + step * 1000).toISOString()
  return (
    <div className={cn("px-4 py-3 md:px-6", className)}>
      <div role="img" aria-label="Lines over time, by level" className="flex items-end gap-px md:gap-[2px]" onMouseLeave={() => setHover(null)}>
        {cols.map((c, i) => (
          <button
            key={c.at}
            type="button"
            tabIndex={-1}
            aria-hidden
            disabled={!onPick || c.total === null}
            onMouseEnter={() => setHover(i)}
            onClick={() => onPick?.(new Date(c.at + step * 1000).toISOString())}
            className="flex min-w-0 flex-1 flex-col-reverse gap-px disabled:cursor-default"
          >
            {Array.from({ length: ROWS }, (_, r) => {
              const level = c.cells[r]
              return (
                <span
                  key={r}
                  className={cn(
                    "h-2 rounded-[1px] transition-colors duration-150",
                    c.total === null ? "cell-void" : level ? logVolumeFill[level] : hover === i ? "bg-cell" : "bg-cell/60",
                  )}
                />
              )
            })}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-3 font-mono text-2xs text-faint">
        {h ? (
          <span className="truncate">
            <span className="text-muted-foreground">{span(h, step)}</span>
            {" · "}
            {h.total === null
              ? "no logs kept for this time"
              : `${plural(h.total, "line")}${STACK.filter((l) => l !== "info" && l !== "debug" && h.byLevel[l]).map((l) => ` · ${num(h.byLevel[l])} ${logLevelLabel[l].toLowerCase()}`).join("")}`}
          </span>
        ) : (
          <>
            <span>
              {day(first)} {time(first)}
            </span>
            <span>
              {day(last)} {time(last)}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
