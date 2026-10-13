import { useCallback, useEffect, useMemo, useState } from "react"
import { cn } from "cn"
import { Check, EyeOff, UserRound, AlarmClock, X } from "lucide-react"
import type { IssueFilter, IssueSummary } from "../../packet/contract/domain"
import type { IssuesPage } from "../../packet/contract/pages"
import { backend, scenario } from "@/data/backend"
import { scenarioState, useLoadable, type Ready } from "@/data/useLoadable"
import { TopBar } from "@/components/shell/TopBar"
import { useShell, projectName } from "@/components/shell/ShellContext"
import { typing } from "@/components/shell/Shortcuts"
import { FilterBar } from "@/components/issues/FilterBar"
import { IssueRow, ROW_GRID } from "@/components/issues/IssueRow"
import { AssignMenu, SnoozeMenu } from "@/components/issues/TriageMenus"
import { useTriage } from "@/components/issues/triage"
import { filterFromQuery, isDefault, queryFromFilter, DEFAULT_FILTER } from "@/components/issues/filters"
import { Button } from "@/components/ui/button"
import { Kbd, Mono } from "@/components/ui/primitives"
import { CheckBox } from "@/components/ui/menu"
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states"
import { navigate, useLocation } from "@/lib/router"
import type { IssueChange } from "../../packet/contract/actions"

type List = Ready<IssuesPage["list"]>

const stillMatches = (i: IssueSummary, f: IssueFilter) => f.status === "all" || i.status === f.status

