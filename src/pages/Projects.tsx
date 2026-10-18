import { cn } from "cn"
import { Plus } from "lucide-react"
import type { Project, TimeRange } from "../contract/domain"
import type { ProjectsPage } from "../contract/pages"
import { backend } from "@/data/backend"
import { usePageLoadable, type Ready } from "@/data/useLoadable"
import { useLiveReload } from "@/data/live"
import { TopBar } from "@/components/shell/TopBar"
import { useShell, isOwner } from "@/components/shell/ShellContext"
import { healthReadout } from "@/components/projects/ProjectHeader"
import { RANGE_LABEL } from "@/components/sections/overview/SideColumn"
import { Legend } from "@/components/charts/cells"
import { Button } from "@/components/ui/button"
import { Mono, PillTabs, Square, toneText } from "@/components/ui/primitives"
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states"
import { ago, compact } from "@/lib/format"
import { healthLabel, healthTone } from "@/lib/meaning"
import { Link, navigate, useLocation } from "@/lib/router"
import { RANGES } from "@/pages/Overview"

type Data = Ready<ProjectsPage>
const GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 md:grid-cols-[minmax(0,1fr)_150px_88px_88px_80px_112px] md:gap-x-6"

function ProjectRow({ p, data, range }: { p: Project; data: Data; range: TimeRange }) {
  const waiting = p.health === "awaiting_first_event"
  const tone = healthTone[p.health]
  const monitors = data.monitors.filter((m) => m.projectId === p.id)
  return (
    <li className="border-b border-hairline last:border-b-0">
      <Link to={`/projects/${p.id}`} className={cn(GRID, "group px-4 py-3.5 transition-colors hover:bg-raised/50 md:px-6")}>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Square tone={tone} hollow={waiting} />
            <span className="truncate font-medium text-foreground underline decoration-transparent underline-offset-4 transition-[color,text-decoration-color] duration-150 group-hover:decoration-border">
              {p.name}
            </span>
            <Mono className="shrink-0 text-xs text-faint">{p.key}</Mono>
          </div>
          <div className="mt-0.5 truncate text-xs text-faint">{p.client ?? "Personal project"}</div>
        </div>
        <Mono className={cn("text-right text-xs md:text-left md:text-sm", p.health === "healthy" || waiting ? "text-faint" : toneText[tone])}>
          {healthReadout(p, data.monitors)}
        </Mono>
        <Mono className="hidden text-right text-sm text-foreground md:block">{p.unresolvedIssues ? compact(p.unresolvedIssues) : <span className="text-faint">0</span>}</Mono>
        <Mono className="hidden text-right text-sm text-muted-foreground md:block" title={`Events, ${RANGE_LABEL[range]}`}>
          {waiting ? "—" : compact(data.projectEvents[p.id] ?? 0)}
        </Mono>
        <Mono className="hidden text-right text-sm text-muted-foreground md:block">{monitors.length || <span className="text-faint">none</span>}</Mono>
        <Mono className="col-span-full text-xs whitespace-nowrap text-faint md:col-span-1 md:text-right">
          {p.lastEventAt ? (
            <>
              <span className="md:hidden">last event </span>
              {ago(p.lastEventAt)}
            </>
          ) : (
            "no events yet"
          )}
        </Mono>
      </Link>
    </li>
  )
}

/** Every project, worst first: the way into a project's home and its settings. */
export function Projects() {
  const shell = useShell()
  const { query } = useLocation()
  const range = (query.get("range") as TimeRange | null) ?? "7d"
  const page = usePageLoadable<Data>(
    "/projects",
    async () => {
      const r = await backend.listProjects(range)
      return r.projects.length ? r : null
    },
    [range],
  )
  const { state } = page
  useLiveReload(page.reload, (e) => e.kind === "ingested" || e.kind === "monitor", 5_000)
  const owner = isOwner(shell)
  const add = owner && (
    <Button size="sm" onClick={() => navigate("/projects/new")}>
      <Plus /> New project
    </Button>
  )
  const setRange = (r: TimeRange) => navigate(r === "7d" ? "/projects" : `/projects?range=${r}`, { replace: true })

  let body
  if (state.status === "loading")
    body = (
      <div className="flex flex-col gap-2 p-4 md:p-6" aria-busy>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    )
  else if (state.status === "error") body = <ErrorState className="p-6 md:p-10" message={state.message} onRetry={page.reload} />
  else if (state.status === "empty")
    body = (
      <EmptyState className="p-6 md:p-10" cells="void" title="No projects yet." action={add}>
        {owner ? "Add a project, paste its snippet, and errors show up as they arrive." : "The owner hasn't given you any projects yet."}
      </EmptyState>
    )
  else {
    const d = state.data
    const counts = (["down", "regressed", "new_issues", "healthy", "awaiting_first_event"] as const)
      .map((h) => ({ h, n: d.projects.filter((p) => p.health === h).length }))
      .filter((x) => x.n)
    body = (
      <>
        <div className="border-b border-hairline px-4 py-5 md:px-6">
          <Legend
            items={counts.map(({ h, n }) => ({
              tone: healthTone[h],
              hollow: h === "awaiting_first_event",
              label: (
                <>
                  {healthLabel[h]} <Mono className="text-foreground">{n}</Mono>
                </>
              ),
            }))}
          />
        </div>
        <div className={cn(GRID, "hidden border-b border-hairline px-6 py-2 text-xs text-faint md:grid")}>
          <span>Project</span>
          <span>State</span>
          <span className="text-right">Unresolved</span>
          <span className="text-right">Events {range}</span>
          <span className="text-right">Monitors</span>
          <span className="text-right">Last event</span>
        </div>
        <ul className="pb-16">
          {d.projects.map((p) => (
            <ProjectRow key={p.id} p={p} data={d} range={range} />
          ))}
        </ul>
      </>
    )
  }

  return (
    <>
      <TopBar crumbs={[{ label: "Projects" }]}>
        {state.status === "ready" && <PillTabs label="Time range" value={range} options={RANGES} onChange={setRange} />}
        {state.status === "ready" && add}
      </TopBar>
      {body}
    </>
  )
}
