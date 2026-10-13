import { cn } from "cn"

// A lowercase "b" drawn in the same square cells as the charts.
const B: [number, number][] = [
  [0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [0, 3], [3, 3], [0, 4], [1, 4], [2, 4],
]

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 19 24" className={cn("h-[18px] w-auto", className)} aria-hidden>
      {B.map(([x, y]) => (
        <rect key={`${x}${y}`} x={x * 5} y={y * 5} width="4" height="4" rx="0.5" className="fill-foreground" />
      ))}
    </svg>
  )
}

export function Wordmark({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <Mark />
      {!collapsed && <span className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">bertha</span>}
    </span>
  )
}
