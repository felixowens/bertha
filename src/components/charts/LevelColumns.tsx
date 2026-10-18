import type { LevelSeries, Release, Level } from "../../contract/domain"
import { CellColumns, Legend, type Column } from "./cells"
import { Mono, Square } from "@/components/ui/primitives"
import { day, num, version } from "@/lib/format"
import { levelLabel, levelTone } from "@/lib/meaning"

const ORDER: Level[] = ["fatal", "error", "warning"]

/** Events per day stacked by level, deploys marked, last period's average dotted. */
export function LevelColumns({
  series,
  releases,
  days,
  previousAverage,
  projectName,
  height,
}: {
  series: LevelSeries
  releases: Release[]
  days: number
  previousAverage?: number
  projectName: (id: string) => string
  height?: number
}) {
  const len = series.byLevel.error.length
  const from = Math.max(0, len - days)
  const start = new Date(series.start).getTime()
  const columns: Column[] = []
  for (let i = from; i < len; i++) {
    const date = new Date(start + i * 86400e3).toISOString()
    const dayKey = date.slice(0, 10)
    const vals = ORDER.map((l) => series.byLevel[l][i])
    const none = vals.every((v) => v === null)
    const deploys = releases.filter((r) => r.deployedAt.slice(0, 10) === dayKey)
    const total = vals.reduce<number>((s, v) => s + (v ?? 0), 0)
    columns.push({
      key: dayKey,
      stack: none ? null : ORDER.map((l, k) => ({ tone: levelTone[l], value: vals[k] ?? 0 })),
      mark: deploys.map((d) => version(d.version)),
      tip: (
        <div className="flex flex-col gap-1.5">
          <div className="text-faint">{day(date)}</div>
          {none ? (
            <div className="text-foreground">Nothing received</div>
          ) : (
            <>
              <div className="text-foreground">
                <Mono className="text-base">{num(total)}</Mono> events
              </div>
              <div className="flex gap-3">
                {ORDER.map((l, k) => (
                  <span key={l} className="flex items-center gap-1.5 text-muted-foreground">
                    <Square tone={levelTone[l]} />
                    <Mono>{num(vals[k] ?? 0)}</Mono>
                  </span>
                ))}
              </div>
            </>
          )}
          {deploys.map((d) => (
            <div key={d.id} className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-1.5 w-2 rounded-[1px] bg-foreground" />
              <Mono className="text-foreground">{version(d.version)}</Mono>
              <span className="truncate">{projectName(d.projectId)}</span>
            </div>
          ))}
        </div>
      ),
    })
  }
  const first = columns[0]?.key
  const hasGap = columns.some((c) => c.stack === null)

  return (
    <div>
      <CellColumns
        columns={columns}
        height={height}
        average={previousAverage ? { value: previousAverage, label: "Previous period, daily average" } : undefined}
      />
      <div className="mt-2 flex justify-between font-mono text-2xs text-faint">
        <span>{first && day(first + "T00:00:00Z")}</span>
        <span>Today</span>
      </div>
      <Legend
        className="mt-4"
        items={[
          ...ORDER.map((l) => ({ tone: levelTone[l], label: levelLabel[l] })),
          ...(previousAverage ? [{ tone: "quiet" as const, label: <span className="flex items-center gap-2"><span className="w-3 border-t border-dashed border-muted-foreground" />Prev. avg</span> }] : []),
          ...(hasGap ? [{ tone: "void" as const, hollow: true, label: "Nothing received" }] : []),
        ]}
      />
    </div>
  )
}
