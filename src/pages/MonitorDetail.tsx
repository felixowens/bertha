import { useState } from "react"
import { cn } from "cn"
import { ExternalLink, FileText, Pause, Play, Pencil, RefreshCw } from "lucide-react"
import type { Incident, UptimeCheck } from "../contract/domain"
import type { MonitorDetailPage } from "../contract/pages"
import { backend } from "@/data/backend"
import { usePageLoadable, type Ready } from "@/data/useLoadable"
import { TopBar } from "@/components/shell/TopBar"
import { useShell, isOwner } from "@/components/shell/ShellContext"
import { MonitorForm } from "@/components/uptime/MonitorForm"
import { Section } from "@/components/issue/EventPane"
import { CellColumns, Legend, Ribbon, type Column } from "@/components/charts/cells"
import { Button } from "@/components/ui/button"
import { Mono, Square, toneText } from "@/components/ui/primitives"
import { toast } from "@/components/ui/toast"
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states"
import { ago, day, duration, num, plural, since, stamp, time } from "@/lib/format"
import { monitorHint, monitorLabel, monitorTone } from "@/lib/meaning"
import { now } from "@/lib/clock"
import { Link, navigate } from "@/lib/router"
import { IssueLine } from "@/components/issues/IssueLine"
import { useLiveReload } from "@/data/live"

type Data = Ready<MonitorDetailPage>

/** Fixed 0–3s scale so normal hours stay visible beside a 7s spike; the tip has the real value. */
const CEILING = 3000

function ResponseTimes({ data }: { data: Data }) {
  const s = data.responseTimes
  const start = new Date(s.start).getTime()
  const vals = s.counts.filter((v): v is number => v !== null)
  const p50 = vals.length ? [...vals].sort((a, b) => a - b)[Math.floor(vals.length / 2)] : null
  const columns: Column[] = s.counts.map((v, i) => {
    const at = new Date(start + i * 36e5).toISOString()
    return {
      key: at,
      stack: v === null ? null : [{ tone: v >= 2000 ? "danger" : v >= 800 ? "warn" : "quiet", value: Math.min(v, CEILING) }],
      tip: (
        <div className="flex flex-col gap-1">
          <div className="text-faint">
            {day(at)} {time(at)}
          </div>
          <div className="text-foreground">
            {v === null ? (
              "No response (paused or down)"
            ) : (
              <>
                <Mono className="text-base">{num(v)}</Mono>ms average
              </>
            )}
          </div>
        </div>
      ),
    }
  })
  if (!s.counts.length) return <p className="text-sm text-faint">No checks yet.</p>
  return (
    <div>
      <CellColumns columns={columns} rows={10} height={112} floor={CEILING} average={p50 ? { value: p50, label: `Median ${p50}ms` } : undefined} />
      <div className="mt-2 flex justify-between font-mono text-2xs text-faint">
        <span>−{s.counts.length}h</span>
        <span>Now</span>
      </div>
      <p className="mt-1 text-2xs text-faint">Scale tops out at 3s; slower hours are clipped.</p>
      <Legend
        className="mt-3"
        items={[
          { tone: "quiet", label: "Under 800ms" },
          { tone: "warn", label: "Slow" },
          { tone: "danger", label: "2s and over" },
          ...(s.counts.some((v) => v === null) ? [{ tone: "void" as const, hollow: true, label: "No response" }] : []),
        ]}
      />
    </div>
  )
}

function IncidentRow({ i }: { i: Incident }) {
  const open = i.resolvedAt === null
  const end = open ? undefined : new Date(i.resolvedAt!).getTime()
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 border-b border-hairline py-3 last:border-b-0 sm:grid-cols-[148px_minmax(0,1fr)_auto]">
      <Mono className="text-xs text-faint sm:text-sm" title={stamp(i.startedAt)}>
        {stamp(i.startedAt)}
      </Mono>
      <div className="col-span-full row-start-2 min-w-0 text-sm text-muted-foreground sm:col-span-1 sm:row-start-auto">
        <span className={open ? "text-foreground" : undefined}>{i.cause}</span>
        <Mono className="ml-2 text-xs text-faint">{plural(i.failedChecks, "failed check")}</Mono>
      </div>
      <Mono className={cn("text-right text-sm", open ? "text-danger" : "text-muted-foreground")}>
        {open ? `ongoing ${since(i.startedAt)}` : duration(new Date(i.startedAt).getTime(), end)}
      </Mono>
    </li>
  )
}

