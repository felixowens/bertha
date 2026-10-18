import { useCallback, useState } from "react"
import type { IssueSummary, Snooze } from "../../contract/domain"
import type { IssueChange } from "../../contract/actions"
import { backend } from "@/data/backend"
import { toast } from "@/components/ui/toast"
import { Mono } from "@/components/ui/primitives"
import { now } from "@/lib/clock"
import { snoozeText } from "@/lib/format"
import { useShell } from "@/components/shell/ShellContext"

/** Snooze presets: a date, or a number of further events. */
export const SNOOZES: { label: string; hint: string; snooze: () => Snooze }[] = [
  { label: "Until tomorrow", hint: "24h", snooze: () => ({ kind: "until", until: new Date(now() + 864e5).toISOString() }) },
  { label: "Until next week", hint: "7d", snooze: () => ({ kind: "until", until: new Date(now() + 7 * 864e5).toISOString() }) },
  { label: "For 10 more events", hint: "10", snooze: () => ({ kind: "events", total: 10, remaining: 10 }) },
  { label: "For 100 more events", hint: "100", snooze: () => ({ kind: "events", total: 100, remaining: 100 }) },
]

const verb = (c: IssueChange, n: number) => {
  const what = n === 1 ? "" : ` ${n} issues`
  switch (c.kind) {
    case "resolve":
      return c.inNextRelease ? `Resolved${what} in the next release` : `Resolved${what}`
    case "ignore":
      return `Ignored${what}`
    case "reopen":
      return `Reopened${what}`
    case "snooze":
      return `Snoozed${what} ${snoozeText(c.snooze)}`
    case "assign":
      return c.personId ? `Assigned${what}` : `Unassigned${what}`
  }
}

/** The change that puts things back, when there's a single obvious one. */
function inverse(c: IssueChange, before: IssueSummary[]): IssueChange | null {
  if (c.kind === "assign") {
    const prev = new Set(before.map((i) => i.assignee?.id ?? null))
    return prev.size === 1 ? { kind: "assign", personId: [...prev][0] } : null
  }
  if (c.kind === "reopen") return null
  return before.every((i) => i.status === "unresolved") ? { kind: "reopen" } : null
}

/**
 * Resolve / ignore / snooze / assign, singly or in bulk, with undo on `z` and a
 * named, calm response to each failure. All-or-nothing, as the contract says.
 */
export function useTriage(onChanged: (updated: IssueSummary[] | null) => void) {
  const [busy, setBusy] = useState(false)
  // Sidebar counts and saved views change with every triage.
  const { reload: reloadShell } = useShell()

  const run = useCallback(
    async (targets: IssueSummary[], change: IssueChange, opts: { undo?: boolean } = { undo: true }) => {
      if (!targets.length) return false
      setBusy(true)
      const r = await backend.updateIssues(
        targets.map((t) => t.id),
        change,
      )
      setBusy(false)
      if (r.ok) {
        onChanged(r.value)
        reloadShell()
        const back = opts.undo ? inverse(change, targets) : null
        toast({
          tone: change.kind === "resolve" ? "ok" : "quiet",
          body: (
            <>
              {verb(change, targets.length)}
              {targets.length === 1 && <Mono className="text-muted-foreground"> {targets[0].shortId}</Mono>}
            </>
          ),
          action: back ? { label: "Undo", key: "z", run: () => void run(targets, back, { undo: false }) } : undefined,
        })
        return true
      }
      // Nothing changed: say why, then show the current state.
      const tone = r.failure === "conflict" ? "warn" : "danger"
      toast(
        {
          tone,
          body: (
            <>
              {r.message} <span className="text-muted-foreground">Nothing was changed.</span>
            </>
          ),
        },
        8000,
      )
      onChanged(null)
      return false
    },
    [onChanged, reloadShell],
  )

  return { run, busy }
}
