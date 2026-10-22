import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { cn } from "cn"
import { ArrowDown, BellPlus } from "lucide-react"
import type { LogFilter, LogList, LogPatternList, LogRange, LogVolume } from "../contract/domain"
import type { LogsPage } from "../contract/pages"
import { backend, scenario } from "@/data/backend"
import { scenarioState } from "@/data/useLoadable"
import { useLive } from "@/data/live"
import { TopBar } from "@/components/shell/TopBar"
import { useShell, isOwner, projectName } from "@/components/shell/ShellContext"
import { ProjectHeader } from "@/components/projects/ProjectHeader"
import { LogFilterBar } from "@/components/logs/LogFilterBar"
import { VolumeStrip } from "@/components/logs/VolumeStrip"
import { LogRows, type LineLinks } from "@/components/logs/LogRow"
import { PatternList, Template } from "@/components/logs/Patterns"
import { Button } from "@/components/ui/button"
import { Mono, PillTabs, Square } from "@/components/ui/primitives"
import { EmptyState, ErrorState, LoadingCells, Skeleton } from "@/components/ui/states"
import { num, time } from "@/lib/format"
import {
  DEFAULT_LOG_FILTER,
  aroundHref,
  isDefaultLogFilter,
  logFilterFromQuery,
  logQueryFromFilter,
  logViewFromQuery,
  templateOf,
  withTerm,
  type LogView,
} from "@/lib/logs"
import { Link, navigate, useLocation } from "@/lib/router"

const URL_KEYS = ["project", "level", "q", "range", "until", "pattern", "view", "line"]
/** One step finer, for a click on the volume strip. */
const FINER: Record<LogRange, LogRange> = { "30d": "7d", "7d": "24h", "24h": "1h", "1h": "1h" }
const WIDER: Partial<Record<LogRange, LogRange>> = { "1h": "24h", "24h": "7d", "7d": "30d" }
const RANGE_WORDS: Record<LogRange, string> = { "1h": "the last hour", "24h": "24 hours", "7d": "7 days", "30d": "30 days" }

/** A named scenario's filter goes into the URL once, so the URL stays the one source. */
function seedUrl() {
  const seed = scenario.named?.params
  if (!seed) return
  const q = new URLSearchParams(window.location.search)
  let changed = false
  for (const k of URL_KEYS)
    if (seed[k] && !q.has(k)) {
      q.set(k, seed[k]!)
      changed = true
    }
  if (changed) window.history.replaceState(null, "", `${window.location.pathname}?${q}`)
}

type Lines = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; list: LogList }
type Patterns = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; list: LogPatternList }

const allNull = (v: LogVolume) => Object.values(v.byLevel).every((b) => b.every((c) => c === null))

/**
 * Every line the apps logged, newest at the bottom: search it, follow new lines as they
 * arrive, or see the common messages as patterns. With `projectId`, one project's logs
 * under its header and tabs.
 */
