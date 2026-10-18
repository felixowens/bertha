import { useState } from "react"
import { Check, EyeOff, AlarmClock, UserRound, RotateCcw, ArrowLeft } from "lucide-react"
import type { Issue, Person, Project } from "../../contract/domain"
import type { IssueChange } from "../../contract/actions"
import { Button } from "@/components/ui/button"
import { Avatar, Kbd, Mono, Square, toneText } from "@/components/ui/primitives"
import { AssignMenu, SnoozeMenu } from "@/components/issues/TriageMenus"
import { readout } from "@/components/issues/IssueLine"
import { compact, ago, snoozeText, stamp, version } from "@/lib/format"
import { levelLabel, levelTone, statusLabel } from "@/lib/meaning"
import { Link } from "@/lib/router"

export type Menu = "snooze" | "assign" | null

export function IssueHeader({
  issue,
  project,
  assignable,
  me,
  busy,
  menu,
  setMenu,
  onAct,
  backTo,
}: {
  issue: Issue
  project: Project
  assignable: Person[]
  me: string
  busy: boolean
  menu: Menu
  setMenu: (m: Menu) => void
  onAct: (c: IssueChange) => void
  backTo: string
}) {
  const r = readout(issue)
  const open = issue.status === "unresolved"
  const [copied, setCopied] = useState(false)

  return (
    <header className="border-b border-hairline px-4 pt-5 pb-6 md:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <Link to={backTo} className="-ml-1 flex items-center gap-1 rounded px-1 py-0.5 text-faint hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Issues <Kbd className="ml-1 max-sm:hidden">esc</Kbd>
        </Link>
        <button
          className="font-mono text-muted-foreground hover:text-foreground"
          title="Copy id"
          onClick={() => {
            void navigator.clipboard?.writeText(issue.shortId)
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          }}
        >
          {copied ? "copied" : issue.shortId}
        </button>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Square tone={levelTone[issue.level]} />
          {levelLabel[issue.level]}
        </span>
        <Mono className={toneText[r.tone]}>{r.text}</Mono>
        {!open && (
          <span className="rounded-[3px] border border-border px-1.5 py-px text-muted-foreground">
            {statusLabel[issue.status]}
            {issue.snooze && ` ${snoozeText(issue.snooze)}`}
          </span>
        )}
      </div>

      <h1 className="max-w-[72ch] text-lg leading-snug text-pretty break-words text-foreground md:text-xl">
        <span className="font-medium">{issue.type}</span> <span className="text-muted-foreground">{issue.message}</span>
      </h1>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm text-faint">
        <Link to={`/issues?project=${project.id}`} className="truncate text-muted-foreground hover:text-foreground">
          {project.name}
        </Link>
        {issue.culprit && <Mono className="text-xs break-all">· {issue.culprit}</Mono>}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {open ? (
          <Button disabled={busy} onClick={() => onAct({ kind: "resolve" })}>
            <Check /> Resolve <Kbd className="ml-1 max-sm:hidden border-transparent bg-primary-foreground/10 text-primary-foreground/70">e</Kbd>
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => onAct({ kind: "reopen" })}>
            <RotateCcw /> Reopen
          </Button>
        )}
        {issue.status !== "ignored" && (
          <Button variant="outline" disabled={busy} onClick={() => onAct({ kind: "ignore" })}>
            <EyeOff /> Ignore <Kbd className="ml-1 max-sm:hidden">i</Kbd>
          </Button>
        )}
        <SnoozeMenu
          open={menu === "snooze"}
          onOpenChange={(o) => setMenu(o ? "snooze" : null)}
          onPick={(snooze) => onAct({ kind: "snooze", snooze })}
          trigger={
            <Button variant="outline" disabled={busy}>
              <AlarmClock /> Snooze <Kbd className="ml-1 max-sm:hidden">s</Kbd>
            </Button>
          }
        />
        <AssignMenu
          open={menu === "assign"}
          onOpenChange={(o) => setMenu(o ? "assign" : null)}
          people={assignable}
          me={me}
          current={issue.assignee?.id ?? null}
          onPick={(personId) => onAct({ kind: "assign", personId })}
          trigger={
            <Button variant="outline" disabled={busy}>
              {issue.assignee ? <Avatar name={issue.assignee.name} className="size-4" /> : <UserRound />}
              {issue.assignee ? (issue.assignee.id === me ? "You" : issue.assignee.name) : "Assign"} <Kbd className="ml-1 max-sm:hidden">a</Kbd>
            </Button>
          }
        />
      </div>

      {open && issue.level === "warning" && issue.eventCount >= 10000 && (
        <p className="mt-3 text-xs text-faint">
          <Mono className="text-muted-foreground">{compact(issue.eventCount)}</Mono> warnings and no stack: usually browser noise. Ignoring it keeps it out of the inbox and the counts.
        </p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Fig k="Events" v={compact(issue.eventCount)} />
        <Fig k="Users" v={compact(issue.userCount)} />
        <Fig k="First seen" v={ago(issue.firstSeen)} sub={issue.firstRelease ? version(issue.firstRelease) : stamp(issue.firstSeen)} />
        <Fig k="Last seen" v={ago(issue.lastSeen)} sub={issue.regressedIn ? `back in ${version(issue.regressedIn)}` : stamp(issue.lastSeen)} subTone={issue.regressedIn ? "text-danger" : undefined} />
      </dl>
    </header>
  )
}

function Fig({ k, v, sub, subTone }: { k: string; v: string; sub?: string; subTone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="mt-1 text-[22px] leading-none font-light tracking-[-0.02em] text-foreground tabular">{v}</dd>
      {sub && <dd className={`mt-1.5 truncate font-mono text-xs ${subTone ?? "text-faint"}`}>{sub}</dd>}
    </div>
  )
}
