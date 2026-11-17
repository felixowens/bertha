import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Event, EventCursor, Issue, IssueSummary, RelatedEvent, Triage } from "../contract/domain"
import type { IssueDetailPage } from "../contract/pages"
import type { IssueChange } from "../contract/actions"
import { backend } from "@/data/backend"
import { useLoadable, type Ready } from "@/data/useLoadable"
import { TopBar, type Crumb } from "@/components/shell/TopBar"
import { useShell } from "@/components/shell/ShellContext"
import { typing } from "@/components/shell/Shortcuts"
import { useTriage } from "@/components/issues/triage"
import { readQueue } from "@/components/issues/filters"
import { IssueHeader, type Menu, type Place } from "@/components/issue/IssueHeader"
import { MergeDialog } from "@/components/issue/MergeDialog"
import { toast } from "@/components/ui/toast"
import { History } from "@/components/issue/History"
import { EventBody, EventNav, Section, type Step } from "@/components/issue/EventPane"
import { Tags } from "@/components/issue/Tags"
import { Triages } from "@/components/issue/Triages"
import { ActivityLog, NoteComposer } from "@/components/issue/ActivityLog"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/primitives"
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states"
import { Link, navigate } from "@/lib/router"
import { plural } from "@/lib/format"
import { issuesIn, useLiveReload } from "@/data/live"

type Data = Ready<IssueDetailPage>

/** Where Esc goes: back to the list you came from, filters intact. */
function backHref() {
  try {
    const ref = document.referrer ? new URL(document.referrer) : null
    if (ref && ref.origin === location.origin && ref.pathname === "/issues") return `/issues${ref.search}`
  } catch {
    /* ignore */
  }
  return "/issues"
}

const backLabelOf = (to: string) => (to === "/" || to.startsWith("/?") ? "Overview" : to.startsWith("/projects/") ? "Project" : "Issues")

/** The queue that opened this issue (the list or the attention queue), if it's in it. */
function useQueue(issueId: string): {
  back: string | null
  place: Place | null
} {
  const [queue] = useState(readQueue)
  return useMemo(() => {
    const i = queue ? queue.ids.indexOf(issueId) : -1
    if (!queue || i < 0) return { back: null, place: null }
    return {
      back: queue.back,
      place: {
        index: i,
        total: queue.ids.length,
        prev: queue.ids[i - 1] ?? null,
        next: queue.ids[i + 1] ?? null,
      },
    }
  }, [queue, issueId])
}

export function IssueDetail({ issueId }: { issueId: string }) {
  const shell = useShell()
  const page = useLoadable<Data>(() => backend.getIssue(issueId), [issueId], { route: "/issues/:issueId" })
  const { state } = page
  useLiveReload(page.reload, (e) => issuesIn(e).includes(issueId))
  const [referrer] = useState(backHref)
  const queue = useQueue(issueId)
  const back = queue.back ?? referrer
  // A short id (KILN-4F, linked from a note) finds the issue; the address settles on its id.
  const found = state.status === "ready" ? state.data.issue.id : null
  useEffect(() => {
    if (found && found !== issueId) navigate(`/issues/${found}${window.location.search}`, { replace: true })
  }, [found, issueId])

  const crumbs = [
    { label: backLabelOf(back), to: back },
    { label: state.status === "ready" ? state.data.issue.shortId : "…", mono: true },
  ]

  if (state.status === "loading")
    return (
      <>
        <TopBar crumbs={crumbs} />
        <DetailSkeleton />
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
        <TopBar crumbs={[{ label: backLabelOf(back), to: back }, { label: "Not found" }]} />
        <EmptyState
          className="p-6 md:p-10"
          cells="void"
          title="This issue isn't here any more."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to={back}>Back to issues</Link>
            </Button>
          }
        >
          It may have been merged or deleted, or it belongs to a project you no longer have access to.
        </EmptyState>
      </>
    )

  // Keyed by issue, so the shown event and its menus start over on the next issue.
  return <Ready key={state.data.issue.id} data={state.data} me={shell.viewer.id} owner={shell.viewer.role === "owner"} back={back} place={queue.place} crumbs={crumbs} onReload={page.reload} onPatch={page.set} />
}