export function Logs({ projectId }: { projectId?: string }) {
  useState(seedUrl)
  const shell = useShell()
  const owner = isOwner(shell)
  const { path, query } = useLocation()
  const route = projectId ? "/projects/:projectId/logs" : "/logs"
  const override = scenarioState<LogsPage>(route)
  const qs = query.toString()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filter = useMemo(() => logFilterFromQuery(query, projectId), [qs, projectId])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const view: LogView = useMemo(() => logViewFromQuery(query), [qs])
  const key = logQueryFromFilter(filter)
  const lineId = query.get("line")
  const project = projectId ? shell.projects.find((p) => p.id === projectId) : undefined
  const several = !projectId && filter.projectIds.length !== 1 && shell.projects.length > 1
  const nameOf = useCallback((id: string) => projectName(shell, id), [shell])

  const go = (f: LogFilter, v: LogView = view) => navigate(`${path}${logQueryFromFilter(f, v, query, !!projectId)}`)
  const hrefFor = (patch: Partial<LogFilter>, v: LogView = "lines") => `${path}${logQueryFromFilter({ ...filter, ...patch }, v, query, !!projectId)}`
  const links: LineLinks = {
    term: (t) => hrefFor({ query: withTerm(filter.query, t), patternId: null }),
    around: (l) => aroundHref(l),
  }

  // ── Lines ──
  const [lines, setLines] = useState<Lines>({ status: "loading" })
  const [tick, setTick] = useState(0)
  const [olderBusy, setOlderBusy] = useState(false)
  const [unseen, setUnseen] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const anchor = useRef<number | null>(null)
  const landed = useRef(false)

  useEffect(() => {
    if (view !== "lines") return
    let live = true
    setLines({ status: "loading" })
    setUnseen(0)
    landed.current = false
    backend.listLogs(filter).then(
      (list) => live && setLines({ status: "ready", list }),
      (e: Error) => live && setLines({ status: "error", message: e.message }),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, view, tick])

  const loadOlder = useCallback(() => {
    if (lines.status !== "ready" || !lines.list.older || olderBusy) return
    const el = scroller.current
    setOlderBusy(true)
    backend.listLogs(filter, { older: lines.list.older }).then(
      (page) => {
        anchor.current = el ? el.scrollHeight - el.scrollTop : null
        setLines((s) => (s.status === "ready" ? { status: "ready", list: { ...s.list, lines: [...page.lines, ...s.list.lines], older: page.older } } : s))
        setOlderBusy(false)
      },
      () => setOlderBusy(false),
    )
  }, [lines, olderBusy, filter])

  // New lines: one fetch at a time; a notice during a fetch asks for one more after it.
  const fetching = useRef(false)
  const again = useRef(false)
  const linesRef = useRef(lines)
  linesRef.current = lines
  const fetchNewer = useCallback(() => {
    const s = linesRef.current
    if (s.status !== "ready") return
    if (fetching.current) {
      again.current = true
      return
    }
    fetching.current = true
    backend.listLogs(filter, { newer: s.list.newer }).then(
      (page) => {
        fetching.current = false
        setLines((cur) => {
          if (cur.status !== "ready") return cur
          const have = new Set(cur.list.lines.map((l) => l.id))
          const added = page.lines.filter((l) => !have.has(l.id))
          if (added.length && !atBottom.current) setUnseen((n) => n + added.length)
          return { status: "ready", list: { ...cur.list, lines: [...cur.list.lines, ...added], newer: page.newer, total: page.total, volume: page.volume, dropped: page.dropped } }
        })
        if (again.current) {
          again.current = false
          fetchNewer()
        }
      },
      () => {
        fetching.current = false
      },
    )
  }, [filter])

  // ── Patterns ──
  const [patterns, setPatterns] = useState<Patterns>({ status: "loading" })
  useEffect(() => {
    if (view !== "patterns") return
    let live = true
    setPatterns((s) => (s.status === "ready" ? s : { status: "loading" }))
    backend.listLogPatterns(filter).then(
      (list) => live && setPatterns({ status: "ready", list }),
      (e: Error) => live && setPatterns({ status: "error", message: e.message }),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, view, tick])

  const patternTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useLive((e) => {
    if (e.kind === "resync") return setTick((t) => t + 1)
    if (e.kind !== "logs" || filter.until !== null) return
    if (filter.projectIds.length && !filter.projectIds.includes(e.projectId)) return
    if (view === "lines") fetchNewer()
    else if (!patternTimer.current)
      patternTimer.current = setTimeout(() => {
        patternTimer.current = null
        setTick((t) => t + 1)
      }, 5_000)
  })
  useEffect(() => () => void (patternTimer.current && clearTimeout(patternTimer.current)), [])

  // ── Scroll ──
  const count = lines.status === "ready" ? lines.list.lines.length : 0
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || lines.status !== "ready") return
    if (anchor.current !== null) {
      el.scrollTop = el.scrollHeight - anchor.current
      anchor.current = null
      return
    }
    if (!landed.current) {
      landed.current = true
      const marked = lineId ? el.querySelector<HTMLElement>(`[data-line="${CSS.escape(lineId)}"]`) : null
      if (marked) {
        el.scrollTop = marked.offsetTop - el.clientHeight / 2
        atBottom.current = false
      } else if (scenario.params.tail === "paused") {
        el.scrollTop = el.scrollHeight - el.clientHeight - 480
        atBottom.current = false
      } else {
        el.scrollTop = el.scrollHeight
        atBottom.current = true
      }
      return
    }
    if (atBottom.current) el.scrollTop = el.scrollHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, lines.status])

  // Following: stay at the bottom when the list's box changes size (a phone's toolbar, a wider window).
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [lines.status, view])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    if (atBottom.current && unseen) setUnseen(0)
    if (el.scrollTop < 300) loadOlder()
  }
  const toBottom = () => {
    const el = scroller.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    setUnseen(0)
  }

  // ── Page ──
  const shownLines: Lines =
    override?.list && override.list.status !== "ready" ? (override.list.status === "error" ? { status: "error", message: override.list.message } : { status: "loading" }) : lines
  const shownPatterns: Patterns =
    override?.patterns && override.patterns.status !== "ready"
      ? override.patterns.status === "error"
        ? { status: "error", message: override.patterns.message }
        : { status: "loading" }
      : patterns
  const volume = view === "lines" ? (shownLines.status === "ready" ? shownLines.list.volume : null) : shownPatterns.status === "ready" ? shownPatterns.list.volume : null
  const total = view === "lines" && shownLines.status === "ready" ? shownLines.list.total : view === "patterns" && shownPatterns.status === "ready" ? shownPatterns.list.patterns.reduce((s, p) => s + p.count, 0) : null
  const noLogs = volume !== null && allNull(volume)
  const failed = (view === "lines" ? shownLines : shownPatterns).status === "error"

  const crumbs = projectId ? [{ label: "Projects", to: "/projects" }, { label: project?.name ?? "Not found", to: project ? `/projects/${projectId}` : undefined }, { label: "Logs" }] : [{ label: "Logs" }]
  const alertHref = `/settings/alerts?${new URLSearchParams({
    new: "log",
    ...(filter.query ? { q: filter.query } : {}),
    level: filter.minLevel,
    ...(filter.projectIds.length ? { project: filter.projectIds.join(",") } : {}),
  })}`

  if (projectId && !project)
    return (
      <>
        <TopBar crumbs={crumbs} />
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
      </>
    )

  const setupHref = projectId ? `/projects/${projectId}/connect` : filter.projectIds.length === 1 ? `/projects/${filter.projectIds[0]}/connect` : "/projects"
  const empty = noLogs ? (
    <EmptyState
      className="p-6 md:p-10"
      cells="void"
      title={filter.until ? "No logs kept for this time." : "No logs yet."}
      action={
        <Button variant="outline" size="sm" onClick={() => navigate(setupHref)}>
          {setupHref === "/projects" ? "Pick a project to set up" : "Set up logs"}
        </Button>
      }
    >
      {filter.until
        ? "bertha has no lines from before this. Move the end later, or go live."
        : "Send lines with the SDK's logger, or point an OpenTelemetry log exporter at bertha. They show up here as they arrive."}
    </EmptyState>
  ) : (
    <EmptyState
      className="p-6 md:p-10"
      title="No lines match."
      action={
        <div className="flex flex-wrap gap-2">
          {!isDefaultLogFilter(filter) && (
            <Button variant="outline" size="sm" onClick={() => go({ ...DEFAULT_LOG_FILTER, projectIds: filter.projectIds })}>
              Clear filters
            </Button>
          )}
          {WIDER[filter.range] && (
            <Button variant="ghost" size="sm" onClick={() => go({ ...filter, range: WIDER[filter.range]! })}>
              Look back {RANGE_WORDS[WIDER[filter.range]!]}
            </Button>
          )}
        </div>
      }
    >
      Nothing in {RANGE_WORDS[filter.range]} matches this search at {filter.minLevel === "debug" ? "any level" : `${filter.minLevel} and up`}.
    </EmptyState>
  )

  let body
  if (view === "patterns") {
    if (shownPatterns.status === "loading") body = <RowsSkeleton />
    else if (shownPatterns.status === "error") body = <ErrorState className="p-6 md:p-10" message={shownPatterns.message} onRetry={() => setTick((t) => t + 1)} />
    else if (!shownPatterns.list.patterns.length) body = empty
    else
      body = (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PatternList patterns={shownPatterns.list.patterns} projectName={several ? nameOf : undefined} hrefFor={(p) => hrefFor({ patternId: p.id }, "lines")} />
          {shownPatterns.list.patterns.length >= 100 && <p className="px-4 py-4 text-xs text-faint md:px-6">The 100 most common. Narrow the search to see the rest.</p>}
        </div>
      )
  } else {
    if (shownLines.status === "loading") body = <RowsSkeleton />
    else if (shownLines.status === "error") body = <ErrorState className="p-6 md:p-10" message={shownLines.message} onRetry={() => setTick((t) => t + 1)} />
    else if (!shownLines.list.lines.length) body = empty
    else {
      const list = shownLines.list
      body = (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="flex items-center gap-3 px-4 py-3 text-xs text-faint md:px-6">
              {list.older ? (
                olderBusy ? (
                  <LoadingCells label="Loading older lines" />
                ) : (
                  <Button variant="ghost" size="xs" onClick={loadOlder}>
                    Load older lines
                  </Button>
                )
              ) : (
                <>
                  <span>Nothing older in {RANGE_WORDS[filter.range]}.</span>
                  {WIDER[filter.range] && (
                    <Link to={hrefFor({ range: WIDER[filter.range]! })} className="text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground">
                      Look back {RANGE_WORDS[WIDER[filter.range]!]}
                    </Link>
                  )}
                </>
              )}
            </div>
            <ul aria-label="Log lines">
              <LogRows lines={list.lines} projectName={several ? nameOf : undefined} markedId={lineId} openId={lineId} links={links} />
            </ul>
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-faint md:px-6">
              {filter.until ? (
                <>
                  <span>
                    Lines up to <Mono>{time(filter.until)}</Mono>.
                  </span>
                  <Link to={hrefFor({ until: null })} className="text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground">
                    Go live
                  </Link>
                </>
              ) : (
                <>
                  <Square tone="ok" className="size-1.5 animate-pulse-dot" /> Following new lines
                </>
              )}
            </div>
          </div>
          {unseen > 0 && (
            <button
              type="button"
              onClick={toBottom}
              className="press absolute bottom-4 left-1/2 flex -translate-x-1/2 animate-in items-center gap-1.5 rounded-full border border-border bg-popover px-3 py-1.5 text-xs text-foreground shadow-pop duration-150 fade-in-0 slide-in-from-bottom-1 hover:bg-raised"
            >
              <ArrowDown className="size-3.5" />
              <Mono>{num(unseen)}</Mono> new {unseen === 1 ? "line" : "lines"}
            </button>
          )}
        </div>
      )
    }
  }

  const dropped = view === "lines" && shownLines.status === "ready" ? shownLines.list.dropped : []
  const patternLine = filter.patternId && shownLines.status === "ready" ? shownLines.list.lines.at(-1) : undefined
  // The server's template when the patterns were loaded; worked out from a line otherwise.
  const patternTemplate =
    (patterns.status === "ready" ? patterns.list.patterns.find((p) => p.id === filter.patternId)?.template : undefined) ??
    (patternLine && templateOf(patternLine.message))

  return (
    <div className="flex h-svh flex-col md:h-[calc(100svh-18px)]">
      <TopBar crumbs={crumbs}>
        <div className="flex items-center gap-2">
          <PillTabs
            label="View"
            value={view}
            onChange={(v) => go({ ...filter, patternId: v === "patterns" ? null : filter.patternId }, v)}
            options={[
              { value: "lines", label: "Lines" },
              { value: "patterns", label: "Patterns" },
            ]}
          />
          {owner && (
            <Button variant="outline" size="sm" asChild>
              <Link to={alertHref}>
                <BellPlus /> <span className="max-sm:hidden">Alert on this search</span>
                <span className="sm:hidden">Alert</span>
              </Link>
            </Button>
          )}
        </div>
      </TopBar>
      {project && <ProjectHeader project={project} active="logs" />}
      <LogFilterBar filter={filter} projects={projectId ? undefined : shell.projects} total={failed || noLogs ? null : total} onChange={(f) => go(f)} />
      {!failed && !(noLogs && view === "lines") && (
        <VolumeStrip
          volume={volume}
          className="border-b border-hairline"
          onPick={(end) => go({ ...filter, until: end, range: FINER[filter.range] })}
        />
      )}
      {filter.patternId && view === "lines" && (
        <div className="flex min-w-0 items-center gap-3 border-b border-hairline px-4 py-2 text-xs md:px-6">
          <span className="shrink-0 text-faint">One pattern</span>
          {patternTemplate && <Template text={patternTemplate} className="min-w-0 truncate font-mono text-muted-foreground" />}
          <Link to={hrefFor({ patternId: null })} className="ml-auto shrink-0 text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground">
            Show all lines
          </Link>
        </div>
      )}
      {dropped.map((d) => (
        <div key={d.projectId} role="status" className="flex items-start gap-2.5 border-b border-hairline px-4 py-2.5 text-xs text-muted-foreground md:px-6">
          <Square tone="warn" className="mt-[5px]" />
          <p className="min-w-0">
            <span className="text-foreground">{nameOf(d.projectId)}</span> sent more than 2,000 lines a minute, so <Mono className="text-foreground">{num(d.lines)}</Mono> lines since{" "}
            <Mono>{time(d.since)}</Mono> weren't kept.{" "}
            {owner ? (
              <Link to={`/projects/${d.projectId}/settings#logs`} className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
                Raise its minimum level
              </Link>
            ) : (
              "Its owner can raise the minimum level"
            )}{" "}
            or log less.
          </p>
        </div>
      ))}
      {body}
    </div>
  )
}

function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-4 md:px-6" aria-busy>
      {Array.from({ length: 14 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-[12ch] shrink-0" />
          <Skeleton className="h-4 w-[6ch] shrink-0" />
          <Skeleton className={cn("h-4", ["w-2/3", "w-1/2", "w-3/4", "w-2/5"][i % 4])} />
        </div>
      ))}
    </div>
  )
}

