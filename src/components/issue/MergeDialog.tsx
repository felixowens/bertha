import { useState } from "react"
import { cn } from "cn"
import type { Issue, IssueSummary } from "../../contract/domain"
import { backend } from "@/data/backend"
import { useLoadable } from "@/data/useLoadable"
import { useDraft } from "@/lib/useDraft"
import { DEFAULT_FILTER } from "@/components/issues/filters"
import { Button } from "@/components/ui/button"
import { Dialog, Input } from "@/components/ui/form"
import { LevelGlyph, Mono } from "@/components/ui/primitives"
import { InlineError, Skeleton } from "@/components/ui/states"
import { ago, compact } from "@/lib/format"

/** Fold this issue into another one in the same project; future events follow. */
export function MergeDialog({ open, onOpenChange, issue, onMerged }: { open: boolean; onOpenChange: (o: boolean) => void; issue: Issue; onMerged: (target: Issue) => void }) {
  const [search, setSearch] = useState("")
  const [query, setQuery] = useDraft(search, 150, setSearch)
  const [pick, setPick] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const found = useLoadable<IssueSummary[]>(
    async () => {
      const r = await backend.listIssues({ ...DEFAULT_FILTER, projectIds: [issue.projectId], status: "all", range: "30d", query: search.trim() })
      return r.issues.filter((i) => i.id !== issue.id).slice(0, 30)
    },
    [search, issue.id, issue.projectId],
    { enabled: open },
  )
  const list = found.state.status === "ready" ? found.state.data : []

  const merge = async () => {
    if (!pick) return
    setBusy(true)
    setError(null)
    const r = await backend.mergeIssues(pick, [issue.id])
    setBusy(false)
    if (r.ok) {
      onOpenChange(false)
      onMerged(r.value)
    } else setError(r.message)
  }

  const target = list.find((i) => i.id === pick)
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Merge ${issue.shortId} into…`}
      description={`Moves all events and notes into the selected issue and deletes ${issue.shortId}. Future occurrences group there too.`}
    >
      <div className="flex flex-col gap-3">
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this project's issues" aria-label="Search issues" />
        <ul className="-mx-1 flex max-h-72 flex-col gap-0.5 overflow-y-auto" role="listbox" aria-label="Issues">
          {found.state.status === "loading" ? (
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="mx-1 h-10" />)
          ) : found.state.status === "error" ? (
            <li className="flex items-center justify-between gap-3 px-2 py-3">
              <InlineError>{found.state.message}</InlineError>
              <Button type="button" variant="ghost" size="sm" onClick={found.reload}>
                Try again
              </Button>
            </li>
          ) : list.length === 0 ? (
            <li className="px-2 py-3 text-sm text-faint">No other issues match.</li>
          ) : (
            list.map((i) => (
              <li key={i.id} role="option" aria-selected={pick === i.id}>
                <button
                  type="button"
                  onClick={() => setPick(i.id)}
                  className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-raised", pick === i.id && "bg-raised")}
                >
                  <LevelGlyph level={i.level} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">
                      <span className="font-medium">{i.type}</span> <span className="text-muted-foreground">{i.message}</span>
                    </span>
                    <Mono className="block truncate text-xs text-faint">
                      {i.shortId} · {compact(i.eventCount)} events · last {ago(i.lastSeen)}
                    </Mono>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        {error && <InlineError>{error}</InlineError>}
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!pick || busy} onClick={() => void merge()}>
            {busy ? "Merging…" : target ? `Merge into ${target.shortId}` : "Merge"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
