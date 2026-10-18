import type { Release } from "../contract/domain"
import type { ReleasesPage } from "../contract/pages"
import { backend, scenario } from "@/data/backend"
import { scenarioState, useLoadable } from "@/data/useLoadable"
import { TopBar } from "@/components/shell/TopBar"
import { SelectFilter } from "@/components/issues/FilterBar"
import { ReleaseRow, RELEASE_GRID } from "@/components/releases/ReleaseRow"
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states"
import { Mono } from "@/components/ui/primitives"
import { date } from "@/lib/format"
import { navigate, useLocation } from "@/lib/router"
import { cn } from "cn"
import { useLiveReload } from "@/data/live"

type List = { releases: Release[]; projects: import("../contract/domain").Project[] }

/** Group by calendar day so a run of deploys reads as one moment. */
function byDay(rs: Release[]) {
  const out: { day: string; items: Release[] }[] = []
  for (const r of rs) {
    const d = date(r.deployedAt)
    const last = out.at(-1)
    if (last?.day === d) last.items.push(r)
    else out.push({ day: d, items: [r] })
  }
  return out
}

export function Releases() {
  const { query } = useLocation()
  const projectId = query.get("project") ?? scenario.params.projectId ?? null
  const live = useLoadable<List>(async () => {
    const r = await backend.listReleases(projectId)
    return r.releases.length ? r : null
  }, [projectId])
  useLiveReload(live.reload, (e) => e.kind === "ingested" && (!projectId || e.projectId === projectId), 5_000)
  const override = scenarioState<ReleasesPage>("/releases")?.list
  const state = override ?? live.state
  const projects = state.status === "ready" ? state.data.projects : []
  const name = (id: string) => projects.find((p) => p.id === id)?.name ?? "Unknown project"

  const setProject = (id: string) => {
    const q = new URLSearchParams(query)
    if (id === "all") q.delete("project")
    else q.set("project", id)
    const s = q.toString()
    navigate(`/releases${s ? `?${s}` : ""}`, { replace: true })
  }

  const rs = state.status === "ready" ? state.data.releases : []
  const broke = rs.filter((r) => r.newIssues || r.regressedIssues).length

  return (
    <>
      <TopBar crumbs={[{ label: "Releases" }]} />
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-3 md:px-6">
        <SelectFilter
          label="Project"
          value={projectId ?? "all"}
          quiet={!projectId}
          onChange={setProject}
          options={[{ value: "all", label: "All projects" }, ...(projects.length ? projects : []).map((p) => ({ value: p.id, label: p.name }))]}
        />
        {state.status === "ready" && (
          <span className="ml-auto text-xs text-faint">
            <Mono className="text-muted-foreground">{rs.length}</Mono> deploys · <Mono className={broke ? "text-warn" : "text-muted-foreground"}>{broke}</Mono> brought something new or back
          </span>
        )}
      </div>

      {state.status === "loading" && (
        <div className="flex flex-col gap-2 p-4 md:p-6" aria-busy>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      )}
      {state.status === "error" && <ErrorState className="p-6 md:p-10" message={state.message} onRetry={live.reload} />}
      {state.status === "empty" && (
        <EmptyState className="p-6 md:p-10" title="No deploys yet.">
          Deploys show up here when your app reports a release with its errors. Set the release in your error client to the version or commit you ship.
        </EmptyState>
      )}
      {state.status === "ready" && (
        <div className="pb-16">
          <div className={cn(RELEASE_GRID, "hidden border-b border-hairline px-6 py-2 text-xs text-faint md:grid")}>
            <span>Release</span>
            <span>Commit</span>
            <span>Since the deploy</span>
            <span className="text-right">Deployed</span>
          </div>
          {byDay(rs).map((g) => (
            <section key={g.day}>
              <h2 className="sticky top-14 z-10 border-b border-hairline bg-background/95 px-4 py-1.5 font-mono text-xs text-faint backdrop-blur md:px-6">{g.day}</h2>
              <ul>
                {g.items.map((r) => (
                  <ReleaseRow key={r.id} release={r} projectName={name(r.projectId)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
