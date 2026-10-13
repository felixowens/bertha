import { useEffect, useRef, useState } from "react"
import { Dialog } from "radix-ui"
import { navigate } from "@/lib/router"
import { Kbd } from "@/components/ui/primitives"

const GO: Record<string, string> = { o: "/", i: "/issues", r: "/releases", u: "/uptime", a: "/settings/alerts", t: "/settings/team" }

const SECTIONS: { title: string; keys: [string[], string][] }[] = [
  {
    title: "Go to",
    keys: [
      [["g", "o"], "Overview"],
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
      [["e"], "Resolve"],
      [["i"], "Ignore"],
      [["s"], "Snooze…"],
      [["a"], "Assign…"],
      [["z"], "Undo last action"],
    ],
  },
  {
    title: "Issue",
    keys: [
      [["["], "Older event"],
      [["]"], "Newer event"],
      [["n"], "Add a note"],
      [["esc"], "Back to list"],
    ],
  },
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-sidebar/70 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover p-6 shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          <Dialog.Title className="text-base font-medium">Keyboard</Dialog.Title>
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
