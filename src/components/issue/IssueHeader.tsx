import { useState } from "react"
import { cn } from "cn"
import { DropdownMenu } from "radix-ui"
import { Check, EyeOff, AlarmClock, UserRound, RotateCcw, ArrowLeft, ChevronDown, ChevronUp, Ellipsis, Link2, Merge } from "lucide-react"
import type { Issue, Person, Project, Release } from "../../contract/domain"
import type { IssueChange } from "../../contract/actions"
import { Button } from "@/components/ui/button"
import { Avatar, Kbd, LevelGlyph, Mono, toneText } from "@/components/ui/primitives"
import { MenuHint, menuContent, menuItem } from "@/components/ui/menu"
import { AssignMenu, SnoozeMenu } from "@/components/issues/TriageMenus"
import { readout } from "@/components/issues/IssueLine"
import { compact, ago, plural, snoozeText, stamp, version } from "@/lib/format"
import { levelHint, levelLabel, statusTone } from "@/lib/meaning"
import { Link } from "@/lib/router"

export type Menu = "snooze" | "assign" | "resolve" | "more" | null

/** Where this issue sits in the queue that opened it. */
export type Place = {
  index: number
  total: number
  prev: string | null
  next: string | null
}

/** "Resolved 2m ago by Ana", from the latest activity of that kind. */
function standing(issue: Issue, me: string): { text: string; tone: string } | null {
  if (issue.status === "snoozed")
    return {
      text: `Snoozed ${issue.snooze ? snoozeText(issue.snooze) : ""}`.trim(),
      tone: toneText[statusTone.snoozed],
    }
  if (issue.status !== "resolved" && issue.status !== "ignored") return null
  const a = issue.activity.find((x) => x.kind === issue.status)
  const by = a && "by" in a ? `${a.by.id === me ? "you" : a.by.name}${a.via ? ` via ${a.via}` : ""}` : null
  const word = issue.status === "resolved" ? "Resolved" : "Ignored"
  return {
    text: a ? `${word} ${ago(a.at)}${by ? ` by ${by}` : ""}` : word,
    tone: issue.status === "resolved" ? toneText[statusTone.resolved] : "text-faint",
  }
}

