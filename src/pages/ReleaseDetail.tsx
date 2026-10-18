import type { ReleaseDetailPage } from "../contract/pages"
import type { IssueSummary } from "../contract/domain"
import { backend } from "@/data/backend"
import { usePageLoadable, type Ready } from "@/data/useLoadable"
import { TopBar } from "@/components/shell/TopBar"
import { CellColumns, Legend, type Column } from "@/components/charts/cells"
import { IssueLine } from "@/components/issues/IssueLine"
import { Section } from "@/components/issue/EventPane"
import { Button } from "@/components/ui/button"
import { Mono, Square } from "@/components/ui/primitives"
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states"
import { ago, duration, num, stamp, time, day, version } from "@/lib/format"
import { envShort } from "@/lib/meaning"
import { Link } from "@/lib/router"
import { useLiveReload } from "@/data/live"

type Data = Ready<ReleaseDetailPage>

function Around({ data }: { data: Data }) {
  const { around } = data
  const start = new Date(around.start).getTime()
  const deployAt = new Date(data.release.deployedAt).getTime()
  const split = Math.max(0, Math.min(around.counts.length, Math.round((deployAt - start) / 36e5)))
  const sum = (a: (number | null)[]) => a.reduce<number>((s, v) => s + (v ?? 0), 0)
  const before = sum(around.counts.slice(0, split))
  const after = sum(around.counts.slice(split))
  const afterTone = data.newIssues.length + data.regressedIssues.length ? "warn" : "fg"
  const columns: Column[] = around.counts.map((v, i) => {
    const at = new Date(start + i * 36e5).toISOString()
    return {
      key: at,
      stack: v === null ? null : [{ tone: i >= split ? afterTone : "quiet", value: v }],
      tip: (
        <div className="flex flex-col gap-1">
          <div className="text-faint">
            {day(at)} {time(at)}
          </div>
          <div className="text-foreground">{v === null ? "Nothing received" : <><Mono className="text-base">{num(v)}</Mono> events</>}</div>
          <div className="text-faint">{i >= split ? "after the deploy" : "before the deploy"}</div>
        </div>
      ),
    }
  })
  const pct = before === 0 ? null : Math.round((Math.abs(after - before) / before) * 100)
  const change = pct === null ? (after ? "from nothing" : "no change") : pct < 5 ? "about the same" : `${after >= before ? "+" : "−"}${pct}%`
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-6 sm:max-w-md">
        <div>
          <div className="text-xs text-faint">24h before</div>
          <div className="mt-1 text-[22px] leading-none font-light text-muted-foreground tabular">{num(before)}</div>
        </div>
        <div>
          <div className="text-xs text-faint">24h after</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[22px] leading-none font-light text-foreground tabular">{num(after)}</span>
            <Mono className={after > before * 1.2 ? "text-xs text-warn" : "text-xs text-faint"}>{change}</Mono>
          </div>
        </div>
      </div>
      <CellColumns columns={columns} rows={10} height={120} divider={{ index: split, label: version(data.release.version) }} floor={10} />
      <div className="mt-2 flex justify-between font-mono text-2xs text-faint">
        <span>−24h</span>
        <span>deploy · {time(data.release.deployedAt)}</span>
        <span>+24h</span>
      </div>
      <Legend
        className="mt-3"
        items={[
          { tone: "quiet", label: "Before" },
          { tone: afterTone, label: "After" },
        ]}
      />
    </div>
  )
}

