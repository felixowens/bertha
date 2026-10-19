import type { Level, Release, TimeSeries } from "../../contract/domain"
import { CellColumns, Legend, type Column } from "@/components/charts/cells"
import { Mono } from "@/components/ui/primitives"
import { day, num, version } from "@/lib/format"
import { levelTone } from "@/lib/meaning"

/** This issue's events per day, its project's deploys ticked underneath. */
export function History({ series, releases, level }: { series: TimeSeries; releases: Release[]; level: Level }) {
  const start = new Date(series.start).getTime()
  const tone = levelTone[level]
  const columns: Column[] = series.counts.map((v, i) => {
    const date = new Date(start + i * 86400e3).toISOString()
    const deploys = releases.filter((r) => r.source === "deploy" && r.deployedAt.slice(0, 10) === date.slice(0, 10))
    return {
      key: date.slice(0, 10),
      stack: v === null ? null : [{ tone, value: v }],
      mark: deploys.map((d) => version(d.version)),
      tip: (
        <div className="flex flex-col gap-1">
          <div className="text-faint">{day(date)}</div>
          <div className="text-foreground">{v === null ? "Nothing received" : <><Mono className="text-base">{num(v)}</Mono> events</>}</div>
          {deploys.map((d) => (
            <div key={d.id} className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-1.5 w-2 rounded-[1px] bg-foreground" />
              <Mono className="text-foreground">{version(d.version)}</Mono> deployed
            </div>
          ))}
        </div>
      ),
    }
  })
  const hasGap = series.counts.some((c) => c === null)
  return (
    <div>
      <CellColumns columns={columns} rows={8} height={96} floor={8} />
      <div className="mt-2 flex justify-between font-mono text-2xs text-faint">
        <span>{day(series.start)}</span>
        <span>Today</span>
      </div>
      <Legend
        className="mt-3"
        items={[
          { tone, label: "Events" },
          ...(releases.length ? [{ tone: "fg" as const, label: "Deploy" }] : []),
          ...(hasGap ? [{ tone: "void" as const, hollow: true, label: "Nothing received" }] : []),
        ]}
      />
    </div>
  )
}