export function Issues() {
  const shell = useShell()
  const { query } = useLocation()
  const filter = useMemo(() => filterFromQuery(query, shell.savedViews, scenario.params), [query, shell.savedViews])
  const key = JSON.stringify(filter)
  const live = useLoadable<List>(() => backend.listIssues(filter), [key])
  const override = scenarioState<IssuesPage>("/issues")?.list
  const state = override ?? live.state
  const view = shell.savedViews.find((v) => v.id === query.get("view"))

  const setFilter = (f: IssueFilter) => navigate(`/issues${queryFromFilter(f, query)}`, { replace: true })

  const issues = state.status === "ready" ? state.data.issues : []
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [cursor, setCursor] = useState(0)
  const [anchor, setAnchor] = useState<number | null>(null)
  const [menu, setMenu] = useState<"snooze" | "assign" | null>(null)
  useEffect(() => {
    setSelected(new Set())
    setCursor(0)
  }, [key])

  const onChanged = useCallback(
    (updated: IssueSummary[] | null) => {
      if (!updated) return live.reload()
      const byId = new Map(updated.map((u) => [u.id, u]))
      live.set((d) => {
        const next = d.issues.map((i) => byId.get(i.id) ?? i).filter((i) => stillMatches(i, filter))
        return { ...d, issues: next, total: d.total - (d.issues.length - next.length) }
      })
      setSelected(new Set())
    },
    [live, filter],
  )
  const { run, busy } = useTriage(onChanged)

  const targets = (): IssueSummary[] => (selected.size ? issues.filter((i) => selected.has(i.id)) : issues[cursor] ? [issues[cursor]] : [])
  const act = (change: IssueChange) => {
    setMenu(null)
    void run(targets(), change)
  }

  const toggle = (index: number, shift: boolean) => {
    const id = issues[index].id
    setSelected((s) => {
      const n = new Set(s)
      if (shift && anchor !== null) {
        const [a, b] = [Math.min(anchor, index), Math.max(anchor, index)]
        const on = !s.has(id)
        for (let k = a; k <= b; k++) (on ? n.add(issues[k].id) : n.delete(issues[k].id))
      } else if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
    setAnchor(index)
  }

  // Keyboard triage.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e) || !issues.length || menu) return
      const k = e.key
      const move = (d: number) => {
        e.preventDefault()
        setCursor((c) => {
          const n = Math.max(0, Math.min(issues.length - 1, c + d))
          document.querySelector(`[data-issue="${issues[n].id}"]`)?.scrollIntoView({ block: "nearest" })
          return n
        })
      }
      if (k === "j" || k === "ArrowDown") move(1)
      else if (k === "k" || k === "ArrowUp") move(-1)
      else if (k === "Enter" && issues[cursor]) navigate(`/issues/${issues[cursor].id}`)
      else if (k === "x") {
        e.preventDefault()
        toggle(cursor, e.shiftKey)
      } else if (k === "e") act({ kind: "resolve" })
      else if (k === "i") act({ kind: "ignore" })
      else if (k === "s") {
        e.preventDefault()
        setMenu("snooze")
      } else if (k === "a") {
        e.preventDefault()
        setMenu("assign")
      } else if (k === "Escape" && selected.size) setSelected(new Set())
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const allOn = issues.length > 0 && issues.every((i) => selected.has(i.id))
  const trendDays = filter.range === "30d" ? 30 : filter.range === "24h" ? 24 : 14
  const count = targets().length
  const me = shell.viewer

  return (
    <>
      <TopBar crumbs={view ? [{ label: "Issues", to: "/issues" }, { label: view.name }] : [{ label: "Issues" }]} />
      <FilterBar filter={filter} projects={shell.projects} total={state.status === "ready" ? state.data.total : state.status === "empty" ? 0 : null} onChange={setFilter} />

      {state.status === "error" && <ErrorState className="p-6 md:p-10" message={state.message} onRetry={live.reload} />}
      {state.status === "loading" && <ListSkeleton />}
      {state.status === "empty" &&
        (isDefault(filter) ? (
          <EmptyState className="p-6 md:p-10" title="Inbox zero.">
            Nothing unresolved across your projects. New errors land here the moment they arrive.
          </EmptyState>
        ) : (
          <EmptyState className="p-6 md:p-10" cells="void" title={filter.query ? `Nothing matches “${filter.query}”.` : "Nothing matches these filters."} action={<Button variant="outline" size="sm" onClick={() => setFilter(DEFAULT_FILTER)}>Clear filters</Button>}>
            {filter.status !== "all" ? "Try status “Any” to include resolved and ignored issues." : "Try a wider range or fewer filters."}
          </EmptyState>
        ))}

      {state.status === "ready" && (
        <div className="pb-24">
          <div className={cn(ROW_GRID, "sticky top-14 z-10 border-b border-hairline bg-background/95 px-4 py-2 text-xs text-faint backdrop-blur md:px-6")}>
            <button role="checkbox" aria-checked={allOn} aria-label="Select all" onClick={() => setSelected(allOn ? new Set() : new Set(issues.map((i) => i.id)))} className="-m-2 grid place-items-center p-2">
              <CheckBox checked={allOn} />
            </button>
            <span>Issue</span>
            <span className="hidden md:block">Trend</span>
            <span className="text-right">Events</span>
            <span className="hidden text-right md:block">Users</span>
            <span className="hidden text-right md:block">Last seen</span>
            <span className="hidden md:block" />
          </div>
          <ul>
            {issues.map((i, n) => (
              <IssueRow
                key={i.id}
                issue={i}
                projectName={projectName(shell, i.projectId)}
                selected={selected.has(i.id)}
                focused={n === cursor}
                onFocus={() => setCursor(n)}
                onToggle={(shift) => toggle(n, shift)}
                trendDays={trendDays}
              />
            ))}
          </ul>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-xs text-faint md:px-6">
            <span><Kbd>j</Kbd> <Kbd>k</Kbd> move</span>
            <span><Kbd>x</Kbd> select</span>
            <span><Kbd>e</Kbd> resolve</span>
            <span><Kbd>i</Kbd> ignore</span>
            <span><Kbd>s</Kbd> snooze</span>
            <span><Kbd>a</Kbd> assign</span>
            <span><Kbd>?</Kbd> all shortcuts</span>
          </p>
        </div>
      )}

      {/* Bulk bar: always present for keyboard menus; visible once something is selected. */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 transition-[translate,opacity] duration-150 ease-out-quart",
          selected.size || menu ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        <div role="toolbar" aria-label="Bulk actions" className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-2xl border border-border bg-popover p-1.5 shadow-pop">
          <span className="px-2 text-sm text-foreground">
            {selected.size ? (
              <>
                <Mono>{selected.size}</Mono> selected
              </>
            ) : (
              <Mono>{issues[cursor]?.shortId}</Mono>
            )}
          </span>
          <span className="mx-1 h-5 w-px bg-hairline" />
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => act({ kind: "resolve" })}>
            <Check /> Resolve <Kbd>e</Kbd>
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => act({ kind: "ignore" })}>
            <EyeOff /> Ignore <Kbd>i</Kbd>
          </Button>
          <SnoozeMenu
            open={menu === "snooze"}
            onOpenChange={(o) => setMenu(o ? "snooze" : null)}
            side="top"
            onPick={(s) => act({ kind: "snooze", snooze: s })}
            trigger={
              <Button size="sm" variant="ghost" disabled={busy || !count}>
                <AlarmClock /> Snooze <Kbd>s</Kbd>
              </Button>
            }
          />
          <AssignMenu
            open={menu === "assign"}
            onOpenChange={(o) => setMenu(o ? "assign" : null)}
            side="top"
            people={state.status === "ready" ? state.data.assignable : [{ id: me.id, name: me.name, email: me.email }]}
            me={me.id}
            onPick={(p) => act({ kind: "assign", personId: p })}
            trigger={
              <Button size="sm" variant="ghost" disabled={busy || !count}>
                <UserRound /> Assign <Kbd>a</Kbd>
              </Button>
            }
          />
          <span className="mx-1 h-5 w-px bg-hairline" />
          <Button size="icon-sm" variant="ghost" aria-label="Clear selection" onClick={() => setSelected(new Set())}>
            <X />
          </Button>
        </div>
      </div>
    </>
  )
}

function ListSkeleton() {
  return (
    <div aria-busy className="flex flex-col">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-hairline px-4 py-3.5 md:px-6">
          <Skeleton className="size-3.5" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className={cn("h-3.5", ["w-2/3", "w-1/2", "w-3/4", "w-2/5"][i % 4])} />
            <Skeleton className="h-2.5 w-48" />
          </div>
          <Skeleton className="hidden h-4 w-16 md:block" />
          <Skeleton className="h-3.5 w-10" />
        </div>
      ))}
    </div>
  )
}
