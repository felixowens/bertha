import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react"
import { cn } from "cn"
import { ChevronRight, RotateCw } from "lucide-react"
import type { Event, RelatedEvent } from "../../contract/domain"
import type { EventTrace, TraceSpan } from "@/contract/domain"
import { backend } from "@/data/backend"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/form"
import { LevelGlyph, Mono, toneBg, type Tone } from "@/components/ui/primitives"
import { Collapse } from "@/components/ui/motion"
import { Skeleton } from "@/components/ui/states"
import { Linkified } from "@/components/ui/linkify"
import { plural } from "@/lib/format"
import { Link } from "@/lib/router"

/** "3ms", "640ms", "7.12s", "15.1s". */
export function spanTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 10_000) return `${(ms / 1000).toFixed(2)}s`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

type Node = {
  span: TraceSpan
  children: Node[]
  depth: number
  parent: Node | null
}

function tree(spans: TraceSpan[]): { roots: Node[]; byId: Map<string, Node> } {
  const byId = new Map<string, Node>(spans.map((s) => [s.id, { span: s, children: [], depth: 0, parent: null }]))
  const roots: Node[] = []
  for (const s of spans) {
    const node = byId.get(s.id)!
    const parent = s.parentId ? byId.get(s.parentId) : undefined
    if (parent) {
      node.parent = parent
      parent.children.push(node)
    } else roots.push(node)
  }
  const depth = (n: Node, d: number) => {
    n.depth = d
    n.children.sort((a, b) => a.span.startMs - b.span.startMs)
    n.children.forEach((c) => depth(c, d + 1))
  }
  roots.forEach((r) => depth(r, 0))
  return { roots, byId }
}

const descendants = (n: Node): Node[] => n.children.flatMap((c) => [c, ...descendants(c)])
const notable = (n: Node): boolean => n.span.status === "error" || !!n.span.event || !!n.span.silent || n.children.some(notable)
const hidden = (n: Node) => n.span.projectId === null

type Row =
  | { kind: "span"; node: Node }
  | { kind: "silent"; node: Node }
  | {
      kind: "hidden"
      node: Node
      count: number
      startMs: number
      endMs: number
    }

function rows(tops: Node[], open: Set<string>): Row[] {
  const out: Row[] = []
  const walk = (n: Node) => {
    if (hidden(n)) {
      const all = [n, ...descendants(n)]
      out.push({
        kind: "hidden",
        node: n,
        count: all.length,
        startMs: Math.min(...all.map((x) => x.span.startMs)),
        endMs: Math.max(...all.map((x) => x.span.startMs + x.span.durationMs)),
      })
      return
    }
    out.push({ kind: "span", node: n })
    if (n.span.silent) out.push({ kind: "silent", node: n })
    if (open.has(n.span.id)) n.children.forEach(walk)
  }
  tops.forEach(walk)
  return out
}

/**
 * The request this event happened in: the root itself when a service's request starts
 * the trace, else the root's child it's under (a page's fetch, say).
 */
function requestOf(own: Node | undefined): Node | null {
  if (!own) return null
  const chain: Node[] = []
  for (let n: Node | null = own; n; n = n.parent) chain.push(n)
  const top = chain.at(-1)!
  return top.span.kind === "server" ? top : (chain.at(-2) ?? top)
}

type Load = { status: "loading" } | { status: "ready"; trace: EventTrace } | { status: "none" } | { status: "error"; message: string }

