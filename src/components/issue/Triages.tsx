import { useEffect, useState } from "react"
import { cn } from "cn"
import { ChevronDown, Play } from "lucide-react"
import { DropdownMenu } from "radix-ui"
import type { Issue, Person, Triage } from "../../contract/domain"
import type { TriageInput } from "../../contract/actions"
import { backend } from "@/data/backend"
import { Button } from "@/components/ui/button"
import { Mono, Square } from "@/components/ui/primitives"
import { menuContent, menuItem } from "@/components/ui/menu"
import { Collapse } from "@/components/ui/motion"
import { ProseInput } from "@/components/ui/prose"
import { toast } from "@/components/ui/toast"
import { ago, date, since, stamp, version } from "@/lib/format"
import { Markdown } from "@/lib/markdown"
import { fixTone, outcomeHint, outcomeLabel, outcomeTone, triageStateTone } from "@/lib/meaning"
import { FixRef, FixStatus } from "./Fix"

type Outcome = NonNullable<Triage["outcome"]>
const FINISH: Outcome[] = ["fixed", "not_a_bug", "cant_fix", "needs_data", "abandoned"]
const FIELDS = [
  { key: "found", label: "Found", placeholder: "The cause, and anything bertha didn't capture that you needed." },
  { key: "tried", label: "Tried", placeholder: "What didn't work, so the next person skips it." },
  { key: "fix", label: "Fix", placeholder: "The change, with its PR or commit." },
] as const

const who = (p: Person, via: string | null, me: string) => `${p.id === me ? "You" : p.name}${via ? ` via ${via}` : ""}`

/**
 * What people and agents learned each time they looked at this issue, and who's on it
 * now. A triage claims the issue so two people don't chase the same error.
 */
export function Triages({
  issue,
  me,
  owner,
  repoUrl,
  onSaved,
  onReload,
  onShip,
}: {
  issue: Issue
  me: string
  owner: boolean
  repoUrl: string | null
  /** The triage as the server now has it. */
  onSaved: (t: Triage) => void
  onReload: () => void
  /** Marks the latest fix shipped, which resolves the issue. */
  onShip: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const open = issue.triages.find((t) => t.state !== "done") ?? null
  const earlier = issue.triages.filter((t) => t.state === "done")
  // Only the latest fix can be marked shipped, and only while the issue is open.
  const latestFix = earlier.find((t) => t.outcome === "fixed")
  const shippable = latestFix && latestFix.watch?.state !== "shipped" && issue.status !== "resolved" ? latestFix.id : null
  // Your own triage from the app is yours to write. One your agent started is the agent's.
  const mine = open !== null && open.by.id === me && open.via === null
  useEffect(() => setConfirm(false), [open?.id])

  const failed = (message: string) => {
    toast(
      {
        tone: "warn",
        body: (
          <>
            {message} <span className="text-muted-foreground">Nothing was changed.</span>
          </>
        ),
      },
      8000,
    )
    onReload()
  }

  const start = async (takeOver?: true) => {
    setBusy(true)
    const r = await backend.startTriage(issue.id, takeOver)
    setBusy(false)
    setConfirm(false)
    if (!r.ok) return failed(r.message)
    // Taking over closed someone else's triage: read the whole list again.
    if (open && open.id !== r.value.id) onReload()
    else onSaved(r.value)
  }

  const abandon = async (t: Triage) => {
    setBusy(true)
    const r = await backend.updateTriage(t.id, { outcome: "abandoned" })
    setBusy(false)
    if (!r.ok) return failed(r.message)
    onSaved(r.value)
    toast({ tone: "quiet", body: <>Marked {t.by.id === me ? "your" : `${t.by.name}'s`} triage abandoned.</> })
  }

  return (
    <div className="flex flex-col gap-4">
      {mine ? (
        <Editor triage={open} me={me} repoUrl={repoUrl} onSaved={onSaved} onFailed={failed} />
      ) : open ? (
        <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-3">
          <div className="flex items-start gap-2.5">
            <Square tone={triageStateTone[open.state]} hollow={open.state === "stale"} className="mt-[5px]" />
            <p className="min-w-0 text-sm text-pretty text-muted-foreground">
              {open.state === "active" ? (
                <>
                  {open.by.id === me ? (
                    <>
                      Your agent <Mono className="text-foreground">{open.via}</Mono> is on it.
                    </>
                  ) : (
                    <>
                      <span className="text-foreground">{who(open.by, open.via, me)}</span> is on it.
                    </>
                  )}{" "}
                  <span className="text-faint">
                    Started <Mono title={stamp(open.startedAt)}>{ago(open.startedAt)}</Mono>, last update <Mono title={stamp(open.updatedAt)}>{ago(open.updatedAt)}</Mono>.
                  </span>
                </>
              ) : (
                <>
                  <span className="text-foreground">{who(open.by, open.via, me)}</span> started this <Mono>{ago(open.startedAt)}</Mono> and hasn't updated it for{" "}
                  <Mono>{since(open.updatedAt)}</Mono>. Starting a triage closes theirs as abandoned.
                </>
              )}
            </p>
          </div>
          <Notes triage={open} repoUrl={repoUrl} />
          <div className="flex flex-wrap items-center gap-2">
            {open.state === "stale" ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void start()}>
                <Play /> Start triage
              </Button>
            ) : confirm ? (
              <>
                <span className="text-sm text-muted-foreground">{open.by.id === me ? "Take over from your agent? Its notes stay." : `Take over from ${open.by.name.split(" ")[0]}? Their notes stay.`}</span>
                <Button size="sm" disabled={busy} onClick={() => void start(true)}>
                  Take over
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm(true)} title="Only if they've stopped. Their triage ends as abandoned.">
                Take over
              </Button>
            )}
            {owner && !confirm && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void abandon(open)}>
                Mark abandoned
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void start()}>
            <Play /> Start triage
          </Button>
          <span className="text-xs text-faint">Claims it so nobody else starts on it.</span>
        </div>
      )}

      {earlier.length > 0 && (
        <ol className="flex flex-col">
          {earlier.map((t) => (
            <Earlier key={t.id} triage={t} me={me} repoUrl={repoUrl} onShip={t.id === shippable ? onShip : null} />
          ))}
        </ol>
      )}
      {!open && !earlier.length && <p className="text-xs text-pretty text-faint">Nobody has triaged this yet. What you find goes here for the next person, and their agents.</p>}
    </div>
  )
}

