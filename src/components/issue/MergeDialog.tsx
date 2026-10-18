import { useEffect, useState } from "react"
import { cn } from "cn"
import type { Issue, IssueSummary } from "../../contract/domain"
import { backend } from "@/data/backend"
import { DEFAULT_FILTER } from "@/components/issues/filters"
import { Button } from "@/components/ui/button"
import { Dialog, Input } from "@/components/ui/form"
import { LevelGlyph, Mono } from "@/components/ui/primitives"
import { InlineError, Skeleton } from "@/components/ui/states"
import { ago, compact } from "@/lib/format"

/** Fold this issue into another one in the same project; future events follow. */
export function MergeDialog({ open, onOpenChange, issue, onMerged }: { open: boolean; onOpenChange: (o: boolean) => void; issue: Issue; onMerged: (target: Issue) => void }) {
  const [query, setQuery] = useState("")
  const [list, setList] = useState<IssueSummary[] | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let gone = false
    const t = setTimeout(() => {
      void backend
        .listIssues({
          ...DEFAULT_FILTER,
          projectIds: [issue.projectId],
          status: "all",
          range: "30d",
          query: query.trim(),
        })
        .then((r) => {
          if (!gone) setList(r.issues.filter((i) => i.id !== issue.id).slice(0, 30))
        })
    }, 150)
    return () => {
      gone = true
      clearTimeout(t)
    }
  }, [open, query, issue.id, issue.projectId])

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

  const target = list?.find((i) => i.id === pick)
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Merge ${issue.shortId} into…`}
      description="Its events, notes and fingerprint move to the issue you pick, and new events like it land there too. This issue goes away."
    >
      <div className="flex flex-col gap-3">
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this project's issues" aria-label="Search issues" />
        <ul className="-mx-1 flex max-h-72 flex-col gap-0.5 overflow-y-auto" role="listbox" aria-label="Issues">
          {list === null ? (
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="mx-1 h-10" />)
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