/** What happened in this event's request, across services, from the spans bertha kept. */
export function TraceSection({ event, related, fallback }: { event: Event; related: RelatedEvent[]; fallback: ReactNode }) {
  const [load, setLoad] = useState<Load>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  const traceId = event.trace?.traceId
  useEffect(() => {
    if (!traceId) return
    let live = true
    setLoad({ status: "loading" })
    backend.getTrace(event.issueId, event.id).then(
      (trace) => live && setLoad(trace ? { status: "ready", trace } : { status: "none" }),
      (e: unknown) =>
        live &&
        setLoad({
          status: "error",
          message: e instanceof Error ? e.message : "bertha couldn't load this trace. Try again.",
        }),
    )
    return () => {
      live = false
    }
  }, [event.issueId, event.id, traceId, attempt])

  if (!event.trace || load.status === "none")
    // Every browser event names a trace, so only say spans are missing where there's a link to show.
    return related.length ? (
      <div className="flex flex-col gap-2">
        {fallback}
        {event.trace && <NoSpans />}
      </div>
    ) : null
  if (load.status === "loading") return <TraceSkeleton />
  if (load.status === "error")
    return (
      <TraceFrame aside={null}>
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-card px-4 py-3">
          <span className="text-sm text-muted-foreground">{load.message}</span>
          <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>
            <RotateCw /> Try again
          </Button>
        </div>
      </TraceFrame>
    )
  return <Waterfall key={event.id} trace={load.trace} event={event} />
}

function TraceFrame({ aside, children, control }: { aside: ReactNode; children: ReactNode; control?: ReactNode }) {
  return (
    <section id="trace" className="scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 className="text-sm font-medium text-foreground">Trace</h2>
          {aside && <div className="text-xs text-faint">{aside}</div>}
        </div>
        {control}
      </div>
      {children}
    </section>
  )
}

/** The event names a trace, but no spans came with it. */
function NoSpans() {
  return (
    <p className="text-xs text-faint">
      No spans arrived for this trace, so bertha can only link errors on it. Send OpenTelemetry traces with the project's key to see the whole request.
    </p>
  )
}

function TraceSkeleton() {
  return (
    <TraceFrame aside="loading spans…">
      <div aria-busy className="flex flex-col gap-1.5 rounded-lg border border-hairline bg-card p-3">
        {["w-1/3", "w-1/2", "w-2/5", "w-3/5", "w-1/4"].map((w, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4">
            <Skeleton className={cn("h-3", w)} />
            <Skeleton className="h-3" />
          </div>
        ))}
      </div>
    </TraceFrame>
  )
}

function Waterfall({ trace, event }: { trace: EventTrace; event: Event }) {
  const { roots, byId } = useMemo(() => tree(trace.spans), [trace])
  const own = [...byId.values()].find((n) => n.span.event?.eventId === event.id) ?? (event.trace?.spanId ? byId.get(event.trace.spanId) : undefined)
  const request = requestOf(own)
  // Only worth a switch when the request is part of something bigger.
  const scoped = request && (roots.length > 1 || request !== roots[0]) ? request : null
  const [view, setView] = useState<"request" | "trace">(scoped ? "request" : "trace")
  const tops = view === "request" && scoped ? [scoped] : roots
  // The request is open throughout; across the whole trace, it and whatever leads to an error.
  const [open, setOpen] = useState<Set<string>>(() => {
    const mine = request ? [request, ...descendants(request)] : []
    return new Set([...byId.values()].filter((n) => n.children.length && (notable(n) || mine.includes(n))).map((n) => n.span.id))
  })
  const [detail, setDetail] = useState<string | null>(null)
  const everything = view === "request" || byId.size <= 12
  const list = rows(tops, everything ? new Set([...byId.keys()]) : open)
  const t0 = Math.min(...tops.map((n) => n.span.startMs))
  const end = Math.max(...tops.map((n) => n.span.startMs + n.span.durationMs))
  const span = Math.max(1, end - t0)
  const base = tops[0]!.depth
  // A lone root is the frame for everything under it, so it stays open.
  const pinned = (n: Node) => tops.length === 1 && n === tops[0]

  const shown = tops.flatMap((n) => [n, ...descendants(n)])
  const services = new Set(shown.filter((n) => !hidden(n)).map((n) => n.span.service))
  const others = new Set(shown.filter((n) => n.span.event && n.span.event.eventId !== event.id).map((n) => n.span.event!.issue.id))
  const aside = [plural(services.size, "service"), plural(shown.length, "span"), spanTime(end - t0), others.size ? `${plural(others.size, "other issue")} in it` : null]
    .filter(Boolean)
    .join(" · ")

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <TraceFrame
      aside={aside}
      control={
        scoped && (
          <Segmented
            label="Trace scope"
            value={view}
            onChange={setView}
            options={[
              { value: "request", label: "This request" },
              { value: "trace", label: "Whole trace" },
            ]}
          />
        )
      }
    >
      <div className="overflow-hidden rounded-lg border border-hairline bg-card">
        <Axis durationMs={span} />
        <ol>
          {list.map((r) => {
            const key = `${r.kind}-${r.node.span.id}`
            if (r.kind === "silent") return <SilentRow key={key} node={r.node} t0={t0} span={span} indent={r.node.depth - base + 1} />
            if (r.kind === "hidden") return <HiddenRow key={key} row={r} t0={t0} span={span} indent={r.node.depth - base} />
            const n = r.node
            return (
              <SpanRow
                key={key}
                node={n}
                t0={t0}
                span={span}
                own={n === own}
                eventId={event.id}
                boundary={!n.parent || n.parent.span.service !== n.span.service || tops.includes(n)}
                expandable={!everything && n.children.length > 0 && !pinned(n)}
                expanded={everything || open.has(n.span.id) || pinned(n)}
                onExpand={() => toggle(n.span.id)}
                detailOpen={detail === n.span.id}
                onDetail={() => setDetail((d) => (d === n.span.id ? null : n.span.id))}
                indent={n.depth - base}
              />
            )
          })}
        </ol>
      </div>
      <TraceLegend />
    </TraceFrame>
  )
}

