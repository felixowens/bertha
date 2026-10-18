import { useState, type ReactNode } from "react"
import { cn } from "cn"
import { Square, toneBg, type Tone } from "@/components/ui/primitives"

/**
 * bertha's charts are built from square cells on a dark grid. A filled cell is a
 * value; a dim cell is room; a hatched, outlined cell means nothing was received.
 */

// ── Micro bars beside a headline number, or in a row ─────────────────────────
export function CellBars({
  values,
  rows = 6,
  cell = 3,
  highlightLast = true,
  tone = "quiet",
  label,
}: {
  values: (number | null)[]
  rows?: number
  cell?: number
  highlightLast?: boolean
  tone?: Tone
  label?: string
}) {
  const max = Math.max(1, ...values.map((v) => v ?? 0))
  return (
    <div role="img" aria-label={label} className="flex items-end" style={{ gap: 1 }}>
      {values.map((v, i) => {
        const filled = v === null ? 0 : v === 0 ? 0 : Math.max(1, Math.round((v / max) * rows))
        const last = highlightLast && i === values.length - 1
        return (
          <div key={i} className="flex flex-col-reverse" style={{ gap: 1 }}>
            {Array.from({ length: rows }, (_, r) => (
              <span
                key={r}
                className={cn(
                  "block rounded-[0.5px]",
                  v === null ? "cell-void" : r < filled ? (last ? (tone === "quiet" ? "bg-foreground" : toneBg[tone]) : "bg-cell-quiet") : "bg-cell",
                )}
                style={{ width: cell, height: cell }}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Segmented progress bar of squares coloured by state ─────────────────────
export type Segment = { tone: Tone; count: number; label: string }

export function CellStrip({ segments, cells = 42, className }: { segments: Segment[]; cells?: number; className?: string }) {
  const total = segments.reduce((s, x) => s + x.count, 0)
  // Distribute cells proportionally, giving every non-zero segment at least one.
  const alloc = segments.map((s) => (s.count === 0 ? 0 : Math.max(1, Math.round((s.count / Math.max(total, 1)) * cells))))
  let over = alloc.reduce((a, b) => a + b, 0) - cells
  for (let i = alloc.length - 1; over > 0 && i >= 0; i--) {
    const take = Math.min(over, Math.max(0, alloc[i] - 1))
    alloc[i] -= take
    over -= take
  }
  const tones = segments.flatMap((s, i) => Array<Tone>(alloc[i]).fill(s.tone))
  return (
    <div
      role="img"
      aria-label={segments.map((s) => `${s.count} ${s.label}`).join(", ")}
      className={cn("grid gap-[3px]", className)}
      style={{ gridTemplateColumns: `repeat(${tones.length}, minmax(0, 1fr))` }}
    >
      {tones.map((t, i) => (
        <span key={i} className={cn("aspect-square animate-cell-in rounded-[1px]", toneBg[t])} style={{ animationDelay: `${i * 8}ms` }} />
      ))}
    </div>
  )
}

export function Legend({ items, className }: { items: { tone: Tone; label: ReactNode; hollow?: boolean }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground", className)}>
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-2">
          {it.hollow ? <span aria-hidden className="cell-void inline-block size-2 rounded-[1px]" /> : <Square tone={it.tone} />}
          {it.label}
        </li>
      ))}
    </ul>
  )
}

// ── Waffle grid for proportions ─────────────────────────────────────────────
export function Waffle({ segments, cols = 12, rows = 10 }: { segments: Segment[]; cols?: number; rows?: number }) {
  const cells = cols * rows
  const total = Math.max(
    1,
    segments.reduce((s, x) => s + x.count, 0),
  )
  const tones: Tone[] = []
  // Rarest categories fill from the bottom-right so they're never lost.
  for (const s of [...segments].reverse()) {
    const n = s.count === 0 ? 0 : Math.max(1, Math.round((s.count / total) * cells))
    for (let i = 0; i < n && tones.length < cells; i++) tones.push(s.tone)
  }
  while (tones.length < cells) tones.push("cell")
  tones.reverse()
  return (
    <div role="img" aria-label={segments.map((s) => `${s.count} ${s.label}`).join(", ")} className="grid w-fit gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, 10px)` }}>
      {tones.map((t, i) => (
        <span key={i} className={cn("size-[10px] rounded-[1px]", toneBg[t])} />
      ))}
    </div>
  )
}

// ── Stacked column chart of cells ───────────────────────────────────────────
export type Column = {
  key: string
  /** Bottom first. Null = nothing received (drawn hatched, not empty). */
  stack: { tone: Tone; value: number }[] | null
  /** Small white tick under the column, e.g. a deploy. */
  mark?: string[]
  tip: ReactNode
}

export function CellColumns({
  columns,
  rows = 12,
  average,
  divider,
  height = 168,
  floor = 1,
}: {
  columns: Column[]
  /** Smallest full-scale value, so a 2-event day doesn't fill the column. */
  floor?: number
  rows?: number
  /** Value at which to draw the dotted reference line. */
  average?: { value: number; label: string }
  /** Column index before which to draw a dotted vertical line (e.g. the deploy). */
  divider?: { index: number; label: string }
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(floor, average?.value ?? 0, ...columns.map((c) => (c.stack ?? []).reduce((s, x) => s + x.value, 0)))
  const unit = max / rows
  const gap = 3
  const avgRow = average ? average.value / unit : null

  return (
    <div className="relative select-none" onMouseLeave={() => setHover(null)}>
      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`, columnGap: gap, height }}>
        {columns.map((c, i) => {
          const total = (c.stack ?? []).reduce((s, x) => s + x.value, 0)
          // Cells per segment, at least one for any non-zero part.
          const cells: Tone[] = []
          if (c.stack) {
            for (const seg of c.stack) {
              const n = seg.value === 0 ? 0 : Math.max(1, Math.round(seg.value / unit))
              for (let k = 0; k < n && cells.length < rows; k++) cells.push(seg.tone)
            }
          }
          const dim = hover !== null && hover !== i
          return (
            <div
              key={c.key}
              onMouseEnter={() => setHover(i)}
              className="relative flex flex-col-reverse"
              style={{ rowGap: gap }}
              aria-label={typeof c.tip === "string" ? c.tip : undefined}
            >
              {Array.from({ length: rows }, (_, r) => (
                <span
                  key={r}
                  className={cn(
                    "min-h-0 flex-1 rounded-[1px] transition-opacity duration-150",
                    c.stack === null ? "cell-void" : r < cells.length ? toneBg[cells[r]] : "bg-cell/60",
                    dim && "opacity-40",
                    total === 0 && c.stack !== null && r === 0 && "bg-cell",
                  )}
                />
              ))}
            </div>
          )
        })}

        {avgRow !== null && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground/70" style={{ bottom: `${(avgRow / rows) * 100}%` }} />
        )}
        {divider && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-[-8px] border-l border-dashed border-foreground/80"
            style={{ left: `calc(${(divider.index / columns.length) * 100}% - ${gap / 2}px)` }}
          >
            <span className="absolute -top-5 left-1.5 whitespace-nowrap font-mono text-2xs text-foreground">{divider.label}</span>
          </div>
        )}
      </div>

      {/* Marks row (deploys) */}
      {columns.some((c) => c.mark?.length) && (
        <div className="mt-1.5 grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`, columnGap: gap }}>
          {columns.map((c) => (
            <span key={c.key} className="flex justify-center">
              {c.mark?.length ? <span className="h-1.5 w-full max-w-[10px] rounded-[1px] bg-foreground" /> : null}
            </span>
          ))}
        </div>
      )}

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-20 w-max min-w-36 rounded-md border border-border bg-popover px-3 py-2.5 text-xs shadow-pop"
          style={{
            bottom: height + 8 - Math.min(height * 0.25, 40),
            left: `${((hover + 0.5) / columns.length) * 100}%`,
            transform: `translateX(${hover > columns.length * 0.6 ? "-100%" : "8px"})`,
          }}
        >
          {columns[hover].tip}
        </div>
      )}
    </div>
  )
}

// ── Ribbon: one cell per check or day, coloured by state ────────────────────
export function Ribbon({
  states,
  className,
  cellClass = "h-4 w-[5px]",
  label,
  titles,
}: {
  states: Tone[]
  className?: string
  cellClass?: string
  label?: string
  /** A hover title per cell, e.g. which monitor it is. */
  titles?: string[]
}) {
  return (
    <div role="img" aria-label={label} className={cn("flex items-center gap-[2px]", className)}>
      {states.map((t, i) => (
        <span key={i} title={titles?.[i]} className={cn("rounded-[1px]", cellClass, toneBg[t])} />
      ))}
    </div>
  )
}

/** A bar of cells for a share of a whole (tag breakdowns). */
export function ShareCells({ share, cells = 20, tone = "quiet" }: { share: number; cells?: number; tone?: Tone }) {
  const n = share <= 0 ? 0 : Math.max(1, Math.round(share * cells))
  return (
    <div aria-hidden className="flex gap-[2px]">
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} className={cn("size-[6px] rounded-[0.5px]", i < n ? toneBg[tone] : "bg-cell")} />
      ))}
    </div>
  )
}