function Notes({ triage, repoUrl }: { triage: Triage; repoUrl: string | null }) {
  const filled = FIELDS.filter((f) => triage[f.key])
  if (!filled.length) return <p className="text-xs text-faint">Nothing written down yet.</p>
  return (
    <dl className="flex flex-col gap-3">
      {filled.map((f) => (
        <div key={f.key} className="min-w-0">
          <dt className="mb-1 text-xs text-faint">{f.label}</dt>
          <dd className="min-w-0 text-sm text-muted-foreground">
            <Markdown source={triage[f.key]!} repoUrl={repoUrl} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Editor({
  triage,
  me,
  repoUrl,
  onSaved,
  onFailed,
}: {
  triage: Triage
  me: string
  repoUrl: string | null
  onSaved: (t: Triage) => void
  onFailed: (message: string) => void
}) {
  const saved = { found: triage.found ?? "", tried: triage.tried ?? "", fix: triage.fix ?? "" }
  const [draft, setDraft] = useState(saved)
  const [busy, setBusy] = useState(false)
  const [finishing, setFinishing] = useState(false)
  useEffect(() => setDraft({ found: triage.found ?? "", tried: triage.tried ?? "", fix: triage.fix ?? "" }), [triage.id, triage.found, triage.tried, triage.fix])
  const changed = FIELDS.filter((f) => draft[f.key].trim() !== saved[f.key].trim())

  const save = async (outcome?: Outcome) => {
    const input: TriageInput = Object.fromEntries(changed.map((f) => [f.key, draft[f.key]]))
    if (outcome) input.outcome = outcome
    setBusy(true)
    const r = await backend.updateTriage(triage.id, input)
    setBusy(false)
    if (!r.ok) return onFailed(r.message)
    onSaved(r.value)
    const w = r.value.watch
    toast(
      {
        tone: outcome === "fixed" ? "ok" : "quiet",
        body: outcome ? (
          <>
            Triage finished: {outcomeLabel[outcome].toLowerCase()}.
            {w && (
              <span className="text-muted-foreground">
                {" "}
                {w.state === "waiting_merge" || w.state === "waiting_release" ? (
                  <>
                    bertha resolves the issue when <FixRef pr={w.pr} commit={w.commit} repoUrl={repoUrl} /> ships.
                  </>
                ) : (
                  "Mark the fix shipped once it's deployed."
                )}
              </span>
            )}
          </>
        ) : (
          <>Triage saved.</>
        ),
      },
      w ? 8000 : undefined,
    )
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-hairline bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (changed.length) void save()
      }}
    >
      <div className="flex items-start gap-2.5">
        <Square tone={triageStateTone[triage.state]} hollow={triage.state === "stale"} className="mt-[5px]" />
        <p className="text-sm text-pretty text-muted-foreground">
          {triage.state === "active" ? (
            <>
              <span className="text-foreground">{who(triage.by, triage.via, me)}</span> are on it, since <Mono title={stamp(triage.startedAt)}>{ago(triage.startedAt)}</Mono>.
            </>
          ) : (
            <>
              Your triage has had no update for <Mono>{since(triage.updatedAt)}</Mono>, so others can start over it. Saving picks it back up.
            </>
          )}
        </p>
      </div>
      {FIELDS.map((f) => (
        <div key={f.key} className="flex flex-col gap-1.5">
          <label htmlFor={`triage-${f.key}`} className="text-xs text-faint">
            {f.label}
          </label>
          <ProseInput
            id={`triage-${f.key}`}
            label={f.label}
            rows={3}
            value={draft[f.key]}
            placeholder={f.placeholder}
            repoUrl={repoUrl}
            onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
        <Button size="sm" type="submit" disabled={busy || !changed.length}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <DropdownMenu.Root open={finishing} onOpenChange={setFinishing}>
          <DropdownMenu.Trigger asChild>
            <Button size="sm" variant="outline" type="button" disabled={busy}>
              Finish as… <ChevronDown />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={6} className={cn(menuContent, "w-72")}>
              {FINISH.map((o) => (
                <DropdownMenu.Item key={o} className={cn(menuItem, "h-auto items-start py-1.5")} onSelect={() => void save(o)}>
                  <Square tone={outcomeTone[o]} hollow={outcomeTone[o] === "void"} className="mt-[5px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block">{outcomeLabel[o]}</span>
                    <span className="block text-xs text-pretty text-faint">{outcomeHint[o]}</span>
                  </span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        {changed.length > 0 && <span className="text-xs text-faint">Unsaved changes. Finishing saves them too.</span>}
      </div>
    </form>
  )
}

function Earlier({ triage, me, repoUrl, onShip }: { triage: Triage; me: string; repoUrl: string | null; onShip: (() => void) | null }) {
  const [open, setOpen] = useState(false)
  const outcome = triage.outcome ?? "abandoned"
  const empty = !triage.found && !triage.tried && !triage.fix
  return (
    <li className="border-t border-hairline first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        disabled={empty}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-2.5 py-2.5 text-left text-sm text-muted-foreground enabled:hover:text-foreground"
      >
        <Square tone={outcomeTone[outcome]} hollow={outcomeTone[outcome] === "void"} className="mt-[5px]" />
        <span className="min-w-0 flex-1">
          <span className="text-foreground">{outcomeLabel[outcome]}</span>
          <span className="text-faint"> · {who(triage.by, triage.via, me)}</span>
          <span className="mt-0.5 block font-mono text-xs text-faint">
            <span title={stamp(triage.updatedAt)}>{date(triage.updatedAt)}</span>
            {triage.release && <span title={triage.release}> · in {version(triage.release)}</span>}
            {empty && <span className="font-sans"> · no notes</span>}
          </span>
        </span>
        {!empty && <ChevronDown className={cn("mt-0.5 size-3.5 shrink-0 text-faint transition-[rotate] duration-200 ease-smooth", open && "rotate-180")} />}
      </button>
      {triage.watch && (
        <div className="-mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 pb-2.5 pl-[18px]">
          <p className="flex min-w-0 items-start gap-2 text-xs text-pretty text-muted-foreground">
            <Square tone={fixTone[triage.watch.state]} hollow={triage.watch.state === "waiting_merge" || triage.watch.state === "waiting_release"} className="mt-[4px] size-1.5" />
            <span className="min-w-0">
              <FixStatus watch={triage.watch} repoUrl={repoUrl} />
            </span>
          </p>
          {onShip && (
            <Button size="sm" variant="outline" onClick={onShip} title="Resolves the issue in the release running now. Events from older releases won't reopen it.">
              Mark shipped
            </Button>
          )}
        </div>
      )}
      <Collapse open={open}>
        <div className="pb-3 pl-[18px]">
          <Notes triage={triage} repoUrl={repoUrl} />
        </div>
      </Collapse>
    </li>
  )
}