/**
 * A span's place on the timeline, to the pixel. Anything that happened stays visible at
 * 2px; the quarter lines line up with the axis.
 */
function Bar({ startMs, endMs, t0, span, tone, label }: { startMs: number; endMs: number; t0: number; span: number; tone: Tone; label: string }) {
  const left = Math.min(100, Math.max(0, ((startMs - t0) / span) * 100))
  const width = Math.min(100 - left, Math.max(0, ((endMs - startMs) / span) * 100))
  return (
    <div role="img" aria-label={label} className="relative h-3">
      {ticks(span).map((ms) => (
        <span key={ms} aria-hidden className="absolute inset-y-0 w-px bg-hairline" style={{ left: `${(ms / span) * 100}%` }} />
      ))}
      <span className={cn("absolute inset-y-0.5 min-w-0.5 rounded-[2px]", toneBg[tone])} style={{ left: `${left}%`, width: `${width}%` }} />
    </div>
  )
}

/** Round marks inside the duration, 1, 2 or 5 of something apart, so a bar reads against them. */
function ticks(span: number): number[] {
  const steps = [1, 2, 5].flatMap((m) => [1, 10, 100, 1_000, 10_000, 100_000].map((p) => m * p)).sort((a, b) => a - b)
  const step = steps.find((st) => span / st <= 5) ?? steps[steps.length - 1]
  const out: number[] = []
  for (let ms = step; ms < span * 0.94; ms += step) out.push(ms)
  return out
}