function IssueGroup({ title, issues, projectName, tone, empty }: { title: string; issues: IssueSummary[]; projectName: string; tone: "warn" | "danger"; empty: string }) {
  return (
    <Section title={title} aside={issues.length ? <Mono className={tone === "danger" ? "text-danger" : "text-warn"}>{issues.length}</Mono> : undefined}>
      {issues.length ? (
        <ul className="border-t border-hairline">
          {issues.map((i) => (
            <IssueLine key={i.id} issue={i} projectName={projectName} />
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-sm text-faint">
          <Square tone="quiet" /> {empty}
        </p>
      )}
    </Section>
  )
}

export function ReleaseDetail({ releaseId }: { releaseId: string }) {
  const page = usePageLoadable<Data>("/releases/:releaseId", () => backend.getRelease(releaseId), [releaseId])
  const { state } = page
  const projectId = state.status === "ready" ? state.data.release.projectId : null
  useLiveReload(page.reload, (e) => e.kind === "ingested" && e.projectId === projectId, 5_000)
  const crumbs = [{ label: "Releases", to: "/releases" }, { label: state.status === "ready" ? version(state.data.release.version) : "…" }]

  if (state.status === "loading")
    return (
      <>
        <TopBar crumbs={crumbs} />
        <div className="flex flex-col gap-4 p-4 md:p-6" aria-busy>
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="mt-4 h-32" />
          <Skeleton className="h-16" />
        </div>
      </>
    )
  if (state.status === "error")
    return (
      <>
        <TopBar crumbs={crumbs} />
        <ErrorState className="p-6 md:p-10" message={state.message} onRetry={page.reload} />
      </>
    )
  if (state.status === "empty")
    return (
      <>
        <TopBar crumbs={[{ label: "Releases", to: "/releases" }, { label: "Not found" }]} />
        <EmptyState className="p-6 md:p-10" cells="void" title="No such release." action={<Button variant="outline" size="sm" asChild><Link to="/releases">All releases</Link></Button>}>
          It may belong to a project you don't have access to.
        </EmptyState>
      </>
    )

  const d = state.data
  const { release: r, project, previous } = d
  const broke = d.newIssues.length + d.regressedIssues.length
  return (
    <>
      <TopBar crumbs={crumbs} />
      <header className="border-b border-hairline px-4 pt-5 pb-6 md:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
          <Link to={`/releases?project=${project.id}`} className="text-muted-foreground hover:text-foreground">
            {project.name}
          </Link>
          <Mono className="rounded-[3px] border border-border px-1 text-muted-foreground">{envShort[r.environment]}</Mono>
          <Mono title={stamp(r.deployedAt)}>
            deployed {stamp(r.deployedAt)} · {ago(r.deployedAt)}
          </Mono>
        </div>
        <h1 className="font-mono text-xl text-foreground md:text-2xl" title={r.version}>{version(r.version)}</h1>
        <p className="mt-3 max-w-[72ch] text-sm text-pretty text-muted-foreground">
          {broke ? (
            <>
              <span className="text-foreground">This deploy {d.newIssues.length ? `introduced ${d.newIssues.length} new ${d.newIssues.length === 1 ? "issue" : "issues"}` : ""}{d.newIssues.length && d.regressedIssues.length ? " and " : ""}{d.regressedIssues.length ? `brought back ${d.regressedIssues.length} you had resolved` : ""}.</span>{" "}
              {r.quietSinceDeploy > 0 && <>{r.quietSinceDeploy} earlier fixes are holding.</>}
            </>
          ) : (
            <>
              <span className="text-foreground">Nothing new, nothing back.</span> {r.quietSinceDeploy > 0 ? `${r.quietSinceDeploy} fixes resolved before this deploy have stayed quiet since.` : "Events are where they were before it."}
            </>
          )}
        </p>
        <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:max-w-3xl">
          <div className="min-w-0">
            <dt className="text-xs text-faint">Commit</dt>
            <dd className="mt-1 min-w-0">
              {r.commit ? (
                <>
                  <span className="block truncate text-muted-foreground">{r.commit.message}</span>
                  <Mono className="text-xs text-faint">
                    {r.commit.sha.slice(0, 7)} · {r.commit.author}
                  </Mono>
                </>
              ) : (
                <span className="text-faint">Not sent with this deploy</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-faint">Previous {envShort[r.environment]} deploy</dt>
            <dd className="mt-1">
              {previous ? (
                <Link to={`/releases/${previous.id}`} className="font-mono text-muted-foreground hover:text-foreground">
                  {version(previous.version)}
                  <span className="text-xs text-faint"> · {duration(new Date(previous.deployedAt).getTime(), new Date(r.deployedAt).getTime())} earlier</span>
                </Link>
              ) : (
                <span className="text-faint">First deploy we saw</span>
              )}
            </dd>
          </div>
        </dl>
      </header>

      <div className="flex flex-col gap-10 px-4 py-6 pb-16 md:px-6">
        <Section title="Events around the deploy" aside="hourly">
          <Around data={d} />
        </Section>
        <IssueGroup title="New in this release" issues={d.newIssues} projectName={project.name} tone="warn" empty="No issues first seen in this release." />
        <IssueGroup title="Came back in this release" issues={d.regressedIssues} projectName={project.name} tone="danger" empty="Nothing you'd resolved came back." />
      </div>
    </>
  )
}
