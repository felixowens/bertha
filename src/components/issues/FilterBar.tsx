import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "cn"
import { ChevronDown, Search, X } from "lucide-react"
import { DropdownMenu, Popover } from "radix-ui"
import type { Environment, IssueFilter, Level, Project, TimeRange } from "../../contract/domain"
import { Button } from "@/components/ui/button"
import { CheckBox, menuContent, menuItem } from "@/components/ui/menu"
import { Kbd, LevelGlyph, Mono, Square, type Tone } from "@/components/ui/primitives"
import { typing } from "@/components/shell/Shortcuts"
import { levelHint, levelLabel, envShort } from "@/lib/meaning"
import { isDefault, DEFAULT_FILTER } from "./filters"

const chip =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-2.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground aria-expanded:border-border aria-expanded:bg-raised aria-expanded:text-foreground"

export type Opt<T> = { value: T; label: ReactNode; count?: number; tone?: Tone; glyph?: ReactNode; hint?: string }

/** Multi-select with a draft: tick several, then Apply (or Reset). */
function CheckFilter<T extends string>({ label, options, value, onApply }: { label: string; options: Opt<T>[]; value: T[]; onApply: (v: T[]) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<T[]>(value)
  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])
  const toggle = (v: T) => setDraft((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]))
  const active = value.length > 0
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className={cn(chip, active && "border-border text-foreground")}>
        {label}
        {active && <Mono className="rounded-[3px] bg-foreground px-1 text-2xs text-background">{value.length}</Mono>}
        <ChevronDown className="size-3.5 text-faint" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className={cn(menuContent, "w-72 p-0")}>
          <div className="max-h-80 overflow-y-auto p-1">
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => toggle(o.value)}
                className={cn(menuItem, "w-full hover:bg-raised hover:text-foreground", o.hint && "h-auto items-start py-1.5")}
                role="menuitemcheckbox"
                aria-checked={draft.includes(o.value)}
              >
                <CheckBox checked={draft.includes(o.value)} className={o.hint ? "mt-0.5" : undefined} />
                {o.glyph ?? (o.tone && <Square tone={o.tone} hollow={o.tone === "void"} />)}
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block text-xs text-pretty text-faint">{o.hint}</span>}
                </span>
                {o.count !== undefined && <Mono className="text-xs text-faint">{o.count}</Mono>}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-hairline p-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft([])} disabled={!draft.length}>
              Reset
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onApply(draft)
                setOpen(false)
              }}
            >
              Apply
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Single choice: status, environment, assignee, sort, range. */
export function SelectFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  align = "start",
  quiet,
}: {
  label: string
  options: Opt<T>[]
  value: T
  onChange: (v: T) => void
  align?: "start" | "end"
  quiet?: boolean
}) {
  const current = options.find((o) => o.value === value)
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={cn(chip, !quiet && "text-foreground")}>
        <span className="text-faint">{label}</span>
        {current?.label}
        <ChevronDown className="size-3.5 text-faint" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} sideOffset={6} className={menuContent}>
          <DropdownMenu.RadioGroup value={value} onValueChange={(v) => onChange(v as T)}>
            {options.map((o) => (
              <DropdownMenu.RadioItem key={o.value} value={o.value} className={cn(menuItem, "pr-3")}>
                <span className={cn("size-1.5 rounded-full", o.value === value ? "bg-foreground" : "bg-transparent")} />
                <span className="flex-1">{o.label}</span>
                {o.count !== undefined && <Mono className="text-xs text-faint">{o.count}</Mono>}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

const LEVELS: Level[] = ["fatal", "error", "warning"]
const ENVS: (Environment | "all")[] = ["all", "production", "staging", "development"]

const RANGE_LABEL: Record<TimeRange, string> = { "24h": "24h", "7d": "7 days", "30d": "30 days" }

/** `older` is how many unresolved issues the range hides, when nothing else filters the list. */
export function FilterBar({
  filter,
  projects,
  total,
  older = 0,
  labels = [],
  onChange,
}: {
  filter: IssueFilter
  projects: Project[]
  total: number | null
  older?: number
  /** Labels in use in these projects, most used first. */
  labels?: { name: string; count: number }[]
  onChange: (f: IssueFilter) => void
}) {
  const set = <K extends keyof IssueFilter>(k: K, v: IssueFilter[K]) => onChange({ ...filter, [k]: v })
  const search = useRef<HTMLInputElement>(null)
  // On a phone the filters fold behind one button so the list starts on screen.
  const [unfolded, setUnfolded] = useState(false)
  const narrowed = [
    filter.projectIds.length > 0,
    filter.levels.length > 0,
    filter.status !== DEFAULT_FILTER.status,
    filter.environment !== "all",
    filter.assignee !== "anyone",
    filter.labels.length > 0,
    filter.triage !== undefined,
  ].filter(Boolean).length
  const [q, setQ] = useState(filter.query)
  useEffect(() => setQ(filter.query), [filter.query])
  // Debounce search into the URL.
  useEffect(() => {
    if (q === filter.query) return
    const t = setTimeout(() => set("query", q), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !typing(e)) {
        e.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className="flex flex-col gap-3 border-b border-hairline px-4 py-3 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex h-8 min-w-0 flex-1 basis-56 items-center">
          <Search className="pointer-events-none absolute left-2.5 size-3.5 text-faint" />
          <input
            ref={search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (q) setQ("")
                else e.currentTarget.blur()
              }
            }}
            placeholder="Search issues, users, URLs, releases"
            aria-label="Search issues"
            className="h-8 w-full rounded-md border border-hairline bg-transparent pr-16 pl-8 text-sm text-foreground transition-[border-color,box-shadow] duration-150 ease-smooth placeholder:text-faint hover:border-border focus:border-ring focus:ring-3 focus:ring-ring/15 focus:outline-none"
          />
          {q ? (
            <button
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="press absolute right-2 animate-in rounded p-0.5 text-faint duration-150 fade-in-0 zoom-in-75 hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <Kbd className="absolute right-2">/</Kbd>
          )}
        </label>
        <button type="button" onClick={() => setUnfolded((u) => !u)} aria-expanded={unfolded} className={cn(chip, "md:hidden", narrowed > 0 && "border-border text-foreground")}>
          Filters
          {narrowed > 0 && <Mono className="rounded-[3px] bg-foreground px-1 text-2xs text-background">{narrowed}</Mono>}
          <ChevronDown className={cn("size-3.5 text-faint transition-[rotate] duration-200 ease-smooth", unfolded && "rotate-180")} />
        </button>
        <div
          className={cn(
            "contents",
            !unfolded && "max-md:hidden",
            unfolded && "max-md:[&>*]:animate-in max-md:[&>*]:fade-in-0 max-md:[&>*]:slide-in-from-top-1 max-md:[&>*]:duration-200",
          )}
        >
          <CheckFilter
            label="Project"
            value={filter.projectIds}
            onApply={(v) => set("projectIds", v)}
            options={projects.map((p) => ({ value: p.id, label: p.name, count: p.unresolvedIssues }))}
          />
          <CheckFilter
            label="Level"
            value={filter.levels}
            onApply={(v) => set("levels", v)}
            options={LEVELS.map((l) => ({ value: l, label: levelLabel[l], glyph: <LevelGlyph level={l} className="mt-0.5" />, hint: levelHint[l] }))}
          />
          {(labels.length > 0 || filter.labels.length > 0) && (
            <CheckFilter
              label="Label"
              value={filter.labels}
              onApply={(v) => set("labels", v)}
              options={[
                ...labels.map((l) => ({ value: l.name, label: <Mono>{l.name}</Mono>, count: l.count })),
                // A label from the URL that nothing here carries any more still shows, so it can be unticked.
                ...filter.labels.filter((l) => !labels.some((k) => k.name === l)).map((l) => ({ value: l, label: <Mono>{l}</Mono>, count: 0 })),
              ]}
            />
          )}
          <SelectFilter
            label="Status"
            value={filter.status}
            onChange={(v) => set("status", v)}
            options={[
              { value: "unresolved", label: "Unresolved" },
              { value: "snoozed", label: "Snoozed" },
              { value: "resolved", label: "Resolved" },
              { value: "ignored", label: "Ignored" },
              { value: "all", label: "Any" },
            ]}
          />
          <SelectFilter
            label="Env"
            value={filter.environment}
            onChange={(v) => set("environment", v)}
            options={ENVS.map((e) => ({ value: e, label: e === "all" ? "All" : envShort[e] }))}
          />
          <SelectFilter
            label="Assigned"
            value={filter.assignee}
            onChange={(v) => set("assignee", v)}
            options={[
              { value: "anyone", label: "Anyone" },
              { value: "me", label: "Me" },
              { value: "unassigned", label: "Nobody" },
            ]}
          />
          <SelectFilter<"any" | "active" | "never">
            label="Triage"
            value={filter.triage ?? "any"}
            onChange={(v) => onChange({ ...filter, triage: v === "any" ? undefined : v })}
            options={[
              { value: "any", label: "Any" },
              { value: "active", label: "Being triaged" },
              { value: "never", label: "Never triaged" },
            ]}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm text-muted-foreground">
          {total === null ? (
            <span className="text-faint">Counting…</span>
          ) : (
            <>
              <Mono className="text-foreground">{total}</Mono> {total === 1 ? "issue" : "issues"}
              {older > 0 && (
                <span className="text-faint">
                  {" "}
                  · <Mono>{older}</Mono> more not seen in {RANGE_LABEL[filter.range]}
                  {filter.range !== "30d" && (
                    <>
                      {" "}
                      <button onClick={() => onChange({ ...filter, range: "30d" })} className="text-muted-foreground underline-fade hover:text-foreground">
                        Show 30 days
                      </button>
                    </>
                  )}
                </span>
              )}
            </>
          )}
        </span>
        {!isDefault(filter) && (
          <button onClick={() => onChange(DEFAULT_FILTER)} className="text-sm text-faint underline-fade hover:text-foreground">
            Clear filters
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <SelectFilter<TimeRange>
            quiet
            align="end"
            label="Range"
            value={filter.range}
            onChange={(v) => set("range", v)}
            options={[
              { value: "24h", label: "24h" },
              { value: "7d", label: "7 days" },
              { value: "30d", label: "30 days" },
            ]}
          />
          <SelectFilter<IssueFilter["sort"]>
            quiet
            align="end"
            label="Sort"
            value={filter.sort}
            onChange={(v) => set("sort", v)}
            options={[
              { value: "last_seen", label: "Last seen" },
              { value: "first_seen", label: "First seen" },
              { value: "events", label: "Events" },
              { value: "users", label: "Users" },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
