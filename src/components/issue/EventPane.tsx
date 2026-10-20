import type { ReactNode } from "react"
import { cn } from "cn"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import type { Breadcrumb, Event, EventCursor, Mechanism, RelatedEvent } from "../../contract/domain"
import { Button } from "@/components/ui/button"
import { Kbd, Label, LevelGlyph, Mono, Square, type Tone } from "@/components/ui/primitives"
import { Skeleton } from "@/components/ui/states"
import { num, stamp, clock, ago, version, elapsed } from "@/lib/format"
import { envShort } from "@/lib/meaning"
import { Link } from "@/lib/router"
import { Linkified } from "@/components/ui/linkify"
import { StackTrace } from "./StackTrace"
import { TraceSection } from "./Trace"

export type Step = "latest" | "oldest" | "newer" | "older"

/** Which of thousands of events you're looking at, and how to step through them. */
export function EventNav({ event, cursor, loading, onStep }: { event: Event; cursor: EventCursor; loading: boolean; onStep: (s: Step) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm text-foreground">
          Event <Mono>{num(cursor.index + 1)}</Mono> <span className="text-faint">of</span> <Mono>{num(cursor.total)}</Mono>
        </span>
        <Mono className="text-xs text-faint">
          {stamp(event.receivedAt)} · {ago(event.receivedAt)}
        </Mono>
        <Mono className="text-xs text-faint">
          {event.release ? version(event.release) : "no release"} · {envShort[event.environment]}
        </Mono>
      </div>
      <div className={cn("flex items-center gap-1 transition-opacity", loading && "opacity-50")}>
        <Button variant="ghost" size="icon-sm" aria-label="Newest event" disabled={!cursor.newerId} onClick={() => onStep("latest")}>
          <ChevronsLeft />
        </Button>
        <Button variant="outline" size="sm" aria-label="Newer event" disabled={!cursor.newerId} onClick={() => onStep("newer")}>
          <ChevronLeft /> Newer <Kbd className="ml-0.5">[</Kbd>
        </Button>
        <Button variant="outline" size="sm" aria-label="Older event" disabled={!cursor.olderId} onClick={() => onStep("older")}>
          <Kbd className="mr-0.5">]</Kbd> Older <ChevronRight />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Oldest event" disabled={!cursor.olderId} onClick={() => onStep("oldest")}>
          <ChevronsRight />
        </Button>
      </div>
    </div>
  )
}

