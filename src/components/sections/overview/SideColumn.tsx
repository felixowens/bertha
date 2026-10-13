import type { LevelSeries, Project, Release } from "../../../../packet/contract/domain"
import { LevelColumns } from "@/components/charts/LevelColumns"
import { Card, Mono, Square } from "@/components/ui/primitives"
import { useShell, projectName } from "@/components/shell/ShellContext"
import { ago, compact, num } from "@/lib/format"
import { healthLabel, healthRank, healthTone } from "@/lib/meaning"
import { Link } from "@/lib/router"

export function EventsCard({ series, releases, days }: { series: LevelSeries; releases: Release[]; days: number }) {
  const shell = useShell()
  // Previous-period average: the same number of days before the window, where we have them.
  const totals = series.byLevel.error.map((_, i) =>
    (["fatal", "error", "warning"] as const).reduce<number | null>((s, l) => {
      const v = series.byLevel[l][i]
      return v === null ? s : (s ?? 0) + v
    }, null),
  )
  const prev = totals.slice(Math.max(0, totals.length - days * 2), totals.length - days).filter((v): v is number => v !== null)
  const window = totals.slice(-days).filter((v): v is number => v !== null)
  const avg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : undefined
  const sum = window.reduce((a, b) => a + b, 0)
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm text-muted-foreground">Events by level</h2>
        <Mono className="text-xs text-faint">{days} days</Mono>
      </div>
      <div className="mt-2 mb-5">
        <span className="text-[28px] leading-none font-light tracking-[-0.02em] text-foreground tabular">{num(sum)}</span>
      </div>
      <LevelColumns series={series} releases={releases} days={days} previousAverage={avg} projectName={(id) => projectName(shell, id)} />
    </Card>
  )
}

export function ProjectsCard({ projects }: { projects: Project[] }) {
  const sorted = [...projects].sort((a, b) => healthRank[a.health] - healthRank[b.health] || b.events24h - a.events24h)
  return (
    <Card>
      <div className="flex items-baseline justify-between px-5 pt-5 pb-3">
        <h2 className="text-sm text-muted-foreground">Projects</h2>
        <Mono className="text-xs text-faint">events 24h</Mono>
      </div>
      <ul className="pb-2">
        {sorted.map((p) => (
          <li key={p.id}>
            <Link
              to={p.health === "awaiting_first_event" ? `/projects/${p.id}/settings` : `/issues?project=${p.id}`}
              className="flex items-center gap-3 px-5 py-2 transition-colors hover:bg-raised/60"
              title={healthLabel[p.health]}
            >
              <Square tone={healthTone[p.health]} hollow={p.health === "awaiting_first_event"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{p.name}</span>
                <span className="block truncate text-xs text-faint">
                  {p.health === "awaiting_first_event" ? "waiting for first event" : `${healthLabel[p.health].toLowerCase()} · ${ago(p.lastEventAt)}`}
                </span>
              </span>
              <Mono className="text-sm text-muted-foreground">{p.health === "awaiting_first_event" ? "—" : compact(p.events24h)}</Mono>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
