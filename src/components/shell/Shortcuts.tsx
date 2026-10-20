import { useEffect, useRef, useState } from "react"
import { Dialog } from "radix-ui"
import { navigate } from "@/lib/router"
import { Kbd, LevelGlyph, Square, type Tone } from "@/components/ui/primitives"
import { levelHint, levelLabel } from "@/lib/meaning"

const GO: Record<string, string> = { o: "/", p: "/projects", i: "/issues", r: "/releases", u: "/uptime", a: "/settings/alerts", t: "/settings/team" }

const SECTIONS: { title: string; keys: [string[], string][] }[] = [
  {
    title: "Go to",
    keys: [
      [["g", "o"], "Overview"],
      [["g", "p"], "Projects"],
      [["g", "i"], "Issues"],
      [["g", "r"], "Releases"],
      [["g", "u"], "Uptime"],
    ],
  },
  {
    title: "Issue list",
    keys: [
      [["j"], "Next issue"],
      [["k"], "Previous issue"],
      [["↵"], "Open"],
      [["x"], "Select"],
      [["/"], "Search"],
    ],
  },
  {
    title: "Triage (list or issue)",
    keys: [
      [["e"], "Resolve or reopen"],
      [["i"], "Ignore"],
      [["s"], "Snooze…"],
      [["a"], "Assign…"],
      [["l"], "Label…"],
      [["z"], "Undo last action"],
    ],
  },
  {
    title: "Issue",
    keys: [
      [["j"], "Next in the queue"],
      [["k"], "Previous in the queue"],
      [["["], "Newer event"],
      [["]"], "Older event"],
      [["n"], "Add a note"],
      [["esc"], "Back to list"],
    ],
  },
]

/** Colour is how things stand, not how loud an error is. */
const COLOURS: { tone: Tone; name: string; means: string }[] = [
  { tone: "danger", name: "Red", means: "Act now: down, regressed, a crash." },
  { tone: "warn", name: "Amber", means: "Look soon: degraded, new, a spike, snoozed." },
  { tone: "ok", name: "Green", means: "Fine: up, healthy, resolved, delivered." },
  { tone: "quiet", name: "Grey", means: "Everything else, including an ordinary error." },
]

export const typing = (e: KeyboardEvent) =>
  !!(e.target as HTMLElement).closest?.("input,textarea,select,[contenteditable],[role=dialog],[role=menu]") || e.metaKey || e.ctrlKey || e.altKey

export function Shortcuts() {
  const [open, setOpen] = useState(false)
  const pending = useRef<number | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e)) return
      if (e.key === "?") {
        e.preventDefault()
        setOpen(true)
        return
      }
      if (pending.current !== null) {
        window.clearTimeout(pending.current)
        pending.current = null
        const to = GO[e.key]
        if (to) {
          e.preventDefault()
          navigate(to)
        }
        return
      }
      if (e.key === "g") pending.current = window.setTimeout(() => (pending.current = null), 900)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-sidebar/70 duration-150 ease-smooth data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100vh-32px)] w-[min(600px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-popover p-6 shadow-pop duration-150 ease-smooth data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98] data-[state=closed]:duration-100"
        >
          <Dialog.Title className="text-base font-medium">Keyboard and colours</Dialog.Title>
          <div className="mt-5 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <div key={s.title}>
                <div className="mb-2 text-xs text-faint">{s.title}</div>
                <ul className="flex flex-col gap-1.5">
                  {s.keys.map(([ks, label]) => (
                    <li key={label} className="flex items-center justify-between text-sm text-muted-foreground">
                      {label}
                      <span className="flex gap-1">
                        {ks.map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-x-10 gap-y-6 border-t border-hairline pt-5 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs text-faint">What colours mean</div>
              <ul className="flex flex-col gap-1.5">
                {COLOURS.map((c) => (
                  <li key={c.name} className="flex items-baseline gap-2 text-sm text-muted-foreground">
                    <Square tone={c.tone} className="translate-y-px" />
                    <span>
                      <span className="text-foreground">{c.name}</span> {c.means}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 text-xs text-faint">Levels</div>
              <ul className="flex flex-col gap-1.5">
                {(["fatal", "error", "warning"] as const).map((l) => (
                  <li key={l} className="flex items-baseline gap-2 text-sm text-muted-foreground">
                    <LevelGlyph level={l} className="translate-y-px" />
                    <span>
                      <span className="text-foreground">{levelLabel[l]}</span> {levelHint[l]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