function CheckRow({ c, repeat }: { c: UptimeCheck; repeat: boolean }) {
  return (
    <li className={cn("border-b border-hairline px-4 py-2 font-mono text-xs last:border-b-0", !c.ok && "bg-danger/5")}>
      <div className="grid grid-cols-[48px_minmax(0,1fr)_40px_56px] items-baseline gap-x-3">
        <span className="text-faint tabular">{time(c.at)}</span>
        <span className="truncate text-faint">{c.region}</span>
        <span className={c.ok ? "text-muted-foreground" : "text-danger"}>{c.httpStatus ?? "—"}</span>
        <span className="text-right text-muted-foreground tabular">{c.responseMs === null ? "—" : `${c.responseMs}ms`}</span>
      </div>
      {!c.ok && (
        <p className={cn("mt-1 line-clamp-2 pl-[60px] break-all", repeat ? "text-faint" : "text-foreground")} title={c.error ?? undefined}>
          {repeat ? "same as above" : (c.error ?? "Failed")}
        </p>
      )}
    </li>
  )
}

/** A run of passing checks, folded into one line: "24 ok checks, 14:02–14:25". */
function OkRun({ run }: { run: UptimeCheck[] }) {
  const [open, setOpen] = useState(false)
  if (open)
    return (
      <>
        {run.map((c, k) => (
          <CheckRow key={k} c={c} repeat={false} />
        ))}
      </>
    )
  const ms = run.flatMap((c) => (c.responseMs === null ? [] : [c.responseMs]))
  const avg = ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null
  return (
    <li className="border-b border-hairline last:border-b-0">
      <button
        onClick={() => setOpen(true)}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-4 py-2 text-left font-mono text-xs text-faint transition-colors hover:bg-raised/50 hover:text-muted-foreground"
      >
        <span className="truncate">
          <span className="text-muted-foreground">{plural(run.length, "ok check")}</span>, {time(run[run.length - 1].at)}–{time(run[0].at)}
        </span>
        <span className="tabular">{avg === null ? "" : `avg ${avg}ms`}</span>
      </button>
    </li>
  )
}

/** Newest first; passing runs of three or more fold up so failures stand out. */
function Checks({ checks }: { checks: UptimeCheck[] }) {
  const rows: React.ReactNode[] = []
  for (let k = 0; k < checks.length;) {
    const c = checks[k]
    if (c.ok) {
      let end = k
      while (end < checks.length && checks[end].ok) end++
      if (end - k >= 3) {
        rows.push(<OkRun key={k} run={checks.slice(k, end)} />)
        k = end
        continue
      }
    }
    rows.push(<CheckRow key={k} c={c} repeat={!c.ok && k > 0 && !checks[k - 1].ok && checks[k - 1].error === c.error} />)
    k++
  }
  return <ol className="overflow-hidden rounded-lg border border-hairline bg-card">{rows}</ol>
}

