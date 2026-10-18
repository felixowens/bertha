import { useState, useRef, useEffect } from "react"
import type { Activity, Person } from "../../contract/domain"
import { Button } from "@/components/ui/button"
import { Avatar, Kbd, Mono, Square, type Tone } from "@/components/ui/primitives"
import { InlineError } from "@/components/ui/states"
import { ago, snoozeText, stamp } from "@/lib/format"
import { Markdown } from "@/lib/markdown"

function line(a: Activity, me: string): { tone: Tone; text: React.ReactNode } {
  const who = (p: Person) => (p.id === me ? "You" : p.name)
  switch (a.kind) {
    case "first_seen":
      return { tone: "warn", text: <>First seen{a.release && <> in <Mono className="text-foreground">{a.release}</Mono></>}</> }
    case "regressed":
      return { tone: "danger", text: <>Came back{a.release && <> in <Mono className="text-foreground">{a.release}</Mono></>} after being resolved</> }
    case "resolved":
      return { tone: "quiet", text: <>{who(a.by)} resolved it</> }
    case "ignored":
      return { tone: "void", text: <>{who(a.by)} ignored it</> }
    case "reopened":
      return { tone: "quiet", text: <>{who(a.by)} reopened it</> }
    case "snoozed":
      return { tone: "warn", text: <>{who(a.by)} snoozed it {snoozeText(a.snooze)}</> }
    case "unsnoozed":
      return { tone: "warn", text: a.reason === "date_passed" ? "Snooze ended: the date passed" : "Snooze ended: the event threshold was reached" }
    case "assigned":
      return { tone: "quiet", text: a.to ? <>{who(a.by)} assigned it to {a.to.id === me ? "you" : a.to.name}</> : <>{who(a.by)} unassigned it</> }
    case "note":
      return { tone: "fg", text: <>{who(a.by)} wrote</> }
  }
}

export function NoteComposer({ onSubmit, focusKey }: { onSubmit: (body: string) => Promise<string | null>; focusKey: number }) {
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (focusKey) ref.current?.focus()
  }, [focusKey])

  const submit = async () => {
    if (!body.trim() || busy) return
    setBusy(true)
    setError(null)
    const err = await onSubmit(body.trim())
    setBusy(false)
    if (err) setError(err)
    else setBody("")
  }

  return (
    <div className="rounded-lg border border-hairline bg-card focus-within:border-input">
      <textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit()
          if (e.key === "Escape") ref.current?.blur()
        }}
        rows={3}
        placeholder="Leave a note for whoever picks this up…"
        aria-label="Note"
        className="block w-full resize-y bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-faint"
      />
      <div className="flex items-center justify-between gap-2 border-t border-hairline px-3 py-2">
        <span className="text-xs text-faint">Markdown: `code`, **bold**, - lists</span>
        <Button size="sm" variant="outline" disabled={!body.trim() || busy} onClick={() => void submit()}>
          {busy ? "Saving…" : "Add note"} <Kbd className="ml-1">⌘↵</Kbd>
        </Button>
      </div>
      {error && <InlineError className="border-t border-hairline px-3 py-2">{error}</InlineError>}
    </div>
  )
}

/** The issue's story, newest first: lifecycle as one-liners, notes in full. */
export function ActivityLog({ activity, me }: { activity: Activity[]; me: string }) {
  return (
    <ol className="relative flex flex-col">
      <span aria-hidden className="absolute top-2 bottom-2 left-[3px] w-px bg-hairline" />
      {activity.map((a, i) => {
        const l = line(a, me)
        return (
          <li key={i} className="relative flex gap-3 py-2 pl-0">
            <Square tone={l.tone} className="relative mt-[5px] size-[7px] shrink-0 ring-4 ring-background" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  {a.kind === "note" && <Avatar name={a.by.name} className="size-5" />}
                  {l.text}
                </span>
                <Mono className="text-xs text-faint" title={stamp(a.at)}>
                  {ago(a.at)}
                </Mono>
              </div>
              {a.kind === "note" && (
                <div className="mt-2 rounded-lg border border-hairline bg-card px-3 py-2.5">
                  <Markdown source={a.body} />
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