function tickLabel(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${ms / 1000}s`
}

/** Times across the top, on the same marks as the bars' lines. */
function Axis({ durationMs }: { durationMs: number }) {
  return (
    <div className={cn(rowGrid, "border-b border-hairline py-1.5")}>
      <span className="hidden text-2xs text-faint sm:block">Span</span>
      <div className="relative col-span-2 h-4 sm:col-span-1">
        <Mono className="absolute top-0 left-0 text-2xs text-faint">0</Mono>
        {ticks(durationMs).map((ms) => (
          <Mono key={ms} className="absolute top-0 -translate-x-1/2 text-2xs text-faint" style={{ left: `${(ms / durationMs) * 100}%` }}>
            {tickLabel(ms)}
          </Mono>
        ))}
      </div>
      <span className="hidden sm:block" />
    </div>
  )
}

const rowGrid = "grid grid-cols-[minmax(0,1fr)_56px] items-center gap-x-4 gap-y-1.5 px-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_56px]"

function spanTone(s: TraceSpan, own: boolean): Tone {
  if (own) return "danger"
  if (s.event || s.status === "error") return "fg"
  return "quiet"
}

function SpanRow(p: {
  node: Node
  t0: number
  span: number
  own: boolean
  eventId: string
  boundary: boolean
  expandable: boolean
  expanded: boolean
  onExpand: () => void
  detailOpen: boolean
  onDetail: () => void
  indent: number
}) {
  const s = p.node.span
  const end = s.startMs + s.durationMs
  const other = s.event && s.event.eventId !== p.eventId ? s.event : null
  const tone = spanTone(s, p.own)
  return (
    <li className={cn("border-b border-hairline last:border-b-0", p.own && "bg-danger/10")}>
      <div className={cn(rowGrid, "py-1.5 transition-colors duration-150", !p.own && "hover:bg-raised/30")}>
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-1.5" style={{ paddingLeft: p.indent * 14 }}>
          {p.expandable ? (
            <button
              type="button"
              onClick={p.onExpand}
              aria-label={p.expanded ? `Fold ${s.name}` : `Unfold ${s.name}`}
              aria-expanded={p.expanded}
              className="press grid size-4 shrink-0 place-items-center rounded-[3px] text-faint hover:text-foreground"
            >
              <ChevronRight className={cn("size-3 transition-transform duration-200 ease-smooth", p.expanded && "rotate-90")} />
            </button>
          ) : (
            <span className="size-4 shrink-0" aria-hidden />
          )}
          <button type="button" onClick={p.onDetail} aria-expanded={p.detailOpen} className="flex min-w-0 items-baseline gap-2 text-left">
            {p.boundary && <Mono className="shrink-0 text-2xs text-faint">{s.service}</Mono>}
            <Mono className={cn("truncate text-xs", p.own || s.status === "error" ? "text-foreground" : "text-muted-foreground")}>{s.name}</Mono>
            {!p.expanded && p.node.children.length > 0 && <Mono className="shrink-0 text-2xs text-faint">+{descendants(p.node).length}</Mono>}
          </button>
          {other && (
            <Link to={`/issues/${other.issue.id}`} className="flex shrink-0 items-center gap-1 text-2xs text-muted-foreground underline-fade hover:text-foreground">
              <LevelGlyph level={other.issue.level} className="size-2" />
              <Mono>{other.issue.shortId}</Mono>
            </Link>
          )}
        </div>
        <div className="col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          <Bar startMs={s.startMs} endMs={end} t0={p.t0} span={p.span} tone={tone} label={`${s.name}: from +${spanTime(s.startMs - p.t0)} for ${spanTime(s.durationMs)}`} />
        </div>
        <Mono className={cn("col-start-2 row-start-1 text-right text-xs sm:col-start-3", s.durationMs >= 1000 ? "text-foreground" : "text-faint")}>{spanTime(s.durationMs)}</Mono>
      </div>
      <Collapse open={p.detailOpen}>
        <SpanDetail s={s} t0={p.t0} other={other} own={p.own} />
      </Collapse>
    </li>
  )
}

const kindLabel: Record<TraceSpan["kind"], string> = {
  server: "Handled a request",
  client: "Called out",
  internal: "Work in the service",
  producer: "Sent a message",
  consumer: "Took a message",
}

function SpanDetail({ s, t0, other, own }: { s: TraceSpan; t0: number; other: TraceSpan["event"]; own: boolean }) {
  const facts: [string, ReactNode][] = [
    ["Service", `${s.service} · ${s.runtime}`],
    ["Kind", `${kindLabel[s.kind]} · ${s.kind}`],
    ["Started", `+${spanTime(s.startMs - t0)}`],
    ["Took", spanTime(s.durationMs)],
    ["Status", s.status === "error" ? <span className="text-foreground">Error{s.statusMessage ? `: ${s.statusMessage}` : ""}</span> : s.status === "ok" ? "OK" : "Not set"],
  ]
  if (s.silent) facts.push(["Downstream", `${s.silent} sent no spans for this call`])
  if (own) facts.push(["Event", "This error was recorded here"])
  if (other)
    facts.push([
      "Event",
      <Link key="e" to={`/issues/${other.issue.id}`} className="underline-fade hover:text-foreground">
        {other.issue.shortId} · {other.issue.type}: {other.issue.message}
      </Link>,
    ])
  const attrs = Object.entries(s.attributes)
  return (
    <dl className="mx-3 mb-3 rounded-md border border-hairline bg-sidebar/60 px-3 font-mono text-xs">
      {[...facts, ...attrs.map(([k, v]): [string, ReactNode] => [k, <Linkified key={k} text={v} repoUrl={null} exact />])].map(([k, v], i) => (
        <Fragment key={`${k}-${i}`}>
          <div
            className={cn(
              "grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 border-b border-hairline py-1.5 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)]",
              i === facts.length && "border-t border-t-border",
            )}
          >
            <dt className={cn("break-words text-faint", i < facts.length && "font-sans")}>{k}</dt>
            <dd className="min-w-0 break-words text-muted-foreground">{v}</dd>
          </div>
        </Fragment>
      ))}
    </dl>
  )
}

/** A call into a service that sent nothing back for it: the gap is the finding. */
function SilentRow({ node, t0, span, indent }: { node: Node; t0: number; span: number; indent: number }) {
  const s = node.span
  return (
    <li className="border-b border-hairline last:border-b-0">
      <div className={cn(rowGrid, "py-1.5")}>
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-1.5" style={{ paddingLeft: indent * 14 }}>
          <span className="size-4 shrink-0" aria-hidden />
          <Mono className="truncate text-xs text-faint">{s.silent}: no spans</Mono>
        </div>
        <div className="col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          <Bar startMs={s.startMs} endMs={s.startMs + s.durationMs} t0={t0} span={span} tone="void" label={`Nothing received from ${s.silent}`} />
        </div>
        <Mono className="col-start-2 row-start-1 text-right text-xs text-faint sm:col-start-3">none</Mono>
      </div>
    </li>
  )
}

/** Spans from a project the viewer can't see: their place in time, and nothing else. */
function HiddenRow({ row, t0, span, indent }: { row: Extract<Row, { kind: "hidden" }>; t0: number; span: number; indent: number }) {
  return (
    <li className="border-b border-hairline last:border-b-0">
      <div className={cn(rowGrid, "py-1.5")}>
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-1.5" style={{ paddingLeft: indent * 14 }}>
          <span className="size-4 shrink-0" aria-hidden />
          <span className="truncate text-xs text-faint">A project you can't see · {plural(row.count, "span")}</span>
        </div>
        <div className="col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          <Bar startMs={row.startMs} endMs={row.endMs} t0={t0} span={span} tone="cell" label={`${row.count} spans from a project you can't see`} />
        </div>
        <Mono className="col-start-2 row-start-1 text-right text-xs text-faint sm:col-start-3">{spanTime(row.endMs - row.startMs)}</Mono>
      </div>
    </li>
  )
}

function TraceLegend() {
  const items: { tone: Tone; label: string; hollow?: boolean }[] = [
    { tone: "danger", label: "This error" },
    { tone: "fg", label: "Failed, or another issue" },
    { tone: "quiet", label: "Span" },
    { tone: "void", label: "Nothing received" },
  ]
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-faint">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          <span aria-hidden className={cn("inline-block h-2 w-4 rounded-[2px]", it.tone === "void" ? "cell-void" : toneBg[it.tone])} />
          {it.label}
        </li>
      ))}
    </ul>
  )
}
