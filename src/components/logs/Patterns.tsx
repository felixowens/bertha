import { cn } from "cn"
import type { LogPattern } from "../../contract/domain"
import { LevelGlyph, Mono, toneText } from "@/components/ui/primitives"
import { ago, compact, stamp } from "@/lib/format"
import { logLevelLabel, logLevelTone, logMessageTone } from "@/lib/meaning"
import { Link } from "@/lib/router"

const BINS = 24
const GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 md:grid-cols-[minmax(0,1fr)_auto_64px_88px] md:gap-x-6"

/** A pattern's counts folded into 24 cells. A cell with no data at all stays null. */
function bins(counts: (number | null)[]): (number | null)[] {
  const per = Math.max(1, Math.ceil(counts.length / BINS))
  const out: (number | null)[] = []
  for (let i = 0; i < counts.length; i += per) {
    const part = counts.slice(i, i + per)
    out.push(part.every((c) => c === null) ? null : part.reduce<number>((s, c) => s + (c ?? 0), 0))
  }
  return out
}

/** Four steps of grey by share of the pattern's busiest cell; a crash pattern's top step is red. */
function fill(v: number | null, max: number, fatal: boolean) {
  if (v === null) return "cell-void"
  if (!v) return "bg-cell"
  const share = v / max
  if (share <= 1 / 3) return "bg-cell-quiet"
  if (share <= 2 / 3) return "bg-muted-foreground"
  return fatal ? "bg-danger" : "bg-foreground"
}

export function PatternCells({ p, className }: { p: LogPattern; className?: string }) {
  const cells = bins(p.counts)
  const max = Math.max(1, ...cells.map((c) => c ?? 0))
  return (
    <span aria-hidden className={cn("flex gap-[2px]", className)}>
      {cells.map((c, i) => (
        <span key={i} className={cn("size-2 shrink-0 rounded-[1px]", fill(c, max, p.level === "fatal"))} />
      ))}
    </span>
  )
}

/** `<n>`, `<id>` and friends read quieter than the words around them. */
export function Template({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {text.split(/(<[a-z]+>)/).map((part, i) => (i % 2 ? <span key={i} className="text-faint">{part}</span> : part))}
    </span>
  )
}

/** The common messages in the range, most lines first. Each opens its lines. */
export function PatternList({ patterns, projectName, hrefFor }: { patterns: LogPattern[]; projectName?: (id: string) => string; hrefFor: (p: LogPattern) => string }) {
  return (
    <div>
      <div className={cn(GRID, "hidden border-b border-hairline px-4 py-2 text-xs text-faint md:grid md:px-6")}>
        <span>Message</span>
        <span>Over the range</span>
        <span className="text-right">Lines</span>
        <span className="text-right">Last seen</span>
      </div>
      <ul>
        {patterns.map((p) => (
          <li key={p.id} className="border-b border-hairline last:border-b-0">
            <Link to={hrefFor(p)} className={cn(GRID, "group px-4 py-3 transition-colors duration-150 hover:bg-raised/50 md:px-6")}>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn("flex shrink-0 items-center", toneText[logLevelTone[p.level]])} title={logLevelLabel[p.level]}>
                    <LevelGlyph level={p.level} />
                  </span>
                  <Template text={p.template} className={cn("truncate font-mono text-xs", toneText[logMessageTone[p.level]])} />
                </div>
                <div className="mt-1 flex min-w-0 gap-2 pl-4 text-xs text-faint">
                  {projectName && <span className="shrink-0">{projectName(p.projectId)}</span>}
                  <Mono className="truncate">{p.sample.message}</Mono>
                </div>
                <Mono className="mt-1 block pl-4 text-2xs text-faint">first seen {stamp(p.firstSeen)}</Mono>
              </div>
              <PatternCells p={p} className="hidden md:flex" />
              <Mono className="text-right text-sm text-foreground">{compact(p.count)}</Mono>
              <Mono className="hidden text-right text-xs text-muted-foreground md:block">{ago(p.lastSeen)}</Mono>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