export function MonitorDetail({ monitorId }: { monitorId: string }) {
  const shell = useShell()
  const page = usePageLoadable<Data>("/uptime/:monitorId", () => backend.getMonitor(monitorId), [monitorId])
  const { state } = page
  useLiveReload(page.reload, (e) => e.kind === "monitor" && e.monitorId === monitorId, 300)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)
  const crumbs = [
    { label: "Uptime", to: "/uptime" },
    ...(state.status === "ready" ? [{ label: state.data.project.name, to: `/uptime?project=${state.data.project.id}` }] : []),
    { label: state.status === "ready" ? state.data.monitor.name : "…" },
  ]

  if (state.status === "loading")
    return (
      <>
        <TopBar crumbs={crumbs} />
        <div className="flex flex-col gap-4 p-4 md:p-6" aria-busy>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-72" />
          <Skeleton className="mt-4 h-28" />
          <Skeleton className="h-40" />
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
        <TopBar crumbs={[{ label: "Uptime", to: "/uptime" }, { label: "Not found" }]} />
        <EmptyState
          className="p-6 md:p-10"
          cells="void"
          title="No such monitor."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to="/uptime">All monitors</Link>
            </Button>
          }
        >
          It may have been deleted.
        </EmptyState>
      </>
    )

  const { monitor: m, project, checks, incidents } = state.data
  const tone = monitorTone[m.state]
  const openIncident = incidents.find((i) => i.resolvedAt === null)
  const lastFail = checks.find((c) => !c.ok)
  const today = incidents.filter((i) => i.startedAt.slice(0, 10) === new Date(now()).toISOString().slice(0, 10)).length
  const owner = isOwner(shell)

  const togglePause = async () => {
    setBusy(true)
    const paused = m.state !== "paused"
    const r = await backend.saveMonitor({ id: m.id, projectId: m.projectId, name: m.name, url: m.url, intervalSeconds: m.intervalSeconds as 60 | 300 | 900, paused })
    setBusy(false)
    if (r.ok) {
      toast({
        tone: "quiet",
        body: paused ? (
          <>
            Paused <span className="text-foreground">{m.name}</span>. No checks, no alerts.
          </>
        ) : (
          <>
            Resumed <span className="text-foreground">{m.name}</span>.
          </>
        ),
      })
      page.reload()
      shell.reload()
    } else toast({ tone: "danger", body: r.message })
  }

  const checkNow = async () => {
    setChecking(true)
    const r = await backend.checkMonitorNow(m.id)
    setChecking(false)
    if (!r.ok) return toast({ tone: "danger", body: r.message })
    const c = r.value
    toast(
      c.ok
        ? {
            tone: "ok",
            body: (
              <>
                Check passed: <Mono>{c.httpStatus}</Mono> in <Mono>{c.responseMs}ms</Mono>.
              </>
            ),
          }
        : { tone: "danger", body: <>Check failed: {c.error ?? `answered ${c.httpStatus}`}.</> },
    )
    page.reload()
    shell.reload()
  }

  const slow = m.latestResponseMs !== null && m.latestResponseMs >= 800
  const headline =
    m.state === "down"
      ? `Down for ${since(m.since)}`
      : m.state === "degraded"
        ? `Degraded for ${since(m.since)}: ${slow ? `answering slowly (${m.latestResponseMs}ms)` : today ? `${plural(today, "short outage")} today` : monitorHint.degraded.toLowerCase().replace(/\.$/, "")}`
        : m.state === "paused"
          ? `Paused ${ago(m.since)}`
          : `Up for ${since(m.since)}`

  return (
    <>
      <TopBar crumbs={crumbs}>
        {m.state !== "paused" && (
          <Button variant="outline" size="sm" disabled={checking} onClick={() => void checkNow()}>
            <RefreshCw className={cn(checking && "animate-spin")} /> {checking ? "Checking…" : "Check now"}
          </Button>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link to={`/uptime/${m.id}/report`}>
            <FileText /> Client report
          </Link>
        </Button>
        {owner && (
          <>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void togglePause()}>
              {m.state === "paused" ? <Play /> : <Pause />} {m.state === "paused" ? "Resume" : "Pause"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
          </>
        )}
      </TopBar>
      <header className="border-b border-hairline px-4 pt-5 pb-6 md:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
          <Link to={`/projects/${project.id}`} className="text-muted-foreground hover:text-foreground">
            {project.name}
          </Link>
          <a href={m.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 font-mono hover:text-foreground">
            <span className="truncate">{m.url}</span> <ExternalLink className="size-3 shrink-0" />
          </a>
          <Mono>every {m.intervalSeconds / 60}m</Mono>
        </div>
        <h1 className="text-xl text-foreground md:text-2xl">{m.name}</h1>
        <p className={cn("mt-2 flex items-center gap-2 font-mono text-sm", m.state === "up" ? "text-muted-foreground" : toneText[tone])}>
          <Square tone={tone} hollow={m.state === "paused"} />
          {headline}
        </p>

        <div className="mt-5 overflow-x-auto">
          <Ribbon states={m.recent.map((s) => (s ? monitorTone[s] : "void"))} cellClass="h-6 w-[6px] md:w-[8px]" label={`Last ${m.recent.length} checks`} />
          <div className="mt-1.5 flex justify-between font-mono text-2xs text-faint" style={{ maxWidth: m.recent.length * 10 }}>
            <span>{m.recent.length} checks ago</span>
            <span>now</span>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Fig k="Uptime, 30 days" v={`${m.uptime30d.toFixed(2)}%`} warn={m.uptime30d < 99} />
          <Fig k="Latest response" v={m.latestResponseMs === null ? "—" : `${m.latestResponseMs}ms`} />
          <Fig k="Incidents" v={String(incidents.length)} sub={incidents.length ? `last ${ago(incidents[0].startedAt)}` : "none on record"} />
          <Fig k="State" v={monitorLabel[m.state]} sub={`since ${stamp(m.since)}`} />
        </dl>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_420px]">
        <main className="flex min-w-0 flex-col gap-10 px-4 py-6 md:px-6 xl:border-r xl:border-hairline">
          {openIncident && (
            <section className="rounded-lg border border-danger/30 bg-danger/5 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">Open incident</h2>
                <Mono className="text-xs text-danger">started {stamp(openIncident.startedAt)}</Mono>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {openIncident.cause} · <Mono>{openIncident.failedChecks}</Mono> failed checks in a row
              </p>
              {lastFail?.error && (
                <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-hairline bg-sidebar p-3 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                  {lastFail.error}
                </pre>
              )}
              {state.data.relatedIssues.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs text-muted-foreground">Likely related: started or spiking since the outage began</h3>
                  <ul className="mt-1">
                    {state.data.relatedIssues.map((i) => (
                      <IssueLine key={i.id} issue={i} projectName={null} days={7} />
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-3 text-xs text-faint">
                {state.data.relatedIssues.length ? "Not it? " : "No errors line up with the outage. "}
                <Link to={`/issues?project=${project.id}&sort=last_seen`} className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
                  All recent issues in {project.name.length > 30 ? "this project" : project.name}
                </Link>
              </p>
            </section>
          )}
          <Section title="Response time" aside="hourly average">
            <ResponseTimes data={state.data} />
          </Section>
          <Section title="Incidents" aside={incidents.length ? `${incidents.length} on record` : undefined}>
            {incidents.length ? (
              <ul className="border-t border-hairline">
                {incidents.map((i) => (
                  <IncidentRow key={i.id} i={i} />
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-faint">
                <Square tone="quiet" /> No incidents on record.
              </p>
            )}
          </Section>
        </main>
        <aside className="min-w-0 border-t border-hairline px-4 py-6 md:px-6 xl:border-t-0">
          <Section title="Recent checks" aside={checks.length ? `newest first · last ${checks.slice(0, 40).length}` : undefined}>
            {checks.length ? <Checks checks={checks.slice(0, 40)} /> : <p className="text-sm text-faint">No checks yet.</p>}
          </Section>
        </aside>
      </div>
      {owner && (
        <MonitorForm
          key={String(editing)}
          open={editing}
          onOpenChange={setEditing}
          projects={shell.projects}
          initial={m}
          onSaved={() => {
            toast({
              tone: "quiet",
              body: (
                <>
                  Saved <span className="text-foreground">{m.name}</span>.
                </>
              ),
            })
            page.reload()
          }}
          onDeleted={() => {
            toast({
              tone: "quiet",
              body: (
                <>
                  Deleted <span className="text-foreground">{m.name}</span>. Its checks have stopped.
                </>
              ),
            })
            shell.reload()
            navigate("/uptime")
          }}
        />
      )}
    </>
  )
}

function Fig({ k, v, sub, warn }: { k: string; v: string; sub?: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-faint">{k}</dt>
      <dd className={cn("mt-1 text-[22px] leading-none font-light tracking-[-0.02em] tabular", warn ? "text-warn" : "text-foreground")}>{v}</dd>
      {sub && <dd className="mt-1.5 truncate font-mono text-xs text-faint">{sub}</dd>}
    </div>
  )
}
