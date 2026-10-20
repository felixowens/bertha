import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { cn } from "cn"
import { Plus, X } from "lucide-react"
import { Popover } from "radix-ui"
import { CheckBox, menuContent, menuItem } from "@/components/ui/menu"
import { Mono } from "@/components/ui/primitives"
import { InlineError } from "@/components/ui/states"
import { LABEL_LIMIT, normalizeLabel } from "@/lib/labels"
import { Link } from "@/lib/router"

/** A label is grey: colour means status, and a label is only a name. */
export function LabelChip({ name, to, onRemove, className }: { name: string; to?: string; onRemove?: () => void; className?: string }) {
  const body = <Mono className="truncate">{name}</Mono>
  const base = "inline-flex h-5 max-w-full min-w-0 items-center gap-1 rounded-[4px] border border-hairline px-1.5 text-2xs text-muted-foreground"
  return (
    <span className={cn(base, onRemove && "pr-0.5", className)}>
      {to ? (
        <Link to={to} className="min-w-0 truncate underline-fade hover:text-foreground" title={`Issues labelled ${name}`} onClick={(e) => e.stopPropagation()}>
          {body}
        </Link>
      ) : (
        body
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove label ${name}`} className="press grid size-4 place-items-center rounded-[3px] text-faint hover:bg-raised hover:text-foreground">
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}

/** Labels on a row: the first few, then how many more. */
export function LabelList({ labels, max = 3, hrefOf }: { labels: string[]; max?: number; hrefOf?: (l: string) => string }) {
  if (!labels.length) return null
  const shown = labels.slice(0, max)
  return (
    <span className="flex min-w-0 items-center gap-1">
      {shown.map((l) => (
        <LabelChip key={l} name={l} to={hrefOf?.(l)} className="shrink-0" />
      ))}
      {labels.length > max && (
        <Mono className="shrink-0 text-2xs text-faint" title={labels.slice(max).join(", ")}>
          +{labels.length - max}
        </Mono>
      )}
    </span>
  )
}

/**
 * Pick labels for one issue or several. Ticked means every target has it; a dash means
 * some do. Typing a new name and pressing Enter adds it.
 */
export function LabelMenu({
  open,
  onOpenChange,
  trigger,
  targets,
  known,
  onApply,
  side,
  align = "start",
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  trigger: ReactNode
  /** Each target's labels. */
  targets: string[][]
  /** Labels in use nearby, most used first. */
  known: { name: string; count: number }[]
  onApply: (add: string[], remove: string[]) => void
  side?: "top" | "bottom"
  align?: "start" | "end"
}) {
  const [typed, setTyped] = useState("")
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!open) {
      setTyped("")
      setError(null)
    }
  }, [open])
  const n = targets.length
  const on = (l: string) => targets.filter((t) => t.includes(l)).length
  const names = useMemo(() => {
    const all = [...new Set([...targets.flat(), ...known.map((k) => k.name)])]
    const q = normalizeLabel(typed) ?? typed.trim().toLowerCase()
    return q ? all.filter((l) => l.includes(q)) : all
  }, [targets, known, typed])
  const fresh = normalizeLabel(typed)
  const isNew = fresh !== null && !names.includes(fresh)
  const full = (l: string) => targets.some((t) => !t.includes(l) && t.length >= LABEL_LIMIT)

  const toggle = (l: string) => {
    if (on(l) === n) return onApply([], [l])
    if (full(l)) return setError(`An issue can have at most ${LABEL_LIMIT} labels. Remove one first.`)
    onApply([l], [])
  }
  const submit = () => {
    if (!typed.trim()) return
    if (fresh === null) return setError("Use letters, digits and dashes, up to 32 characters.")
    toggle(fresh)
    setTyped("")
  }

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          side={side}
          sideOffset={6}
          className={cn(menuContent, "w-64 p-0")}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            input.current?.focus()
          }}
        >
          <div className="border-b border-hairline p-1">
            <input
              ref={input}
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder="Find or add a label"
              aria-label="Find or add a label"
              className="h-8 w-full bg-transparent px-2 font-mono text-sm text-foreground outline-none placeholder:font-sans placeholder:text-faint"
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-1" role="menu">
            {names.map((l) => {
              const count = on(l)
              return (
                <button key={l} type="button" role="menuitemcheckbox" aria-checked={count === n ? true : count ? "mixed" : false} onClick={() => toggle(l)} className={cn(menuItem, "w-full hover:bg-raised hover:text-foreground")}>
                  {count > 0 && count < n ? (
                    <span aria-hidden className="grid size-3.5 shrink-0 place-items-center rounded-[3px] border border-foreground">
                      <span className="h-px w-2 bg-foreground" />
                    </span>
                  ) : (
                    <CheckBox checked={count === n} />
                  )}
                  <Mono className="min-w-0 flex-1 truncate text-left">{l}</Mono>
                  {n > 1 && count > 0 && (
                    <Mono className="text-xs text-faint">
                      {count}/{n}
                    </Mono>
                  )}
                </button>
              )
            })}
            {isNew && (
              <button type="button" onClick={submit} className={cn(menuItem, "w-full hover:bg-raised hover:text-foreground")}>
                <Plus className="size-3.5" />
                <span className="min-w-0 flex-1 truncate text-left">
                  Add <Mono className="text-foreground">{fresh}</Mono>
                </span>
              </button>
            )}
            {!names.length && !isNew && <p className="px-2 py-1.5 text-xs text-faint">{typed.trim() ? "That can't be a label." : "No labels yet. Type one to add it."}</p>}
          </div>
          {error && (
            <div className="border-t border-hairline px-3 py-2">
              <InlineError>{error}</InlineError>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
