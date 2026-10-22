import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { cn } from "cn"
import { RotateCw } from "lucide-react"
import type { Event, EventLogs } from "../../contract/domain"
import { backend } from "@/data/backend"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/states"
import { LogRows, type LineLinks } from "@/components/logs/LogRow"
import { logsHref, rangeHolding, withTerm } from "@/lib/logs"
import { now } from "@/lib/clock"
import { plural } from "@/lib/format"
import { Link } from "@/lib/router"
import { useShell, projectName } from "@/components/shell/ShellContext"
import { Section } from "./EventPane"

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; logs: EventLogs | null }

const link = "text-muted-foreground underline decoration-border underline-offset-4 transition-[color,text-decoration-color] duration-150 hover:text-foreground hover:decoration-foreground"

/** Where "Open in logs" goes: the same lines on the logs page, this event's line marked. */
function openHref(logs: EventLogs, event: Event, projectId: string) {
  const traceId = event.trace?.traceId
  const base =
    logs.scope === "trace" && traceId
      ? logsHref({ query: `trace:${traceId}`, minLevel: "debug", range: rangeHolding(logs.to, now()), until: logs.to })
      : logsHref({ projectIds: [projectId], minLevel: "debug", range: "1h", until: logs.to })
  return logs.eventLineId ? `${base}&line=${encodeURIComponent(logs.eventLineId)}` : base
}

/**
 * What the app logged around this event: every line on its trace, or the project's lines
 * from just before it. The line logged as the event itself is marked.
 */
export function LogsSection({ event, projectId }: { event: Event; projectId: string }) {
  const shell = useShell()
  const [load, setLoad] = useState<Load>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    setLoad({ status: "loading" })
    backend.getEventLogs(event.issueId, event.id).then(
      (logs) => live && setLoad({ status: "ready", logs }),
      (e: unknown) => live && setLoad({ status: "error", message: e instanceof Error ? e.message : "bertha couldn't load the logs. Try again." }),
    )
    return () => {
      live = false
    }
  }, [event.issueId, event.id, attempt])

  const box = useRef<HTMLUListElement>(null)
  const ready = load.status === "ready" ? load.logs : null
  useLayoutEffect(() => {
    const el = box.current
    if (!el || !ready) return
    const marked = ready.eventLineId ? el.querySelector<HTMLElement>(`[data-line="${CSS.escape(ready.eventLineId)}"]`) : null
    el.scrollTop = marked ? marked.offsetTop - el.clientHeight / 2 : el.scrollHeight
  }, [ready])

  if (load.status === "loading")
    return (
      <Section title="Logs" id="logs" aside="loading lines…">
        <div aria-busy className="flex flex-col gap-1.5 rounded-lg border border-hairline bg-card p-3">
          {["w-1/2", "w-2/3", "w-2/5", "w-3/5"].map((w, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-3 w-[12ch] shrink-0" />
              <Skeleton className={cn("h-3", w)} />
            </div>
          ))}
        </div>
      </Section>
    )
  if (load.status === "error")
    return (
      <Section title="Logs" id="logs">
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-card px-4 py-3">
          <span className="text-sm text-muted-foreground">{load.message}</span>
          <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>
            <RotateCw /> Try again
          </Button>
        </div>
      </Section>
    )
  const logs = load.logs
  if (!logs) return null
  if (!logs.projectHasLogs)
    return (
      <Section title="Logs" id="logs">
        <p className="text-sm text-faint">
          This project doesn't send logs, so there's nothing from around this event.{" "}
          <Link to={`/projects/${projectId}/connect`} className={link}>
            Set up logs
          </Link>
        </p>
      </Section>
    )

  const open = openHref(logs, event, projectId)
  const where = logs.scope === "trace" ? "on this trace" : "2m before to 30s after"
  const aside = (
    <span className="flex items-baseline gap-3">
      <span>
        {logs.lines.length ? `${plural(logs.lines.length, "line")} ` : ""}
        {where}
      </span>
      <Link to={open} className={link}>
        Open in logs
      </Link>
    </span>
  )
  const links: LineLinks = {
    term: (t) => (t.startsWith("trace:") ? open : `${logsHref({ projectIds: [projectId], query: withTerm("", t), range: rangeHolding(logs.to, now()) })}`),
  }
  return (
    <Section title="Logs" id="logs" aside={aside}>
      {logs.lines.length ? (
        <ul ref={box} className="relative max-h-96 overflow-y-auto overscroll-contain rounded-lg border border-hairline bg-card py-1 [&>li:last-child]:border-b-0">
          <LogRows lines={logs.lines} projectName={new Set(logs.lines.map((l) => l.projectId)).size > 1 ? (id) => projectName(shell, id) : undefined} markedId={logs.eventLineId} links={links} />
        </ul>
      ) : (
        <p className="text-sm text-faint">{logs.scope === "trace" ? "No lines on this trace." : "No lines around this event."}</p>
      )}
    </Section>
  )
}
