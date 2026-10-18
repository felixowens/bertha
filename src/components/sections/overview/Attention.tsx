import { ArrowRight } from "lucide-react"
import type { IssueSummary, Monitor, Project, Release } from "../../../contract/domain"
import { CellStrip, Legend, Ribbon, type Segment } from "@/components/charts/cells"
import { IssueLine } from "@/components/issues/IssueLine"
import { Button } from "@/components/ui/button"
import { Mono, Square } from "@/components/ui/primitives"
import { EmptyState } from "@/components/ui/states"
import { useShell, projectName } from "@/components/shell/ShellContext"
import { ago, since, version } from "@/lib/format"
import { healthLabel, healthRank, healthTone, monitorTone } from "@/lib/meaning"
import { Link, navigate } from "@/lib/router"
import type { ProjectHealth } from "../../../contract/domain"

const HEALTH: ProjectHealth[] = ["down", "regressed", "new_issues", "healthy", "awaiting_first_event"]

function MonitorLine({ m, project }: { m: Monitor; project: string }) {
  return (
    <li className="border-b border-hairline">
      <Link
        to={`/uptime/${m.id}`}
        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-4 sm:grid-cols-[112px_minmax(0,1fr)_auto_auto] md:gap-x-6"
      >
        <Mono className="col-span-full text-xs text-danger sm:col-span-1 sm:text-sm">down {since(m.since)}</Mono>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Square tone="danger" />
            <span className="truncate font-medium group-hover:underline group-hover:decoration-border group-hover:underline-offset-4">{m.name}</span>
            <span className="truncate text-muted-foreground">isn't responding</span>
          </div>
          <div className="mt-1 truncate text-sm text-faint">
            {project} <span className="font-mono text-xs">· {m.url.replace(/^https?:\/\//, "")}</span>
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

export function Attention({
  attention,
  monitorsDown,
  projects,
  releases,
  days,
}: {
  releases: Release[]
  attention: IssueSummary[]
  monitorsDown: Monitor[]
  projects: Project[]
  days: number
}) {
  const shell = useShell()
  const segments: Segment[] = HEALTH.map((h) => ({
    tone: healthTone[h],
    count: projects.filter((p) => p.health === h).length,
    label: healthLabel[h].toLowerCase(),
  }))
  const worst = [...projects].sort((a, b) => healthRank[a.health] - healthRank[b.health])[0]
  const total = attention.length + monitorsDown.length
  const firstIssue = attention[0]

  return (
    <section aria-labelledby="attention" className="min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="attention" className="text-base font-medium text-foreground">
            Needs attention
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0 ? (
              "Nothing new since yesterday."
            ) : (
              <>
                <Mono className="text-foreground">{total}</Mono> {total === 1 ? "thing" : "things"} across{" "}
                <Mono className="text-foreground">{projects.filter((p) => healthRank[p.health] < 3).length}</Mono> projects
              </>
            )}
          </p>
        </div>
        {firstIssue && (
          <Button variant="default" onClick={() => navigate("/issues?sort=last_seen")}>
            Start triage <ArrowRight />
          </Button>
        )}
      </div>

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

      {total === 0 ? (
        <>
          <EmptyState className="mt-10" title="All quiet.">
            No new issues, no regressions, every monitor up. bertha will email you if that changes.
          </EmptyState>
          {releases.length > 0 && <QuietDeploys releases={releases} />}
        </>
      ) : (
        <ul className="mt-6 border-t border-hairline">
          {monitorsDown.map((m) => (
            <MonitorLine key={m.id} m={m} project={projectName(shell, m.projectId)} />
          ))}
          {attention.map((i) => (
            <IssueLine key={i.id} issue={i} projectName={projectName(shell, i.projectId)} days={days} />
          ))}
        </ul>
      )}
      {total > 0 && (
        <Link to="/issues" className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
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
      <h3 className="text-sm text-muted-foreground">Shipped and held</h3>
      <ul className="mt-3 border-t border-hairline">
        {recent.map((r) => (
          <li key={r.id} className="border-b border-hairline">
            <Link to={`/releases/${r.id}`} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[112px_minmax(0,1fr)_auto]">
              <Mono className="col-span-full text-xs text-faint sm:col-span-1 sm:text-sm">{ago(r.deployedAt)}</Mono>
              <span className="min-w-0 truncate text-sm">
                <Mono className="text-foreground group-hover:underline group-hover:underline-offset-4" title={r.version}>{version(r.version)}</Mono>
                <span className="text-faint"> · {projectName(shell, r.projectId)}</span>
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Square tone="quiet" className="size-1.5" />
                <Mono className="text-foreground">{r.quietSinceDeploy}</Mono> fixes held
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
