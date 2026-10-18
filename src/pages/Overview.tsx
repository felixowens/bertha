import type { TimeRange } from "../contract/domain"
import type { OverviewPage } from "../contract/pages"
import { backend, scenario } from "@/data/backend"
import { usePageLoadable, type Ready } from "@/data/useLoadable"
import { TopBar } from "@/components/shell/TopBar"
import { PillTabs } from "@/components/ui/primitives"
import { EmptyState, ErrorState } from "@/components/ui/states"
import { Button } from "@/components/ui/button"
import { KpiStrip } from "@/components/sections/overview/KpiStrip"
import { Attention } from "@/components/sections/overview/Attention"
import { EventsCard, ProjectFacts, ProjectsCard } from "@/components/sections/overview/SideColumn"
import { navigate, useLocation } from "@/lib/router"
import { useShell, isOwner } from "@/components/shell/ShellContext"
import { Skeleton as Sk } from "@/components/ui/states"
import { useLiveReload } from "@/data/live"
import { ProjectHeader } from "@/components/projects/ProjectHeader"

export const RANGES: { value: TimeRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
]
/**
 * The morning check across every project, or, with `projectId`, that project's home:
 * the same sections limited to it, under its header and tabs.
 */
export function Overview({ projectId }: { projectId?: string }) {
  const { path, query } = useLocation()
  const shell = useShell()
  const range = ((query.get("range") ?? scenario.params.range) as TimeRange | undefined) ?? "7d"
  const { state, reload } = usePageLoadable<Ready<OverviewPage>>(projectId ? "/projects/:projectId" : "/", () => backend.getOverview(range, projectId ?? null), [range, projectId])
  // Counts move with every event; a few seconds behind is fine here.
  useLiveReload(reload, (e) => (e.kind === "ingested" || e.kind === "monitor") && (!projectId || e.projectId === projectId), 5_000)
  const setRange = (r: TimeRange) => {
    const q = new URLSearchParams(query)
    if (r === "7d") q.delete("range")
    else q.set("range", r)
    const s = q.toString()
    navigate(`${path}${s ? `?${s}` : ""}`, { replace: true })
  }
  const known = projectId ? shell.projects.find((p) => p.id === projectId) : undefined
  const crumbs = projectId ? [{ label: "Projects", to: "/projects" }, { label: known?.name ?? "Not found" }] : [{ label: "Overview" }]

  return (
    <>
      <TopBar crumbs={crumbs}>{(!projectId || known) && <PillTabs label="Time range" value={range} options={RANGES} onChange={setRange} />}</TopBar>
      {known && (
        <ProjectHeader
          project={state.status === "ready" && state.data.project ? state.data.project : known}
          active="overview"
          monitors={state.status === "ready" ? state.data.monitorsAttention : undefined}
        />
      )}
      {state.status === "loading" && <OverviewSkeleton />}
      {state.status === "error" && <ErrorState className="p-6 md:p-10" message={state.message} onRetry={state.retryable ? reload : undefined} />}
      {state.status === "empty" &&
        (projectId ? (
          <EmptyState
            className="p-6 md:p-10"
            cells="void"
            title="No such project."
            action={
              <Button variant="outline" size="sm" onClick={() => navigate("/projects")}>
                All projects
              </Button>
            }
          >
            It may have been deleted, or you don't have access to it.
          </EmptyState>
        ) : (
          <EmptyState
            className="p-6 md:p-10"
            cells="void"
            title="No projects yet."
            action={isOwner(shell) && <Button onClick={() => navigate("/projects/new")}>New project</Button>}
          >
            Add a project, paste its snippet, and errors show up here as they arrive.
          </EmptyState>
        ))}
      {state.status === "ready" && <OverviewReady data={state.data} />}
    </>
  )
}

type Data = Ready<OverviewPage>

const BUCKETS: Record<TimeRange, number> = { "24h": 24, "7d": 7, "30d": 30 }

function OverviewReady({ data }: { data: Data }) {
  const prevAvg = data.kpis.events.previous ? data.kpis.events.previous / BUCKETS[data.range] : undefined
  return (
    <div className="animate-in fade-in duration-150">
      <KpiStrip kpis={data.kpis} range={data.range} />
      <div className="grid gap-8 px-4 py-6 md:px-6 md:py-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Attention attention={data.attention} monitors={data.monitorsAttention} projects={data.projects} releases={data.releases} range={data.range} project={data.project} />
        <aside className="flex min-w-0 flex-col gap-4">
          <EventsCard series={data.events} releases={data.releases} range={data.range} previousAverage={prevAvg} />
          {data.project ? (
            <ProjectFacts project={data.project} events={data.projectEvents[data.project.id] ?? 0} range={data.range} />
          ) : (
            <ProjectsCard projects={data.projects} projectEvents={data.projectEvents} monitors={data.monitorsAttention} range={data.range} />
          )}
        </aside>
      </div>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div aria-busy>
      <div className="grid grid-cols-2 border-b border-hairline lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 px-4 py-6 md:px-6">
            <Sk className="size-4" />
            <Sk className="h-3 w-20" />
            <Sk className="h-8 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-8 px-4 py-8 md:px-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <Sk className="h-5 w-40" />
          <Sk className="h-3 w-full" />
          {Array.from({ length: 6 }, (_, i) => (
            <Sk key={i} className="h-12 w-full" />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <Sk className="h-72 w-full rounded-lg" />
          <Sk className="h-80 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
