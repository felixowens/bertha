import type { LevelSeries, Release, Level } from "../../contract/domain"
import { CellColumns, Legend, type Column } from "./cells"
import { LevelGlyph, Mono } from "@/components/ui/primitives"
import { day, num, time, version } from "@/lib/format"
import { levelLabel, levelTone } from "@/lib/meaning"

const ORDER: Level[] = ["fatal", "error", "warning"]
const STEP = { hour: 36e5, day: 864e5 } as const

/** Events per hour or day stacked by level, deploys marked, last period's average dotted. */
export function LevelColumns({
  series,
  releases,
  previousAverage,
  projectName,
  height,
}: {
  series: LevelSeries
  releases: Release[]
  previousAverage?: number
  projectName: (id: string) => string
  height?: number
}) {
  const step = STEP[series.bucket]
  const hourly = series.bucket === "hour"
  const len = series.byLevel.error.length
  const start = new Date(series.start).getTime()
  const columns: Column[] = []
  for (let i = 0; i < len; i++) {
    const from = start + i * step
    const at = new Date(from).toISOString()
    const vals = ORDER.map((l) => series.byLevel[l][i])
    const none = vals.every((v) => v === null)
    const deploys = releases.filter((r) => {
      const t = new Date(r.deployedAt).getTime()
      return t >= from && t < from + step
    })
    const total = vals.reduce<number>((s, v) => s + (v ?? 0), 0)
    columns.push({
      key: at,
      stack: none ? null : ORDER.map((l, k) => ({ tone: levelTone[l], value: vals[k] ?? 0 })),
      mark: deploys.map((d) => version(d.version)),
      tip: (
        <div className="flex flex-col gap-1.5">
          <div className="text-faint">{hourly ? `${day(at)} ${time(at)}` : day(at)}</div>
          {none ? (
            <div className="text-foreground">Nothing received</div>
          ) : (
            <>
              <div className="text-foreground">
                <Mono className="text-base">{num(total)}</Mono> events
              </div>
              <div className="flex gap-3">
                {ORDER.map((l, k) => (
                  <span key={l} className="flex items-center gap-1.5 text-muted-foreground" title={levelLabel[l]}>
                    <LevelGlyph level={l} />
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
        average={previousAverage ? { value: previousAverage, label: `Previous period, ${hourly ? "hourly" : "daily"} average` } : undefined}
      />
      <div className="mt-2 flex justify-between font-mono text-2xs text-faint">
        <span>{first && (hourly ? time(first) : day(first))}</span>
        <span>{hourly ? "Now" : "Today"}</span>
      </div>
      <Legend
        className="mt-4"
        items={[
          ...ORDER.map((l) => ({ tone: levelTone[l], label: levelLabel[l] })),
          ...(releases.length ? [{ tone: "fg" as const, label: "Deploy" }] : []),
          ...(previousAverage
            ? [
                {
                  tone: "quiet" as const,
                  label: (
                    <span className="flex items-center gap-2">
                      <span className="w-3 border-t border-dashed border-muted-foreground" />
                      Prev. avg
                    </span>
                  ),
                },
              ]
            : []),
          ...(hasGap ? [{ tone: "void" as const, hollow: true, label: "Nothing received" }] : []),
        ]}
      />
    </div>
  )
}
