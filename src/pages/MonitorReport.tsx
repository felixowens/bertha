import { ArrowLeft, Download, Printer } from "lucide-react"
import { cn } from "cn"
import type { MonitorDetailPage } from "../contract/pages"
import { backend } from "@/data/backend"
import { usePageLoadable, type Ready } from "@/data/useLoadable"
import { Legend } from "@/components/charts/cells"
import { Button } from "@/components/ui/button"
import { Mono, toneBg, type Tone } from "@/components/ui/primitives"
import { EmptyState, ErrorState, LoadingCells } from "@/components/ui/states"
import { Wordmark } from "@/components/shell/Wordmark"
import { date, duration, plural, stamp } from "@/lib/format"
import { now } from "@/lib/clock"
import { Link } from "@/lib/router"

type Data = Ready<MonitorDetailPage>
const DAY = 864e5

/** 100% is fine, a few minutes off is worth a look, more is a bad day. */
function dayTone(v: number | null): Tone | null {
  if (v === null) return null
  return v >= 99.95 ? "ok" : v >= 99 ? "warn" : "danger"
}

function days(d: Data) {
  const start = new Date(d.uptimeByDay.start).getTime()
  return d.uptimeByDay.counts.map((v, i) => ({ at: new Date(start + i * DAY).toISOString(), v }))
}

function csv(d: Data): string {
  const rows = [["date", "uptime_percent"], ...days(d).map(({ at, v }) => [at.slice(0, 10), v === null ? "" : v.toFixed(3)])]
  const incidents = d.incidents
    .filter((i) => new Date(i.startedAt).getTime() >= new Date(d.uptimeByDay.start).getTime())
    .map((i) => [i.startedAt, i.resolvedAt ?? "", `"${i.cause.replace(/"/g, '""')}"`, String(i.failedChecks)])
  return [...rows.map((r) => r.join(",")), "", "incident_started,incident_resolved,cause,failed_checks", ...incidents.map((r) => r.join(","))].join("\n")
}

function download(d: Data) {
  const url = URL.createObjectURL(new Blob([csv(d)], { type: "text/csv" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `${d.monitor.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-uptime-${new Date(now()).toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** A page to hand a client: 90 days of uptime by day, and every incident in that time. */
export function MonitorReport({ monitorId }: { monitorId: string }) {
  const page = usePageLoadable<Data>("/uptime/:monitorId/report", () => backend.getMonitor(monitorId), [monitorId])
  const { state } = page
  const back = (
    <Link to={`/uptime/${monitorId}`} className="flex items-center gap-1 text-xs text-faint transition-colors hover:text-foreground">
      <ArrowLeft className="size-3.5" /> Back to the monitor
    </Link>
  )

  if (state.status === "loading")
    return (
      <main className="grid min-h-svh place-items-center bg-background">
        <LoadingCells label="Loading the report" />
      </main>
    )
  if (state.status === "error")
    return (
      <main className="min-h-svh bg-background p-6 md:p-10">
        <ErrorState message={state.message} onRetry={page.reload} />
      </main>
    )
  if (state.status === "empty")
    return (
      <main className="min-h-svh bg-background p-6 md:p-10">
        <EmptyState
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
      </main>
    )

  const d = state.data
  const { monitor: m, project } = d
  const all = days(d)
  const measured = all.filter((x) => x.v !== null) as { at: string; v: number }[]
  const overall = measured.length ? measured.reduce((s, x) => s + x.v, 0) / measured.length : null
  const from = new Date(d.uptimeByDay.start).getTime()
  const incidents = d.incidents.filter((i) => new Date(i.startedAt).getTime() >= from)
  const downMs = incidents.reduce((s, i) => s + ((i.resolvedAt ? new Date(i.resolvedAt).getTime() : now()) - new Date(i.startedAt).getTime()), 0)
  const perfect = measured.filter((x) => dayTone(x.v) === "ok").length

  return (
    <main className="min-h-svh bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3 md:px-6 print:hidden">
        {back}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => download(d)}>
            <Download /> CSV
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer /> Print or save as PDF
          </Button>
        </div>
      </div>

      <article className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 md:px-6">
        <header className="flex flex-col gap-2">
          <div className="text-xs text-faint">
            Uptime report
            {project.client && (
              <>
                {" "}
                for <span className="text-muted-foreground">{project.client}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl text-foreground">{m.name}</h1>
          <div className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            <span>{project.name}</span>
            <Mono className="text-faint">{m.url}</Mono>
          </div>
          <Mono className="text-xs text-faint">
            {date(all[0]?.at ?? d.uptimeByDay.start)} – {date(new Date(now()).toISOString())} · checked every {duration(0, m.intervalSeconds * 1000)}
          </Mono>
        </header>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <Fig k="Uptime, 90 days" v={overall === null ? "—" : `${overall.toFixed(overall === 100 ? 0 : 2)}%`} />
          <Fig k="Days without downtime" v={`${perfect} of ${measured.length}`} />
          <Fig k="Incidents" v={String(incidents.length)} />
          <Fig k="Total downtime" v={downMs ? duration(0, downMs) : "none"} />
        </dl>

        <section>
          <h2 className="mb-3 text-sm font-medium text-foreground">Uptime by day</h2>
          <div role="img" aria-label={`Uptime by day over ${all.length} days`} className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-[3px]">
            {all.map(({ at, v }) => {
              const t = dayTone(v)
              return (
                <span
                  key={at}
                  title={`${date(at)}: ${v === null ? "not checked" : `${v.toFixed(2)}%`}`}
                  className={cn("aspect-square rounded-[1px]", t ? toneBg[t] : "cell-void")}
                />
              )
            })}
          </div>
          <div className="mt-2 flex justify-between font-mono text-2xs text-faint">
            <span>{date(all[0]?.at ?? d.uptimeByDay.start)}</span>
            <span>Today</span>
          </div>
          <Legend
            className="mt-3"
            items={[
              { tone: "ok", label: "Up all day" },
              { tone: "warn", label: "Under 1% down" },
              { tone: "danger", label: "1% or more down" },
              ...(all.some((x) => x.v === null) ? [{ tone: "void" as const, hollow: true, label: "Not checked" }] : []),
            ]}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-foreground">Incidents</h2>
          {incidents.length ? (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-faint">
                <tr className="border-b border-hairline">
                  <th className="py-2 font-normal">Started</th>
                  <th className="py-2 font-normal">Lasted</th>
                  <th className="py-2 font-normal">Cause</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id} className="border-b border-hairline align-baseline last:border-b-0">
                    <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap text-muted-foreground">{stamp(i.startedAt)}</td>
                    <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap text-foreground">
                      {i.resolvedAt ? duration(new Date(i.startedAt).getTime(), new Date(i.resolvedAt).getTime()) : `ongoing, ${duration(new Date(i.startedAt).getTime())}`}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {i.cause} <Mono className="text-xs text-faint">· {plural(i.failedChecks, "failed check")}</Mono>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No incidents in the last 90 days.</p>
          )}
        </section>

        <footer className="flex items-center justify-between border-t border-hairline pt-4 text-xs text-faint">
          <Wordmark />
          <Mono>Generated {stamp(new Date(now()).toISOString())} UTC</Mono>
        </footer>
      </article>
    </main>
  )
}

function Fig({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="mt-1 text-[22px] leading-none font-light tracking-[-0.02em] text-foreground tabular">{v}</dd>
    </div>
  )
}