export function Section({ title, aside, children, className, id }: { title: string; aside?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-20", className)}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {aside && <div className="text-xs text-faint">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

const crumbTone: Record<Breadcrumb["level"], Tone> = { info: "cell", warning: "warn", error: "danger" }

function Breadcrumbs({ crumbs, thrownAt, repoUrl }: { crumbs: Breadcrumb[]; thrownAt: string; repoUrl: string | null }) {
  return (
    <ol className="overflow-hidden rounded-lg border border-hairline bg-card font-mono text-xs">
      {crumbs.map((b, i) => (
        <li key={i} className="grid grid-cols-[84px_92px_minmax(0,1fr)] items-baseline gap-3 border-b border-hairline px-4 py-1.5 sm:grid-cols-[96px_96px_minmax(0,1fr)]">
          <span className="text-faint tabular">{clock(b.at)}</span>
          <span className="flex items-center gap-1.5 text-faint">
            <Square tone={crumbTone[b.level]} className="size-1.5" />
            {b.category}
          </span>
          <span className={cn("break-words", b.level === "error" ? "text-foreground" : "text-muted-foreground")}>
            <Linkified text={b.message} repoUrl={repoUrl} exact />
          </span>
        </li>
      ))}
      <li className="grid grid-cols-[84px_92px_minmax(0,1fr)] items-baseline gap-3 bg-danger/10 px-4 py-1.5 sm:grid-cols-[96px_96px_minmax(0,1fr)]">
        <span className="text-danger tabular">{clock(thrownAt)}</span>
        <span className="flex items-center gap-1.5 text-danger">
          <Square tone="danger" className="size-1.5" />
          error
        </span>
        <span className="text-foreground">This error</span>
      </li>
    </ol>
  )
}

function Fact({ k, children, wide }: { k: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("grid gap-3 border-b border-hairline py-2 last:border-b-0", wide ? "grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:grid-cols-[160px_minmax(0,1fr)]" : "grid-cols-[88px_minmax(0,1fr)]")}>
      <dt className={cn("text-xs break-words text-faint", wide && "font-mono")}>{k}</dt>
      <dd className="min-w-0 font-mono text-xs break-words text-muted-foreground">{children}</dd>
    </div>
  )
}

const missing = <span className="text-faint">not reported</span>

const handlers: Record<string, string> = {
  onerror: "Uncaught error",
  onunhandledrejection: "Unhandled rejection",
  uncaughtException: "Uncaught exception",
  unhandledRejection: "Unhandled rejection",
  onRequestError: "Error in a Next.js request",
  wrapHandler: "Thrown from a request handler",
  ErrorBoundary: "React error boundary",
  captureException: "Reported by the app",
  captureMessage: "Logged by the app",
}

/** How the error reached the SDK, and whether the app caught it. */
function Surfaced({ m }: { m: Mechanism | null }) {
  if (!m) return <>How it surfaced wasn't reported</>
  return (
    <>
      {handlers[m.handler] ?? "Caught"}, {m.handled ? "caught by the app" : "not caught by the app"} · <Mono>{m.handler}</Mono>
    </>
  )
}

const arrivals: Record<NonNullable<Event["context"]["navigation"]>, string> = {
  navigate: "Link or address bar",
  reload: "Reload",
  back_forward: "Back or forward",
  prerender: "Prerendered",
}

/** Browser SDKs send the page's state; server ones never do. */
const isBrowser = (e: Event) => e.context.browser !== null || e.context.viewport !== null

function PageState({ c, repoUrl }: { c: Event["context"]; repoUrl: string | null }) {
  const facts: [string, ReactNode][] = []
  if (c.viewport) facts.push(["Viewport", c.viewport])
  if (c.online !== null) facts.push(["Network", [c.online ? "Online" : "Offline", c.connection].filter(Boolean).join(", ")])
  if (c.visible !== null) facts.push(["Tab", c.visible ? "Visible" : "Hidden"])
  if (c.navigation) facts.push(["Arrived by", arrivals[c.navigation]])
  if (c.pageAgeMs !== null) facts.push(["Open for", elapsed(c.pageAgeMs)])
  if (c.automated !== null) facts.push(["Automated", c.automated ? "Yes, navigator.webdriver is set" : "No"])
  if (c.referrer) facts.push(["Referrer", <Linkified key="referrer" text={c.referrer} repoUrl={repoUrl} exact />])
  if (c.language) facts.push(["Language", c.language])
  if (c.timezone) facts.push(["Timezone", c.timezone])
  if (!facts.length) return null
  return (
    <Section title="Page state">
      <dl className="rounded-lg border border-hairline bg-card px-4">
        {facts.map(([k, v]) => (
          <Fact key={k} k={k}>
            {v}
          </Fact>
        ))}
      </dl>
    </Section>
  )
}

function KeyValues({ title, aside, values, repoUrl, className }: { title: string; aside?: string; values: Record<string, string>; repoUrl: string | null; className?: string }) {
  const entries = Object.entries(values)
  if (!entries.length) return null
  return (
    <Section title={title} aside={aside} className={className}>
      <dl className="rounded-lg border border-hairline bg-card px-4">
        {entries.map(([k, v]) => (
          <Fact key={k} k={k} wide>
            <Linkified text={v} repoUrl={repoUrl} exact />
          </Fact>
        ))}
      </dl>
    </Section>
  )
}

/** Other issues' events from the same page load or request. */
function SameTrace({ related }: { related: RelatedEvent[] }) {
  return (
    <Section title="Same trace" aside="the same page load or request, in other issues">
      <ul className="overflow-hidden rounded-lg border border-hairline bg-card">
        {related.map((r) => (
          <li key={r.eventId} className="border-b border-hairline last:border-b-0">
            <Link to={`/issues/${r.issue.id}`} className="flex min-w-0 items-baseline gap-3 px-4 py-2 transition-colors duration-150 hover:bg-raised/30">
              <LevelGlyph level={r.issue.level} className="shrink-0 translate-y-px" />
              <Mono className="shrink-0 text-xs text-muted-foreground">{r.issue.shortId}</Mono>
              <span className="min-w-0 truncate text-sm text-foreground">
                {r.issue.type}: <span className="text-muted-foreground">{r.issue.message}</span>
              </span>
              <Mono className="ml-auto shrink-0 text-xs text-faint">{ago(r.receivedAt)}</Mono>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** One occurrence in full: the stack, what led up to it, the request and who hit it. */
export function EventBody({ event, related, projectId, repoUrl, loading }: { event: Event; related: RelatedEvent[]; projectId: string; repoUrl: string | null; loading: boolean }) {
  if (loading) return <EventSkeleton />
  const tags = Object.entries(event.tags)
  const browser = isBrowser(event)
  const c = event.context
  const versions = Object.entries(c.versions)
  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-150">
      <Section title="Stack trace" id="stack" aside={<Surfaced m={event.mechanism} />}>
        {event.exception && event.exception.frames.length ? (
          <StackTrace key={event.id} frames={event.exception.frames} projectId={projectId} />
        ) : (
          <div className="rounded-lg border border-dashed border-hairline px-4 py-5 text-sm text-muted-foreground">
            <span className="text-foreground">No stack trace.</span> This was reported as a message, not a thrown error, so there's no code location. Breadcrumbs and tags are all there is.
          </div>
        )}
      </Section>

      {event.exception && <KeyValues title="Error fields" aside="the error's own properties, as JSON" values={event.exception.data} repoUrl={repoUrl} />}

      {event.exception?.componentStack && (
        <Section title="Component stack" aside="innermost first">
          <pre className="overflow-x-auto rounded-lg border border-hairline bg-card px-4 py-3 font-mono text-xs leading-5 text-muted-foreground">
            {event.exception.componentStack.split("\n").map((l) => l.trim()).filter(Boolean).join("\n")}
          </pre>
        </Section>
      )}

      <Section title="Breadcrumbs" aside={event.breadcrumbs.length ? `${event.breadcrumbs.length} leading up to it` : undefined}>
        {event.breadcrumbs.length ? (
          <Breadcrumbs crumbs={event.breadcrumbs} thrownAt={event.receivedAt} repoUrl={repoUrl} />
        ) : (
          <p className="text-sm text-faint">None recorded for this event.</p>
        )}
      </Section>

      <TraceSection event={event} related={related} fallback={<SameTrace related={related} />} />

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title={browser ? "Page" : "Request"}>
          {event.request ? (
            <dl className="rounded-lg border border-hairline bg-card px-4">
              <Fact k="Method">{event.request.method}</Fact>
              <Fact k="URL">
                <Linkified text={event.request.url} repoUrl={repoUrl} exact />
              </Fact>
              {!browser && (
                <Fact k="Status">
                  {event.request.status === null ? missing : <span className={event.request.status >= 500 ? "text-danger" : event.request.status >= 400 ? "text-warn" : undefined}>{event.request.status}</span>}
                </Fact>
              )}
              {event.trace && (
                <Fact k="Trace">
                  {event.trace.traceId}
                  {event.trace.spanId && <span className="text-faint"> · span {event.trace.spanId}</span>}
                </Fact>
              )}
            </dl>
          ) : (
            <p className="text-sm text-faint">{browser ? "No page reported." : "Not part of a request."}</p>
          )}
        </Section>
        <Section title="User and runtime">
          <dl className="rounded-lg border border-hairline bg-card px-4">
            <Fact k="User">{event.user?.email ?? event.user?.id ?? missing}</Fact>
            {event.user?.ip && <Fact k="IP">{event.user.ip}</Fact>}
            <Fact k="Browser">{event.context.browser ?? missing}</Fact>
            <Fact k="OS">{event.context.os ?? missing}</Fact>
            <Fact k="Runtime">{event.context.runtime ?? missing}</Fact>
            {c.host && <Fact k="Host">{c.host}</Fact>}
            {versions.length > 0 && <Fact k="Versions">{versions.map(([k, v]) => `${k} ${v}`).join(" · ")}</Fact>}
            {event.context.userAgent && <Fact k="User agent">{event.context.userAgent}</Fact>}
          </dl>
        </Section>
        {browser && <PageState c={c} repoUrl={repoUrl} />}
        {event.request && <KeyValues title="Request headers" aside="credentials are never sent" values={event.request.headers} repoUrl={repoUrl} className="lg:col-span-2" />}
      </div>

      {tags.length > 0 && (
        <Section title="Tags on this event">
          <div className="flex flex-wrap gap-1.5">
            {tags.map(([k, v]) => (
              <span key={k} className="inline-flex max-w-full items-center overflow-hidden rounded-md border border-hairline font-mono text-xs">
                <span className="bg-raised px-2 py-1 text-faint">{k}</span>
                <span className="truncate px-2 py-1 text-muted-foreground">
                  <Linkified text={v} repoUrl={repoUrl} exact />
                </span>
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function EventSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <Label>Loading event…</Label>
      <Skeleton className="h-9" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-8" />
      ))}
    </div>
  )
}
