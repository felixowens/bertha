import { useEffect } from "react"
import { ArrowRight } from "lucide-react"
import { cn } from "cn"
import type { IssueSummary, Monitor, Project, ProjectHealth, Release, TimeRange } from "../../../contract/domain"
import { CellStrip, Legend, Ribbon, type Segment } from "@/components/charts/cells"
import { IssueLine } from "@/components/issues/IssueLine"
import { Button } from "@/components/ui/button"
import { Mono, Square, toneText } from "@/components/ui/primitives"
import { queueHref, saveQueue } from "@/components/issues/filters"
import { EmptyState } from "@/components/ui/states"
import { useShell, projectName } from "@/components/shell/ShellContext"
import { ago, since, version } from "@/lib/format"
import { healthLabel, healthRank, healthTone, monitorTone } from "@/lib/meaning"
import { Link, navigate } from "@/lib/router"

const HEALTH: ProjectHealth[] = ["down", "regressed", "new_issues", "healthy", "awaiting_first_event"]

function MonitorLine({ m, project }: { m: Monitor; project: string | null }) {
  const down = m.state === "down"
  const tone = monitorTone[m.state]
  return (
    <li className="border-b border-hairline">
      <Link to={`/uptime/${m.id}`} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-4 sm:grid-cols-[136px_minmax(0,1fr)_auto_auto] md:gap-x-6">
        <Mono className={cn("col-span-full whitespace-nowrap text-xs sm:col-span-1 sm:text-sm", toneText[tone])}>
          {down ? "down" : "degraded"} {since(m.since)}
        </Mono>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Square tone={tone} />
            <span className="truncate font-medium group-hover:underline group-hover:decoration-border group-hover:underline-offset-4">{m.name}</span>
            <span className="truncate text-muted-foreground">{down ? "isn't responding" : m.latestResponseMs !== null ? `is slow (${m.latestResponseMs}ms)` : "is slow"}</span>
          </div>
          <div className="mt-1 truncate text-sm text-faint">
            {project && <>{project} · </>}
            <span className="font-mono text-xs">{m.url.replace(/^https?:\/\//, "")}</span>
          </div>
        </div>
        <div className="text-right">
          <Mono className="block text-sm text-foreground">{m.uptime30d.toFixed(2)}%</Mono>
          <Mono className="block text-xs text-faint">30 days</Mono>
        </div>
        <div className="hidden sm:block">
          <Ribbon states={m.recent.slice(-24).map((s) => (s ? monitorTone[s] : "void"))} cellClass="h-[17px] w-[4px]" label="Last 24 checks" />
        </div>
      </Link>
    </li>
  )
}

const QUIET: Record<TimeRange, string> = {
  "24h": "Nothing new in the last 24 hours.",
  "7d": "Nothing new in the last 7 days.",
  "30d": "Nothing new in the last 30 days.",
}

export function Attention({
  attention,
  monitors,
  projects,
  releases,
  range,
  project,
}: {
  releases: Release[]
  attention: IssueSummary[]
  /** Down and degraded, worst first. */
  monitors: Monitor[]
  projects: Project[]
  range: TimeRange
  /** Set on a project's home: the health strip is the header's job there. */
  project: Project | null
}) {
  const shell = useShell()
  const segments: Segment[] = HEALTH.map((h) => ({
    tone: healthTone[h],
    count: projects.filter((p) => p.health === h).length,
    label: healthLabel[h].toLowerCase(),
  }))
  const worst = [...projects].sort((a, b) => healthRank[a.health] - healthRank[b.health])[0]
  const ms = [...monitors].sort((a, b) => (a.state === "down" ? 0 : 1) - (b.state === "down" ? 0 : 1) || a.since.localeCompare(b.since))
  const total = attention.length + ms.length
  const affected = new Set([...attention.map((i) => i.projectId), ...ms.map((m) => m.projectId)]).size

  // Opening an item from here steps through the rest with j and k, and Esc comes back here.
  const order = attention.map((i) => i.id).join(",")
  useEffect(() => {
    if (order) saveQueue({ ids: order.split(","), back: location.pathname + location.search })
  }, [order])

  return (
    <section aria-labelledby="attention" className="min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="attention" className="text-base font-medium text-foreground">
            Needs attention
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0 ? (
              QUIET[range]
            ) : (
              <>
                <Mono className="text-foreground">{total}</Mono> {total === 1 ? "thing" : "things"}
                {!project && (
                  <>
                    {" "}
                    across <Mono className="text-foreground">{affected}</Mono> {affected === 1 ? "project" : "projects"}
                  </>
                )}
              </>
            )}
          </p>
        </div>
        {attention.length > 0 && (
          <Button
            variant="default"
            onClick={() =>
              navigate(
                queueHref(
                  attention.map((i) => i.id),
                  range,
                ),
              )
            }
          >
            Start triage <ArrowRight />
          </Button>
        )}
      </div>

      {!project && projects.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Project health</span>
            {worst && healthRank[worst.health] < 3 && (
              <span className="text-faint">
                worst: <span className="text-foreground">{worst.name}</span>
              </span>
            )}
          </div>
          <CellStrip segments={segments} cells={Math.min(48, projects.length * 5)} />
          <Legend
            className="mt-3"
            items={segments
              .filter((s) => s.count > 0)
              .map((s) => ({
                tone: s.tone,
                hollow: s.tone === "void",
                label: (
                  <span>
                    {healthLabel[HEALTH[segments.indexOf(s)]]} <Mono className="text-foreground">{s.count}</Mono>
                  </span>
                ),
              }))}
          />
        </div>
      )}

      {total === 0 ? (
        <>
          <EmptyState className="mt-10" title="All quiet.">
            No new issues, no regressions, every monitor answering. bertha will email you if that changes.
          </EmptyState>
          {releases.length > 0 && <QuietDeploys releases={releases} />}
        </>
      ) : (
        <ul className="mt-6 border-t border-hairline">
          {ms.map((m) => (
            <MonitorLine key={m.id} m={m} project={project ? null : projectName(shell, m.projectId)} />
          ))}
          {attention.map((i) => (
            <IssueLine key={i.id} issue={i} projectName={project ? null : projectName(shell, i.projectId)} />
          ))}
        </ul>
      )}
      {total > 0 && (
        <Link
          to={project ? `/issues?project=${project.id}` : "/issues"}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          All unresolved issues <ArrowRight className="size-3.5" />
        </Link>
      )}
    </section>
  )
}

/** The calm state's reward: what shipped, and that it held. */
function QuietDeploys({ releases }: { releases: Release[] }) {
  const shell = useShell()
  const recent = [...releases].sort((a, b) => b.deployedAt.localeCompare(a.deployedAt)).slice(0, 5)
  return (
    <div className="mt-10">
      <h3 className="text-sm text-muted-foreground">Shipped and holding</h3>
      <ul className="mt-3 border-t border-hairline">
        {recent.map((r) => (
          <li key={r.id} className="border-b border-hairline">
            <Link to={`/releases/${r.id}`} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[136px_minmax(0,1fr)_auto]">
              <Mono className="col-span-full text-xs text-faint sm:col-span-1 sm:text-sm">{ago(r.deployedAt)}</Mono>
              <span className="min-w-0 truncate text-sm">
                <Mono className="text-foreground group-hover:underline group-hover:underline-offset-4" title={r.version}>
                  {version(r.version)}
                </Mono>
                <span className="text-faint"> · {projectName(shell, r.projectId)}</span>
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Square tone="ok" className="size-1.5" />
                <Mono className="text-foreground">{r.quietSinceDeploy}</Mono> {r.quietSinceDeploy === 1 ? "fix" : "fixes"} holding
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