export function IssueHeader({
  issue,
  project,
  assignable,
  me,
  busy,
  menu,
  setMenu,
  onAct,
  onMerge,
  backTo,
  backLabel,
  place,
  releases,
}: {
  issue: Issue
  project: Project
  assignable: Person[]
  me: string
  busy: boolean
  menu: Menu
  setMenu: (m: Menu) => void
  onAct: (c: IssueChange) => void
  onMerge: () => void
  backTo: string
  backLabel: string
  place: Place | null
  releases: Release[]
}) {
  const r = readout(issue)
  const open = issue.status === "unresolved"
  const [copied, setCopied] = useState<"id" | "link" | null>(null)
  const copy = (what: "id" | "link", text: string) => {
    void navigator.clipboard?.writeText(text)
    setCopied(what)
    setTimeout(() => setCopied(null), 1200)
  }
  const st = standing(issue, me)
  const releaseLink = (v: string) => {
    const rel = releases.find((x) => x.version === v && x.projectId === project.id)
    return rel ? (
      <Link to={`/releases/${rel.id}`} className="underline-fade hover:text-foreground">
        {version(v)}
      </Link>
    ) : (
      version(v)
    )
  }

  return (
    <header className="border-b border-hairline px-4 pt-5 pb-6 md:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <Link to={backTo} className="-ml-1 flex items-center gap-1 rounded px-1 py-0.5 text-faint hover:text-foreground">
          <ArrowLeft className="size-3.5" /> {backLabel} <Kbd className="ml-1 max-sm:hidden">esc</Kbd>
        </Link>
        {place && (
          <span className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon-xs" disabled={!place.prev} aria-label="Previous issue" title="Previous issue (k)" asChild={!!place.prev}>
              {place.prev ? (
                <Link to={`/issues/${place.prev}`}>
                  <ChevronUp />
                </Link>
              ) : (
                <ChevronUp />
              )}
            </Button>
            <Button variant="ghost" size="icon-xs" disabled={!place.next} aria-label="Next issue" title="Next issue (j)" asChild={!!place.next}>
              {place.next ? (
                <Link to={`/issues/${place.next}`}>
                  <ChevronDown />
                </Link>
              ) : (
                <ChevronDown />
              )}
            </Button>
            <Mono className="ml-1 text-faint">
              {place.index + 1} of {place.total}
            </Mono>
          </span>
        )}
        <button className="press font-mono text-muted-foreground hover:text-foreground" title="Copy id" onClick={() => copy("id", issue.shortId)}>
          <span key={copied === "id" ? "c" : "i"} className="inline-block animate-appear">
            {copied === "id" ? "copied" : issue.shortId}
          </span>
        </button>
        <span className="flex items-center gap-1.5 text-muted-foreground" title={`${levelLabel[issue.level]}: ${levelHint[issue.level]}`}>
          <LevelGlyph level={issue.level} />
          {levelLabel[issue.level]}
        </span>
        <Mono className={toneText[r.tone]}>{r.text}</Mono>
        {st && <span className={st.tone}>{st.text}</span>}
      </div>

      <h1 className="max-w-[72ch] text-lg leading-snug text-pretty break-words text-foreground md:text-xl">
        <span className="font-medium">{issue.type}</span> <span className="text-muted-foreground">{issue.message}</span>
      </h1>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm text-faint">
        <Link to={`/projects/${project.id}`} className="truncate text-muted-foreground hover:text-foreground">
          {project.name}
        </Link>
        {issue.culprit && <Mono className="text-xs break-all">· {issue.culprit}</Mono>}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {open ? (
          <span className="flex">
            <Button disabled={busy} className="rounded-r-none" onClick={() => onAct({ kind: "resolve" })}>
              <Check /> Resolve <Kbd className="ml-1 max-sm:hidden border-transparent bg-primary-foreground/10 text-primary-foreground/70">e</Kbd>
            </Button>
            <DropdownMenu.Root open={menu === "resolve"} onOpenChange={(o) => setMenu(o ? "resolve" : null)}>
              <DropdownMenu.Trigger asChild>
                <Button disabled={busy} size="icon" className="rounded-l-none border-l border-primary-foreground/15" aria-label="More ways to resolve">
                  <ChevronDown />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="start" sideOffset={6} className={cn(menuContent, "w-72")}>
                  <DropdownMenu.Item className={menuItem} onSelect={() => onAct({ kind: "resolve" })}>
                    Resolve now
                    <MenuHint>e</MenuHint>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className={cn(menuItem, "h-auto flex-col items-start gap-0.5 py-1.5")} onSelect={() => onAct({ kind: "resolve", inNextRelease: true })}>
                    Resolve in the next release
                    <span className="text-xs text-faint">Events from the release running now won't reopen it.</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </span>
        ) : (
          <Button disabled={busy} onClick={() => onAct({ kind: "reopen" })}>
            <RotateCcw /> Reopen
          </Button>
        )}
        {issue.status !== "ignored" && (
          <Button variant="outline" disabled={busy} title="Hides it for good. Snooze hides it for a while." onClick={() => onAct({ kind: "ignore" })}>
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
        <DropdownMenu.Root open={menu === "more"} onOpenChange={(o) => setMenu(o ? "more" : null)}>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" size="icon" aria-label="More actions">
              <Ellipsis />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={6} className={cn(menuContent, "w-52")}>
              <DropdownMenu.Item className={menuItem} onSelect={() => copy("link", location.origin + `/issues/${issue.id}`)}>
                <Link2 className="size-4" /> {copied === "link" ? "Link copied" : "Copy link"}
              </DropdownMenu.Item>
              <DropdownMenu.Item className={menuItem} onSelect={onMerge}>
                <Merge className="size-4" /> Merge into…
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        {copied === "link" && <Mono className="text-xs text-faint">link copied</Mono>}
      </div>

      {open && issue.level === "warning" && issue.eventCount >= 10000 && (
        <p className="mt-3 text-xs text-faint">
          <Mono className="text-muted-foreground">{compact(issue.eventCount)}</Mono> warnings and no stack: usually browser noise. Ignoring it keeps it out of the inbox and the
          counts.
        </p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Fig k="Events" v={compact(issue.eventCount)} />
        <Fig k="Users" v={issue.userCount ? compact(issue.userCount) : "—"} sub={issue.userCount ? plural(issue.userCount, "user") : "no user data"} />
        <Fig k="First seen" v={ago(issue.firstSeen)} sub={issue.firstRelease ? <>in {releaseLink(issue.firstRelease)}</> : stamp(issue.firstSeen)} />
        <Fig
          k="Last seen"
          v={ago(issue.lastSeen)}
          sub={open && issue.regressedIn ? <>back in {releaseLink(issue.regressedIn)}</> : stamp(issue.lastSeen)}
          subTone={open && issue.regressedIn ? "text-danger" : undefined}
        />
      </dl>
    </header>
  )
}

function Fig({ k, v, sub, subTone }: { k: string; v: string; sub?: React.ReactNode; subTone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="mt-1 text-[22px] leading-none font-light tracking-[-0.02em] text-foreground tabular">{v}</dd>
      {sub && <dd className={`mt-1.5 truncate font-mono text-xs ${subTone ?? "text-faint"}`}>{sub}</dd>}
    </div>
  )
}
