import { useState } from "react"
import { cn } from "cn"
import { Plus } from "lucide-react"
import type { Monitor, MonitorState } from "../contract/domain"
import type { UptimePage } from "../contract/pages"
import { backend } from "@/data/backend"
import { usePageLoadable, type Ready } from "@/data/useLoadable"
import { TopBar } from "@/components/shell/TopBar"
import { useShell, isOwner } from "@/components/shell/ShellContext"
import { MonitorForm } from "@/components/uptime/MonitorForm"
import { Ribbon, Legend } from "@/components/charts/cells"
import { Button } from "@/components/ui/button"
import { Mono, Square, toneText } from "@/components/ui/primitives"
import { toast } from "@/components/ui/toast"
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states"
import { duration, since } from "@/lib/format"
import { monitorLabel, monitorTone } from "@/lib/meaning"
import { Link, useLocation } from "@/lib/router"
import { useLiveReload } from "@/data/live"

type Data = Ready<UptimePage>
const RANK: Record<MonitorState, number> = { down: 0, degraded: 1, up: 2, paused: 3 }
const GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 md:grid-cols-[136px_minmax(0,1fr)_auto_88px_72px] md:gap-x-6"

function readout(m: Monitor) {
  if (m.state === "down") return `down ${since(m.since)}`
  if (m.state === "degraded") return `degraded ${since(m.since)}`
  if (m.state === "paused") return "paused"
  return `up ${since(m.since)}`
}

function MonitorRow({ m, project }: { m: Monitor; project: string }) {
  const tone = monitorTone[m.state]
  return (
    <li className="border-b border-hairline last:border-b-0">
      <Link to={`/uptime/${m.id}`} className={cn(GRID, "group px-4 py-3.5 transition-colors hover:bg-raised/50 md:px-6")}>
        <Mono className={cn("col-span-full whitespace-nowrap text-xs md:col-span-1 md:text-sm", m.state === "up" ? "text-faint" : toneText[tone])}>{readout(m)}</Mono>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Square tone={tone} hollow={m.state === "paused"} />
            <span className="truncate font-medium text-foreground underline decoration-transparent underline-offset-4 transition-[color,text-decoration-color] duration-150 group-hover:decoration-border">
              {m.name}
            </span>
          </div>
          <div className="mt-0.5 truncate text-xs text-faint">
            {project} <span className="font-mono">· {m.url.replace(/^https?:\/\//, "")}</span>
          </div>
        </div>
        <div className="col-span-full hidden md:col-span-1 md:block">
          <Ribbon states={m.recent.map((s) => (s ? monitorTone[s] : "void"))} cellClass="h-[18px] w-[4px]" label={`Last ${m.recent.length} checks`} />
          <Mono className="mt-1 block text-2xs text-faint">
            last {m.recent.length} checks · {duration(0, m.recent.length * m.intervalSeconds * 1000)}
          </Mono>
        </div>
        <div className="text-right">
          <Mono className={cn("block text-sm", m.uptime30d < 99 ? "text-warn" : "text-foreground")}>{m.uptime30d.toFixed(2)}%</Mono>
          <Mono className="block text-xs text-faint">30 days</Mono>
        </div>
        <div className="hidden text-right md:block">
          <Mono className="block text-sm text-muted-foreground">{m.latestResponseMs === null ? "—" : `${m.latestResponseMs}ms`}</Mono>
          <Mono className="block text-xs text-faint">every {m.intervalSeconds < 60 ? `${m.intervalSeconds}s` : `${m.intervalSeconds / 60}m`}</Mono>
        </div>
      </Link>
    </li>
  )
}

export function Uptime() {
  const shell = useShell()
  const page = usePageLoadable<Data>(
    "/uptime",
    async () => {
      const r = await backend.listMonitors()
      return r.monitors.length ? r : null
    },
    [],
  )
  const { state } = page
  useLiveReload(page.reload, (e) => e.kind === "monitor", 300)
  const [adding, setAdding] = useState(false)
  const owner = isOwner(shell)
  const name = (id: string) => shell.projects.find((p) => p.id === id)?.name ?? "Unknown project"
  const { query } = useLocation()
  const only = shell.projects.find((p) => p.id === query.get("project")) ?? null

  const add = owner && (
    <Button size="sm" onClick={() => setAdding(true)}>
      <Plus /> Add monitor
    </Button>
  )

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
      <EmptyState className="p-6 md:p-10" title="No monitors." action={add}>
        Point bertha at a page or a health endpoint and it'll check it every minute, and tell you when it stops answering.
      </EmptyState>
    )
  else {
    const ms = [...state.data.monitors].filter((m) => !only || m.projectId === only.id).sort((a, b) => RANK[a.state] - RANK[b.state] || a.name.localeCompare(b.name))
    const count = (s: MonitorState) => ms.filter((m) => m.state === s).length
    const down = count("down")
    body = !ms.length ? (
      <EmptyState className="p-6 md:p-10" title={`No monitors for ${only?.name}.`} action={add}>
        Add one to check its site on a schedule.{" "}
        <Link to="/uptime" className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
          All monitors
        </Link>
      </EmptyState>
    ) : (
      <>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-hairline px-4 py-5 md:px-6">
          <p className="text-lg text-foreground">
            {down ? (
              <>
                <span className="text-danger">{down} down</span> <span className="text-muted-foreground">of {ms.length} monitors.</span>
              </>
            ) : (
              <>
                All {ms.length - count("paused")} answering<span className="text-muted-foreground">.</span>
              </>
            )}
          </p>
          <Legend
            items={(["down", "degraded", "up", "paused"] as MonitorState[]).filter(count).map((s) => ({
              tone: monitorTone[s],
              hollow: s === "paused",
              label: (
                <>
                  {monitorLabel[s]} <Mono className="text-faint">{count(s)}</Mono>
                </>
              ),
            }))}
          />
        </div>
        <div className={cn(GRID, "hidden border-b border-hairline px-6 py-2 text-xs text-faint md:grid")}>
          <span>State</span>
          <span>Monitor</span>
          <span>Recent checks</span>
          <span className="text-right">Uptime</span>
          <span className="text-right">Response</span>
        </div>
        <ul className="pb-16">
          {ms.map((m) => (
            <MonitorRow key={m.id} m={m} project={name(m.projectId)} />
          ))}
        </ul>
      </>
    )
  }

  return (
    <>
      <TopBar crumbs={only ? [{ label: "Projects", to: "/projects" }, { label: only.name, to: `/projects/${only.id}` }, { label: "Uptime" }] : [{ label: "Uptime" }]}>
        {state.status === "ready" && add}
      </TopBar>
      {body}
      {owner && (
        <MonitorForm
          key={String(adding)}
          open={adding}
          onOpenChange={setAdding}
          projects={only ? [only, ...shell.projects.filter((p) => p !== only)] : shell.projects}
          onSaved={(m) => {
            toast({
              tone: "quiet",
              body: (
                <>
                  Monitoring <span className="text-foreground">{m.name}</span>. First check passed.
                </>
              ),
            })
            page.reload()
            shell.reload()
          }}
        />
      )}
    </>
  )
}
