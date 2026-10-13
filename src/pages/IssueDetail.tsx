import { useCallback, useEffect, useState } from "react"
import type { Event, EventCursor, Issue, IssueSummary } from "../../packet/contract/domain"
import type { IssueDetailPage } from "../../packet/contract/pages"
import type { IssueChange } from "../../packet/contract/actions"
import { backend } from "@/data/backend"
import { usePageLoadable, type Ready } from "@/data/useLoadable"
import { TopBar } from "@/components/shell/TopBar"
import { useShell } from "@/components/shell/ShellContext"
import { typing } from "@/components/shell/Shortcuts"
import { useTriage } from "@/components/issues/triage"
import { IssueHeader, type Menu } from "@/components/issue/IssueHeader"
import { History } from "@/components/issue/History"
import { EventBody, EventNav, Section, type Step } from "@/components/issue/EventPane"
import { Tags } from "@/components/issue/Tags"
import { ActivityLog, NoteComposer } from "@/components/issue/ActivityLog"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/primitives"
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states"
import { Link, navigate } from "@/lib/router"
import { plural } from "@/lib/format"

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

export function IssueDetail({ issueId }: { issueId: string }) {
  const shell = useShell()
  const page = usePageLoadable<Data>("/issues/:issueId", () => backend.getIssue(issueId), [issueId])
  const { state } = page
  const [back] = useState(backHref)

  const crumbs = [{ label: "Issues", to: back }, { label: state.status === "ready" ? state.data.issue.shortId : "…" }]

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
        <TopBar crumbs={[{ label: "Issues", to: back }, { label: "Not found" }]} />
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

  return <Ready data={state.data} me={shell.viewer.id} back={back} crumbs={crumbs} onReload={page.reload} onPatch={page.set} />
}

function Ready({
  data,
  me,
  back,
  crumbs,
  onReload,
  onPatch,
}: {
  data: Data
  me: string
  back: string
  crumbs: { label: string; to?: string }[]
  onReload: () => void
  onPatch: (fn: (d: Data) => Data) => void
}) {
  const { issue, project } = data
  const [ev, setEv] = useState<{ event: Event; cursor: EventCursor }>({ event: data.event, cursor: data.cursor })
  const [loadingEvent, setLoadingEvent] = useState(false)
  const [menu, setMenu] = useState<Menu>(null)
  const [noteFocus, setNoteFocus] = useState(0)

  const onChanged = useCallback(
    (updated: IssueSummary[] | null) => {
      if (!updated) return onReload()
      const u = updated.find((x) => x.id === issue.id)
      if (u) onPatch((d) => ({ ...d, issue: { ...d.issue, ...u } }))
    },
    [issue.id, onReload, onPatch],
  )
  const { run, busy } = useTriage(onChanged)
  const act = (change: IssueChange) => {
    setMenu(null)
    void run([issue], change)
  }

  const step = async (s: Step) => {
    const { cursor } = ev
    const which = s === "latest" || s === "oldest" ? s : s === "newer" ? (cursor.newerId ? { eventId: cursor.newerId } : null) : cursor.olderId ? { eventId: cursor.olderId } : null
    if (!which) return
    setLoadingEvent(true)
    const next = await backend.getEvent(issue.id, which)
    setEv(next)
    setLoadingEvent(false)
  }

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
      else if (k === "e") act(issue.status === "unresolved" ? { kind: "resolve" } : { kind: "reopen" })
      else if (k === "i") act({ kind: "ignore" })
      else if (k === "s") {
        e.preventDefault()
        setMenu("snooze")
      } else if (k === "a") {
        e.preventDefault()
        setMenu("assign")
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
      <IssueHeader issue={issue} project={project} assignable={data.assignable} me={me} busy={busy} menu={menu} setMenu={setMenu} onAct={act} backTo={back} />

      <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="flex min-w-0 flex-col gap-8 px-4 py-6 md:px-6 xl:border-r xl:border-hairline">
          <Section title="Last 30 days" aside={`${plural(data.releases.length, "deploy")} in ${project.name.length > 24 ? "this project" : project.name}`}>
            <History series={data.history} releases={data.releases} level={issue.level} />
          </Section>
          <div className="border-t border-hairline pt-6">
            <EventNav event={ev.event} cursor={ev.cursor} loading={loadingEvent} onStep={(s) => void step(s)} />
          </div>
          <EventBody event={ev.event} projectId={project.id} loading={loadingEvent} />
        </main>

        <aside className="flex min-w-0 flex-col gap-8 border-t border-hairline px-4 py-6 md:px-6 xl:border-t-0">
          <Section title="Who and where" aside={`across ${issue.eventCount.toLocaleString("en-US")} events`}>
            <Tags tags={issue.tags} eventCount={issue.eventCount} />
          </Section>
          <Section title="Activity" aside={<span className="flex items-center gap-1">note <Kbd>n</Kbd></span>}>
            <div className="flex flex-col gap-4">
              <NoteComposer onSubmit={addNote} focusKey={noteFocus} />
              <ActivityLog activity={(issue as Issue).activity} me={me} />
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
