import type { ReleaseDetailPage } from "../contract/pages"
import type { IssueSummary } from "../contract/domain"
import { backend } from "@/data/backend"
import { usePageLoadable, type Ready } from "@/data/useLoadable"
import { TopBar, type Crumb } from "@/components/shell/TopBar"
import { CellColumns, Legend, type Column } from "@/components/charts/cells"
import { IssueLine } from "@/components/issues/IssueLine"
import { Section } from "@/components/issue/EventPane"
import { Button } from "@/components/ui/button"
import { Mono, Square, toneText } from "@/components/ui/primitives"
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states"
import { ago, duration, num, plural, stamp, time, day, version } from "@/lib/format"
import { envShort } from "@/lib/meaning"
import { Link } from "@/lib/router"
import { arrived } from "@/components/releases/ReleaseRow"
import { useLiveReload } from "@/data/live"

type Data = Ready<ReleaseDetailPage>

function Around({ data }: { data: Data }) {
  const { around } = data
  const start = new Date(around.start).getTime()
  const deployAt = new Date(data.release.deployedAt).getTime()
  const split = Math.max(0, Math.min(around.counts.length, Math.round((deployAt - start) / 36e5)))
  const sum = (a: (number | null)[]) => a.reduce<number>((s, v) => s + (v ?? 0), 0)
  // Compare equal windows: a deploy 9h old is measured against the 9h before it.
  const hours = Math.max(0, Math.min(data.afterHours, 24, split))
  const before = sum(around.counts.slice(split - hours, split))
  const after = sum(around.counts.slice(split, split + hours))
  const partial = hours < 24
  const columns: Column[] = around.counts.map((v, i) => {
    const at = new Date(start + i * 36e5).toISOString()
    return {
      key: at,
      stack: v === null ? null : [{ tone: i >= split ? "fg" : "quiet", value: v }],
      tip: (
        <div className="flex flex-col gap-1">
          <div className="text-faint">
            {day(at)} {time(at)}
          </div>
          <div className="text-foreground">
            {v === null ? (
              i >= split ? (
                "Still to come"
              ) : (
                "Nothing received"
              )
            ) : (
              <>
                <Mono className="text-base">{num(v)}</Mono> events
              </>
            )}
          </div>
          <div className="text-faint">{i >= split ? "after the deploy" : "before the deploy"}</div>
        </div>
      ),
    }
  })
  const pct = before === 0 ? null : Math.round((Math.abs(after - before) / before) * 100)
  const change = pct === null ? (after ? "from nothing" : "no change") : pct < 5 ? "about the same" : `${after >= before ? "+" : "−"}${pct}%`
  return (
    <div>
      {hours === 0 ? (
        <p className="mb-4 text-sm text-faint">
          {data.release.source === "deploy" ? "Deployed" : "First seen"} under an hour ago. The comparison starts once a full hour has passed.
        </p>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-6 sm:max-w-md">
          <div>
            <div className="text-xs text-faint">
              <Mono>{hours}h</Mono> before
            </div>
            <div className="mt-1 text-[22px] leading-none font-light text-muted-foreground tabular">{num(before)}</div>
          </div>
          <div>
            <div className="text-xs text-faint">
              <Mono>{hours}h</Mono> after{partial && " (so far)"}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[22px] leading-none font-light text-foreground tabular">{num(after)}</span>
              <Mono className={after > before * 1.2 ? "text-xs text-warn" : after < before * 0.8 ? "text-xs text-ok" : "text-xs text-faint"}>{change}</Mono>
            </div>
          </div>
        </div>
      )}
      <CellColumns columns={columns} rows={10} height={120} divider={{ index: split, label: version(data.release.version) }} floor={10} />
      <div className="mt-2 flex justify-between font-mono text-2xs text-faint">
        <span>−24h</span>
        <span>
          {data.release.source === "deploy" ? "deploy" : "first seen"} · {time(data.release.deployedAt)}
        </span>
        <span>+24h</span>
      </div>
      <Legend
        className="mt-3"
        items={[
          { tone: "quiet", label: "Before" },
          { tone: "fg", label: partial ? `After (${hours}h so far)` : "After" },
        ]}
      />
    </div>
  )
}

