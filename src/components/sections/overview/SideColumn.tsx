import { useState } from "react"
import { ArrowRight } from "lucide-react"
import { cn } from "cn"
import type { LevelSeries, Monitor, Project, Release, TimeRange } from "../../../contract/domain"
import { LevelColumns } from "@/components/charts/LevelColumns"
import { Card, Mono, Square, toneText } from "@/components/ui/primitives"
import { useShell, projectName } from "@/components/shell/ShellContext"
import { healthReadout } from "@/components/projects/ProjectHeader"
import { ago, compact, num } from "@/lib/format"
import { healthRank, healthTone, runtimeLabel } from "@/lib/meaning"
import { Link } from "@/lib/router"
import { Markdown } from "@/lib/markdown"

export const RANGE_LABEL: Record<TimeRange, string> = { "24h": "24 hours", "7d": "7 days", "30d": "30 days" }

export function EventsCard({ series, releases, range, previousAverage }: { series: LevelSeries; releases: Release[]; range: TimeRange; previousAverage?: number }) {
  const shell = useShell()
  const total = (["fatal", "error", "warning"] as const).reduce((s, l) => s + series.byLevel[l].reduce<number>((a, v) => a + (v ?? 0), 0), 0)
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm text-muted-foreground">Events by level</h2>
        <Mono className="text-xs text-faint">
          {RANGE_LABEL[range]}, {series.bucket === "hour" ? "hourly" : "daily"}
        </Mono>
      </div>
      <div className="mt-2 mb-5">
        <span className="text-[28px] leading-none font-light tracking-[-0.02em] text-foreground tabular">{num(total)}</span>
      </div>
      <LevelColumns series={series} releases={releases} previousAverage={previousAverage} projectName={(id) => projectName(shell, id)} />
    </Card>
  )
}

export function ProjectsCard({ projects, projectEvents, monitors, range }: { projects: Project[]; projectEvents: Record<string, number>; monitors: Monitor[]; range: TimeRange }) {
  const events = (p: Project) => projectEvents[p.id] ?? 0
  const sorted = [...projects].sort((a, b) => healthRank[a.health] - healthRank[b.health] || events(b) - events(a))
  return (
    <Card>
      <div className="flex items-baseline justify-between px-5 pt-5 pb-3">
        <h2 className="text-sm text-muted-foreground">Projects</h2>
        <Mono className="text-xs text-faint">events, {RANGE_LABEL[range]}</Mono>
      </div>
      <ul>
        {sorted.map((p) => {
          const waiting = p.health === "awaiting_first_event"
          return (
            <li key={p.id}>
              <Link to={`/projects/${p.id}`} className="flex items-center gap-3 px-5 py-2 transition-colors hover:bg-raised/60">
                <Square tone={healthTone[p.health]} hollow={waiting} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{p.name}</span>
                  <Mono className={cn("block truncate text-xs", p.health === "healthy" || waiting ? "text-faint" : toneText[healthTone[p.health]])}>
                    {healthReadout(p, monitors)}
                  </Mono>
                  <span className="block truncate text-xs text-faint">{p.lastEventAt ? `last event ${ago(p.lastEventAt)}` : "no events yet"}</span>
                </span>
                <Mono className="text-sm text-muted-foreground">{waiting ? "—" : compact(events(p))}</Mono>
              </Link>
            </li>
          )
        })}
      </ul>
      <Link to="/projects" className="flex items-center gap-1.5 border-t border-hairline px-5 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground">
        All projects <ArrowRight className="size-3" />
      </Link>
    </Card>
  )
}

/** On a project's home, in place of the project list: what it is and where it runs. */
export function ProjectFacts({ project: p, events, range }: { project: Project; events: number; range: TimeRange }) {
  const rows: [string, React.ReactNode][] = [
    [`Events, ${RANGE_LABEL[range]}`, <Mono key="e">{num(events)}</Mono>],
    [
      "Unresolved",
      <Link key="u" to={`/issues?project=${p.id}`} className="font-mono underline-fade">
        {num(p.unresolvedIssues)}
      </Link>,
    ],
    [
      "Monitors",
      <Link key="m" to={`/uptime?project=${p.id}`} className="font-mono underline-fade">
        {p.monitorIds.length || "none"}
      </Link>,
    ],
    ["Runs on", p.runtimes.map((r) => runtimeLabel[r]).join(", ") || "—"],
    ["Environments", <Mono key="env">{p.environments.join(", ") || "—"}</Mono>],
  ]
  return (
    <Card className="p-5">
      <h2 className="text-sm text-muted-foreground">About this project</h2>
      <dl className="mt-3 flex flex-col">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 border-b border-hairline py-2 text-sm last:border-b-0">
            <dt className="text-faint">{k}</dt>
            <dd className="truncate text-right text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <Link to={`/projects/${p.id}/settings`} className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
        Settings, keys and setup <ArrowRight className="size-3" />
      </Link>
    </Card>
  )
}

/** What anyone triaging this project should know, as the owner wrote it. Long ones fold. */
export function ProjectBrief({ project: p, brief }: { project: Project; brief: string }) {
  const long = brief.length > 600 || brief.split("\n").length > 12
  const [open, setOpen] = useState(!long)
  return (
    <Card className="p-5">
      <h2 className="text-sm text-muted-foreground">Brief</h2>
      <div className={cn("relative mt-3 text-sm text-muted-foreground", !open && "max-h-48 overflow-hidden")}>
        <Markdown source={brief} repoUrl={p.repoUrl} />
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs">
        {long && (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-muted-foreground underline-fade hover:text-foreground">
            {open ? "Show less" : "Show all"}
          </button>
        )}
        <Link to={`/projects/${p.id}/settings#brief`} className="text-faint transition-colors hover:text-foreground">
          Agents read this with every issue
        </Link>
      </div>
    </Card>
  )
}
