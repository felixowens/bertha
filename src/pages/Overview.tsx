import type { TimeRange } from "../../packet/contract/domain"
import type { OverviewPage } from "../../packet/contract/pages"
import { backend, scenario } from "@/data/backend"
import { usePageLoadable, type Ready } from "@/data/useLoadable"
import { TopBar } from "@/components/shell/TopBar"
import { PillTabs } from "@/components/ui/primitives"
import { EmptyState, ErrorState } from "@/components/ui/states"
import { Button } from "@/components/ui/button"
import { KpiStrip } from "@/components/sections/overview/KpiStrip"
import { Attention } from "@/components/sections/overview/Attention"
import { EventsCard, ProjectsCard } from "@/components/sections/overview/SideColumn"
import { navigate, useLocation } from "@/lib/router"
import { useShell, isOwner } from "@/components/shell/ShellContext"
import { Skeleton as Sk } from "@/components/ui/states"
import { useLiveReload } from "@/data/live"

const RANGES: { value: TimeRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
]
const CHART_DAYS: Record<TimeRange, number> = { "24h": 14, "7d": 14, "30d": 30 }

export function Overview() {
  const { query } = useLocation()
  const shell = useShell()
  const range = ((query.get("range") ?? scenario.params.range) as TimeRange | undefined) ?? "7d"
  const { state, reload } = usePageLoadable<Ready<OverviewPage>>(
    "/",
    () => backend.getOverview(range),
    [range],
  )
  // Counts move with every event; a few seconds behind is fine here.
  useLiveReload(reload, (e) => e.kind === "ingested" || e.kind === "monitor", 5_000)
  const setRange = (r: TimeRange) => {
    const q = new URLSearchParams(query)
    if (r === "7d") q.delete("range")
    else q.set("range", r)
    const s = q.toString()
    navigate(`/${s ? `?${s}` : ""}`, { replace: true })
  }

  return (
    <>
      <TopBar crumbs={[{ label: "Overview" }]}>
        <PillTabs label="Time range" value={range} options={RANGES} onChange={setRange} />
      </TopBar>
      {state.status === "loading" && <OverviewSkeleton />}
      {state.status === "error" && <ErrorState className="p-6 md:p-10" message={state.message} onRetry={state.retryable ? reload : undefined} />}
      {state.status === "empty" && (
        <EmptyState className="p-6 md:p-10" cells="void" title="No projects yet." action={isOwner(shell) && <Button onClick={() => navigate("/projects/new")}>New project</Button>}>
          Add a project, paste its snippet, and errors show up here as they arrive.
        </EmptyState>
      )}
      {state.status === "ready" && <OverviewReady data={state.data} days={CHART_DAYS[range]} />}
    </>
  )
}

type Data = Ready<OverviewPage>

function OverviewReady({ data, days }: { data: Data; days: number }) {
  return (
    <div className="animate-in fade-in duration-150">
      <KpiStrip kpis={data.kpis} range={data.range} />
      <div className="grid gap-8 px-4 py-6 md:px-6 md:py-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Attention attention={data.attention} monitorsDown={data.monitorsDown} projects={data.projects} releases={data.releases} days={days} />
        <aside className="flex min-w-0 flex-col gap-4">
          <EventsCard series={data.events} releases={data.releases} days={days} />
          <ProjectsCard projects={data.projects} />
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
