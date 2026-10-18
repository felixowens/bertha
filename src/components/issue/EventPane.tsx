import type { ReactNode } from "react"
import { cn } from "cn"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import type { Breadcrumb, Event, EventCursor } from "../../contract/domain"
import { Button } from "@/components/ui/button"
import { Kbd, Label, Mono, Square, type Tone } from "@/components/ui/primitives"
import { Skeleton } from "@/components/ui/states"
import { num, stamp, time, ago } from "@/lib/format"
import { envShort } from "@/lib/meaning"
import { StackTrace } from "./StackTrace"

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
          {event.release ?? "no release"} · {envShort[event.environment]}
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

function Breadcrumbs({ crumbs, thrownAt }: { crumbs: Breadcrumb[]; thrownAt: string }) {
  return (
    <ol className="overflow-hidden rounded-lg border border-hairline bg-card font-mono text-xs">
      {crumbs.map((b, i) => (
        <li key={i} className="grid grid-cols-[64px_80px_minmax(0,1fr)] items-baseline gap-3 border-b border-hairline px-4 py-1.5 sm:grid-cols-[72px_96px_minmax(0,1fr)]">
          <span className="text-faint tabular">{time(b.at)}</span>
          <span className="flex items-center gap-1.5 text-faint">
            <Square tone={crumbTone[b.level]} className="size-1.5" />
            {b.category}
          </span>
          <span className={cn("break-words", b.level === "error" ? "text-foreground" : "text-muted-foreground")}>{b.message}</span>
        </li>
      ))}
      <li className="grid grid-cols-[64px_80px_minmax(0,1fr)] items-baseline gap-3 bg-danger/10 px-4 py-1.5 sm:grid-cols-[72px_96px_minmax(0,1fr)]">
        <span className="text-danger tabular">{time(thrownAt)}</span>
        <span className="flex items-center gap-1.5 text-danger">
          <Square tone="danger" className="size-1.5" />
          error
        </span>
        <span className="text-foreground">This error</span>
      </li>
    </ol>
  )
}

function Fact({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 border-b border-hairline py-2 last:border-b-0">
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="min-w-0 font-mono text-xs break-words text-muted-foreground">{children}</dd>
    </div>
  )
}

const missing = <span className="text-faint">not reported</span>

/** One occurrence in full: the stack, what led up to it, the request and who hit it. */
export function EventBody({ event, projectId, loading }: { event: Event; projectId: string; loading: boolean }) {
  if (loading) return <EventSkeleton />
  const tags = Object.entries(event.tags)
  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-150">
      <Section title="Stack trace" id="stack">
        {event.exception && event.exception.frames.length ? (
          <StackTrace key={event.id} frames={event.exception.frames} projectId={projectId} />
        ) : (
          <div className="rounded-lg border border-dashed border-hairline px-4 py-5 text-sm text-muted-foreground">
            <span className="text-foreground">No stack trace.</span> This was reported as a message, not a thrown error, so there's no code location. Breadcrumbs and tags are all there is.
          </div>
        )}
      </Section>

      <Section title="Breadcrumbs" aside={event.breadcrumbs.length ? `${event.breadcrumbs.length} leading up to it` : undefined}>
        {event.breadcrumbs.length ? (
          <Breadcrumbs crumbs={event.breadcrumbs} thrownAt={event.receivedAt} />
        ) : (
          <p className="text-sm text-faint">None recorded for this event.</p>
        )}
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Request">
          {event.request ? (
            <dl className="rounded-lg border border-hairline bg-card px-4">
              <Fact k="Method">{event.request.method}</Fact>
              <Fact k="URL">{event.request.url}</Fact>
              <Fact k="Status">
                {event.request.status === null ? missing : <span className={event.request.status >= 500 ? "text-danger" : event.request.status >= 400 ? "text-warn" : undefined}>{event.request.status}</span>}
              </Fact>
            </dl>
          ) : (
            <p className="text-sm text-faint">Not part of a request.</p>
          )}
        </Section>
        <Section title="User and runtime">
          <dl className="rounded-lg border border-hairline bg-card px-4">
            <Fact k="User">{event.user?.email ?? event.user?.id ?? missing}</Fact>
            {event.user?.ip && <Fact k="IP">{event.user.ip}</Fact>}
            <Fact k="Browser">{event.context.browser ?? missing}</Fact>
            <Fact k="OS">{event.context.os ?? missing}</Fact>
            <Fact k="Runtime">{event.context.runtime ?? missing}</Fact>
            {event.context.userAgent && <Fact k="User agent">{event.context.userAgent}</Fact>}
          </dl>
        </Section>
      </div>

      {tags.length > 0 && (
        <Section title="Tags on this event">
          <div className="flex flex-wrap gap-1.5">
            {tags.map(([k, v]) => (
              <span key={k} className="inline-flex max-w-full items-center overflow-hidden rounded-md border border-hairline font-mono text-xs">
                <span className="bg-raised px-2 py-1 text-faint">{k}</span>
                <span className="truncate px-2 py-1 text-muted-foreground">{v}</span>
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
