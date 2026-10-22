import { useEffect, useRef, useState } from "react"
import { cn } from "cn"
import { ChevronDown, Search, X } from "lucide-react"
import { Popover } from "radix-ui"
import type { LogFilter, LogLevel, LogRange, Project } from "../../contract/domain"
import { Button } from "@/components/ui/button"
import { inputClass } from "@/components/ui/form"
import { menuContent } from "@/components/ui/menu"
import { Kbd, LevelGlyph, Mono, Square } from "@/components/ui/primitives"
import { CheckFilter, SelectFilter, chip } from "@/components/issues/FilterBar"
import { typing } from "@/components/shell/Shortcuts"
import { logLevelAtLeast } from "@/lib/meaning"
import { DEFAULT_LOG_FILTER, LOG_LEVELS, LOG_RANGES, isDefaultLogFilter } from "@/lib/logs"
import { day, num, time } from "@/lib/format"
import { now } from "@/lib/clock"

const RANGE_LABEL: Record<LogRange, string> = { "1h": "1 hour", "24h": "24 hours", "7d": "7 days", "30d": "30 days" }

/** `projects` is left out on a project's own page. `total` is null while it loads. */
export function LogFilterBar({ filter, projects, total, onChange }: { filter: LogFilter; projects?: Project[]; total: number | null; onChange: (f: LogFilter) => void }) {
  const set = <K extends keyof LogFilter>(k: K, v: LogFilter[K]) => onChange({ ...filter, [k]: v })
  const search = useRef<HTMLInputElement>(null)
  const [unfolded, setUnfolded] = useState(false)
  const [q, setQ] = useState(filter.query)
  useEffect(() => setQ(filter.query), [filter.query])
  useEffect(() => {
    if (q === filter.query) return
    const t = setTimeout(() => onChange({ ...filter, query: q, patternId: null }), 300)
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
  const narrowed = [!!projects && filter.projectIds.length > 0, filter.minLevel !== DEFAULT_LOG_FILTER.minLevel, filter.range !== DEFAULT_LOG_FILTER.range, filter.until !== null].filter(Boolean).length
  const clear = !isDefaultLogFilter(filter) || (!!projects && filter.projectIds.length > 0)

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
              if (e.key === "Enter") onChange({ ...filter, query: q, patternId: null })
              if (e.key === "Escape") {
                if (q) setQ("")
                else e.currentTarget.blur()
              }
            }}
            placeholder='Search messages, "a phrase" or key:value'
            aria-label="Search logs"
            spellCheck={false}
            className="h-8 w-full rounded-md border border-hairline bg-transparent pr-16 pl-8 font-mono text-xs text-foreground transition-[border-color,box-shadow] duration-150 ease-smooth placeholder:font-sans placeholder:text-sm placeholder:text-faint hover:border-border focus:border-ring focus:ring-3 focus:ring-ring/15 focus:outline-none"
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
          {projects && (
            <CheckFilter
              label="Project"
              value={filter.projectIds}
              onApply={(v) => set("projectIds", v)}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
            />
          )}
          <SelectFilter<LogLevel>
            label="Level"
            value={filter.minLevel}
            onChange={(v) => set("minLevel", v)}
            quiet={filter.minLevel === DEFAULT_LOG_FILTER.minLevel}
            options={[...LOG_LEVELS].reverse().map((l) => ({ value: l, label: logLevelAtLeast[l], glyph: <LevelGlyph level={l} /> }))}
          />
          <SelectFilter<LogRange>
            label="Last"
            value={filter.range}
            onChange={(v) => set("range", v)}
            quiet={filter.range === DEFAULT_LOG_FILTER.range}
            options={LOG_RANGES.map((r) => ({ value: r, label: RANGE_LABEL[r] }))}
          />
          <UntilControl until={filter.until} onChange={(v) => set("until", v)} />
        </div>
        <div className="ml-auto flex items-center gap-3">
          {clear && (
            <Button variant="link" size="sm" onClick={() => onChange({ ...DEFAULT_LOG_FILTER, projectIds: projects ? [] : filter.projectIds })}>
              Clear filters
            </Button>
          )}
          <Mono className="text-xs whitespace-nowrap text-faint" aria-live="polite">
            {total === null ? "" : total >= 10_000 ? "10,000+ lines" : `${num(total)} ${total === 1 ? "line" : "lines"}`}
          </Mono>
        </div>
      </div>
    </div>
  )
}

/** Live (follow new lines), or a fixed end. Times are UTC, like the rest of bertha. */
function UntilControl({ until, onChange }: { until: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  useEffect(() => {
    if (open) setDraft((until ?? new Date(now()).toISOString()).slice(0, 16))
  }, [open, until])
  const parsed = draft ? Date.parse(`${draft}:00Z`) : NaN
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className={cn(chip, until && "border-border text-foreground")}>
        {until ? (
          <>
            <span className="text-faint">Until</span>
            <Mono className="text-xs">
              {day(until)} {time(until)}
            </Mono>
          </>
        ) : (
          <>
            <Square tone="ok" className="size-1.5 animate-pulse-dot" />
            Live
          </>
        )}
        <ChevronDown className="size-3.5 text-faint" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className={cn(menuContent, "w-72 p-3")}>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (Number.isNaN(parsed)) return
              onChange(new Date(parsed).toISOString())
              setOpen(false)
            }}
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Show lines up to (UTC)</span>
              <input type="datetime-local" value={draft} onChange={(e) => setDraft(e.target.value)} className={cn(inputClass, "font-mono text-xs")} />
            </label>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!until}
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                <Square tone="ok" className="size-1.5" /> Go live
              </Button>
              <Button type="submit" size="sm" disabled={Number.isNaN(parsed)}>
                Apply
              </Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