function Ready({
  data,
  me,
  owner,
  back,
  place,
  crumbs,
  onReload,
  onPatch,
}: {
  data: Data
  me: string
  owner: boolean
  back: string
  place: Place | null
  crumbs: Crumb[]
  onReload: () => void
  onPatch: (fn: (d: Data) => Data) => void
}) {
  const { issue, project } = data
  const [ev, setEv] = useState<{ event: Event; cursor: EventCursor; related: RelatedEvent[] }>({
    event: data.event,
    cursor: data.cursor,
    related: data.related,
  })
  // A link to one event (`?eventId=`, from a log line) opens on it.
  const [wanted] = useState(() => {
    const id = new URLSearchParams(window.location.search).get("eventId")
    return id && id !== data.event.id ? id : null
  })
  const [loadingEvent, setLoadingEvent] = useState(wanted !== null)
  const [menu, setMenu] = useState<Menu>(null)
  const [noteFocus, setNoteFocus] = useState(0)
  const [merging, setMerging] = useState(false)

  // Fetches another event of this issue, with loadingEvent already set. Only the last
  // one asked for lands.
  const asked = useRef(0)
  const land = useCallback(
    (which: Parameters<typeof backend.getEvent>[1]) => {
      const n = ++asked.current
      return backend.getEvent(issue.id, which).then(
        (next) => {
          if (n !== asked.current) return
          setEv(next)
          setLoadingEvent(false)
        },
        (e: unknown) => {
          if (n !== asked.current) return
          toast({ tone: "danger", body: e instanceof Error ? e.message : "bertha couldn't load that event. Try again." })
          setLoadingEvent(false)
        },
      )
    },
    [issue.id],
  )
  const show = useCallback(
    (which: Parameters<typeof backend.getEvent>[1]) => {
      setLoadingEvent(true)
      return land(which)
    },
    [land],
  )
  useEffect(() => {
    if (wanted) void land({ eventId: wanted })
  }, [wanted, land])

  // New events arrive on a live reload. On the newest event, follow it; on an older
  // one, stay put and let the count and position move.
  const [seen, setSeen] = useState({ event: data.event, cursor: data.cursor, related: data.related })
  if (seen.event !== data.event || seen.cursor !== data.cursor || seen.related !== data.related) {
    // Adjusting state while rendering, as React suggests for state derived from props.
    setSeen({ event: data.event, cursor: data.cursor, related: data.related })
    setEv((prev) => {
      if (prev.cursor.newerId === null) return { event: data.event, cursor: data.cursor, related: data.related }
      const added = data.cursor.total - prev.cursor.total
      return {
        ...prev,
        cursor: {
          ...prev.cursor,
          index: prev.cursor.index + added,
          total: data.cursor.total,
        },
      }
    })
  }

  const onChanged = useCallback(
    (updated: IssueSummary[] | null) => {
      if (!updated) return onReload()
      const u = updated.find((x) => x.id === issue.id)
      if (u) onPatch((d) => ({ ...d, issue: { ...d.issue, ...u } }))
    },
    [issue.id, onReload, onPatch],
  )
  const { run, busy } = useTriage(onChanged)
  // Working through a queue: once this one is dealt with, go to the next.
  const act = async (change: IssueChange) => {
    // The label menu stays open for another pick.
    if (change.kind !== "label") setMenu(null)
    const ok = await run([issue], change)
    if (ok && place?.next && change.kind !== "assign" && change.kind !== "reopen" && change.kind !== "label") navigate(`/issues/${place.next}`)
  }

  const step = async (s: Step) => {
    const { cursor } = ev
    const which = s === "latest" || s === "oldest" ? s : s === "newer" ? (cursor.newerId ? { eventId: cursor.newerId } : null) : cursor.olderId ? { eventId: cursor.olderId } : null
    if (which) await show(which)
  }

  // The issue carries who's on it now; keep it in step with the triage that changed.
  const triageSaved = (t: Triage) =>
    onPatch((d) => {
      const has = d.issue.triages.some((x) => x.id === t.id)
      const triages = has ? d.issue.triages.map((x) => (x.id === t.id ? t : x)) : [t, ...d.issue.triages]
      return { ...d, issue: { ...d.issue, triages, triage: t.state === "active" ? { by: t.by, via: t.via, since: t.startedAt } : t.state === "done" ? null : d.issue.triage } }
    })

  const addNote = async (body: string) => {
    const r = await backend.addIssueNote(issue.id, body)
    if (r.ok) {
      onPatch((d) => ({ ...d, issue: r.value }))
      return null
    }
    return `${r.message} Your note wasn't saved; it's still in the box.`
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e) || menu || e.metaKey || e.ctrlKey) return
      const k = e.key
      if (k === "[") void step("newer")
      else if (k === "]") void step("older")
      else if (k === "e") void act(issue.status === "unresolved" ? { kind: "resolve" } : { kind: "reopen" })
      else if (k === "i") void act({ kind: "ignore" })
      else if (k === "j" && place?.next) navigate(`/issues/${place.next}`)
      else if (k === "k" && place?.prev) navigate(`/issues/${place.prev}`)
      else if (k === "s") {
        e.preventDefault()
        setMenu("snooze")
      } else if (k === "a") {
        e.preventDefault()
        setMenu("assign")
      } else if (k === "l") {
        e.preventDefault()
        setMenu("label")
      } else if (k === "n") {
        e.preventDefault()
        setNoteFocus((n) => n + 1)
      } else if (k === "Escape") navigate(back)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <>
      <TopBar crumbs={crumbs} />
      <IssueHeader
        issue={issue}
        project={project}
        assignable={data.assignable}
        me={me}
        busy={busy}
        menu={menu}
        setMenu={setMenu}
        onAct={(c) => void act(c)}
        onMerge={() => {
          setMenu(null)
          setMerging(true)
        }}
        backTo={back}
        backLabel={backLabelOf(back)}
        place={place}
        releases={data.releases}
      />
      <MergeDialog
        open={merging}
        onOpenChange={setMerging}
        issue={issue}
        onMerged={(target) => {
          toast({
            tone: "ok",
            body: (
              <>
                Merged {issue.shortId} into {target.shortId}.
              </>
            ),
          })
          navigate(`/issues/${target.id}`, { replace: true })
        }}
      />

      <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="flex min-w-0 flex-col gap-8 px-4 py-6 md:px-6 xl:border-r xl:border-hairline">
          <Section title="Last 30 days" aside={`${plural(data.releases.filter((r) => r.source === "deploy").length, "deploy")} in ${project.name.length > 24 ? "this project" : project.name}`}>
            <History series={data.history} releases={data.releases} level={issue.level} />
          </Section>
          <div className="border-t border-hairline pt-6">
            <EventNav event={ev.event} cursor={ev.cursor} loading={loadingEvent} onStep={(s) => void step(s)} />
          </div>
          <EventBody event={ev.event} related={ev.related} projectId={project.id} repoUrl={project.repoUrl} loading={loadingEvent} />
        </main>

        <aside className="flex min-w-0 flex-col gap-8 border-t border-hairline px-4 py-6 md:px-6 xl:border-t-0">
          <Section title="Triage" aside={issue.triages.length > 0 ? plural(issue.triages.length, "triage") : undefined} id="triage">
            <Triages issue={issue as Issue} me={me} owner={owner} repoUrl={project.repoUrl} onSaved={triageSaved} onReload={onReload} onShip={() => void act({ kind: "fix_shipped" })} />
          </Section>
          <Section title="Who and where" aside={`across ${issue.eventCount.toLocaleString("en-US")} events`}>
            <Tags tags={issue.tags} eventCount={issue.eventCount} projectId={project.id} releases={data.releases} />
          </Section>
          <Section
            title="Activity"
            aside={
              <span className="flex items-center gap-1">
                note <Kbd>n</Kbd>
              </span>
            }
          >
            <div className="flex flex-col gap-4">
              <NoteComposer onSubmit={addNote} focusKey={noteFocus} />
              <ActivityLog activity={(issue as Issue).activity} me={me} repoUrl={project.repoUrl} />
            </div>
          </Section>
        </aside>
      </div>
    </>
  )
}

function DetailSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-4 p-4 md:p-6">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-4 w-64" />
      <div className="flex gap-2">
        {["w-24", "w-20", "w-22", "w-22"].map((w, i) => (
          <Skeleton key={i} className={`h-8 ${w}`} />
        ))}
      </div>
      <Skeleton className="mt-6 h-24" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-8" />
      ))}
    </div>
  )
}