function IssueGroup({ title, issues, tone, empty, hint }: { title: string; issues: IssueSummary[]; tone: "warn" | "danger" | "ok"; empty: string; hint?: string }) {
  return (
    <Section title={title} aside={issues.length ? <Mono className={toneText[tone]}>{issues.length}</Mono> : undefined}>
      {hint && issues.length > 0 && <p className="-mt-1 mb-3 text-xs text-faint">{hint}</p>}
      {issues.length ? (
        <ul className="border-t border-hairline">
          {issues.map((i) => (
            <IssueLine key={i.id} issue={i} projectName={null} />
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
  const crumbs: Crumb[] =
    state.status === "ready"
      ? [
          { label: "Releases", to: "/releases" },
          { label: state.data.project.name, to: `/releases?project=${state.data.project.id}` },
          { label: version(state.data.release.version), mono: true },
        ]
      : [{ label: "Releases", to: "/releases" }, { label: "…" }]

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
        <EmptyState
          className="p-6 md:p-10"
          cells="void"
          title="No such release."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to="/releases">All releases</Link>
            </Button>
          }
        >
          It may belong to a project you don't have access to.
        </EmptyState>
      </>
    )

  const d = state.data
  const { release: r, project, previous, next } = d
  const commitUrl = r.commit && project.repoUrl ? `${project.repoUrl.replace(/\/+$/, "")}/commit/${r.commit.sha}` : null
  const broke = d.newIssues.length + d.regressedIssues.length
  const noun = r.source === "deploy" ? "deploy" : "release"
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
            {arrived[r.source]} {stamp(r.deployedAt)} · {ago(r.deployedAt)}
          </Mono>
        </div>
        <h1 className="font-mono text-xl text-foreground md:text-2xl" title={r.version}>
          {version(r.version)}
        </h1>
        <p className="mt-3 max-w-[72ch] text-sm text-pretty text-muted-foreground">
          {broke ? (
            <>
              <span className="text-foreground">
                This {noun} {d.newIssues.length ? `introduced ${d.newIssues.length} new ${d.newIssues.length === 1 ? "issue" : "issues"}` : ""}
                {d.newIssues.length && d.regressedIssues.length ? " and " : ""}
                {d.regressedIssues.length ? `brought back ${d.regressedIssues.length} you had resolved` : ""}.
              </span>{" "}
              {r.quietSinceDeploy > 0 && <>{plural(r.quietSinceDeploy, "earlier fix", "earlier fixes")} holding.</>}
            </>
          ) : (
            <>
              <span className="text-foreground">Nothing new, nothing back.</span>{" "}
              {r.quietSinceDeploy > 0
                ? `${plural(r.quietSinceDeploy, "fix", "fixes")} holding: resolved before this ${noun} and quiet since.`
                : "Events are where they were before it."}
            </>
          )}
        </p>
        {r.source !== "deploy" && (
          <p className="mt-2 max-w-[72ch] text-sm text-pretty text-faint">
            No deploy was recorded for this release. bertha {r.source === "event" ? "first saw it in an event" : "first heard from a process running it"} at{" "}
            <Mono>{stamp(r.deployedAt)}</Mono>, so it went out then or earlier. Record deploys with <Mono>bertha deploy</Mono> in CI, or <Mono>withBertha</Mono> on Vercel.
          </p>
        )}
        <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3 lg:max-w-4xl">
          <div className="min-w-0">
            <dt className="text-xs text-faint">Commit</dt>
            <dd className="mt-1 min-w-0">
              {r.commit ? (
                <>
                  <span className="block truncate text-muted-foreground">{r.commit.message || <span className="text-faint">No message recorded</span>}</span>
                  <Mono className="text-xs text-faint">
                    {commitUrl ? (
                      <a href={commitUrl} target="_blank" rel="noreferrer" className="text-muted-foreground underline-fade hover:text-foreground">
                        {r.commit.sha.slice(0, 7)}
                      </a>
                    ) : (
                      r.commit.sha.slice(0, 7)
                    )}
                    {r.commit.author && ` · ${r.commit.author}`}
                  </Mono>
                </>
              ) : (
                <span className="text-faint">{r.source === "deploy" ? "Not sent with this deploy" : "Not recorded"}</span>
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
          <div>
            <dt className="text-xs text-faint">Next {envShort[r.environment]} deploy</dt>
            <dd className="mt-1">
              {next ? (
                <Link to={`/releases/${next.id}`} className="font-mono text-muted-foreground hover:text-foreground">
                  {version(next.version)}
                  <span className="text-xs text-faint"> · {duration(new Date(r.deployedAt).getTime(), new Date(next.deployedAt).getTime())} later</span>
                </Link>
              ) : (
                <span className="text-faint">This is the latest</span>
              )}
            </dd>
          </div>
        </dl>
      </header>

      <div className="flex flex-col gap-10 px-4 py-6 pb-16 md:px-6">
        <Section title={`Events around the ${noun}`} aside="hourly">
          <Around data={d} />
        </Section>
        <IssueGroup title="New in this release" issues={d.newIssues} tone="warn" empty="No issues first seen in this release." />
        <IssueGroup title="Came back in this release" issues={d.regressedIssues} tone="danger" empty="Nothing you'd resolved came back." />
        <IssueGroup
          title="Fixes holding"
          issues={d.heldFixes}

          tone="ok"
          hint={`Resolved before this ${noun}, and no events since.`}
          empty="No earlier fixes to check yet."
        />
      </div>
    </>
  )
}
