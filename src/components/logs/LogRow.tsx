import { Fragment, useState, type ReactNode } from "react"
import { cn } from "cn"
import type { LogLine } from "../../contract/domain"
import { LevelGlyph, Mono, toneText } from "@/components/ui/primitives"
import { Collapse } from "@/components/ui/motion"
import { clock, day } from "@/lib/format"
import { logLevelLabel, logLevelTone, logMessageTone } from "@/lib/meaning"
import { fieldTerm } from "@/lib/logs"
import { Link } from "@/lib/router"

export type LineLinks = {
  /** A search for one term, e.g. `status:502` or `trace:4bf9…`. */
  term: (term: string) => string
  /** The project's lines around this one; left out where that's where you are. */
  around?: (line: LogLine) => string
}

const link = "text-muted-foreground underline decoration-border underline-offset-4 transition-[color,text-decoration-color] duration-150 hover:text-foreground hover:decoration-foreground"

/**
 * One line, folded to a single row: time, level, project, message and a hint of its
 * fields. Unfolded it shows the whole message and every field, each a search.
 */
export function LogRow({ line, project, marked, links, defaultOpen = false }: { line: LogLine; project?: string; marked?: boolean; links: LineLinks; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  // Details mount on first open, so a page of folded lines stays light.
  const [opened, setOpened] = useState(defaultOpen)
  const fields = Object.entries(line.fields)
  return (
    <li data-line={line.id} className={cn("border-b border-hairline/50 transition-colors duration-150", marked && "bg-raised")}>
      <button
        type="button"
        onClick={() => {
          setOpened(true)
          setOpen((o) => !o)
        }}
        aria-expanded={open}
        className={cn(
          "grid w-full min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-0.5 text-left font-mono text-xs leading-5 transition-colors duration-150 hover:bg-raised/60 sm:grid-cols-[12ch_7ch_minmax(0,1fr)_auto] md:px-6",
          project !== undefined && "md:grid-cols-[12ch_7ch_24ch_minmax(0,1fr)_auto]",
          marked && "hover:bg-raised",
        )}
      >
        <span className="tabular text-faint">{clock(line.at)}</span>
        <span className={cn("flex items-center gap-1.5", toneText[logLevelTone[line.level]])}>
          <LevelGlyph level={line.level} />
          {logLevelLabel[line.level]}
        </span>
        {project !== undefined && <span className="hidden truncate text-faint md:block">{project}</span>}
        <span className="min-w-0 truncate max-sm:order-last max-sm:col-span-full">
          <span className={toneText[logMessageTone[line.level]]}>{line.message}</span>
          {fields.length > 0 && (
            <span className="text-faint">
              {fields.slice(0, 4).map(([k, v]) => (
                <Fragment key={k}>
                  {"\u2003"}
                  {k}={v}
                </Fragment>
              ))}
            </span>
          )}
        </span>
        {line.event ? <span className="rounded-[3px] border border-hairline px-1 text-2xs leading-4 text-muted-foreground max-sm:col-start-4">issue</span> : <span />}
      </button>
      <Collapse open={open}>
        {opened && <LineDetail line={line} links={links} />}
      </Collapse>
    </li>
  )
}

function LineDetail({ line, links }: { line: LogLine; links: LineLinks }) {
  const rows: [string, string, boolean][] = [
    ...Object.entries(line.fields).map(([k, v]): [string, string, boolean] => [k, v, true]),
    ...(line.service ? [["service", line.service, true] as [string, string, boolean]] : []),
    ...(line.release ? [["release", line.release, true] as [string, string, boolean]] : []),
    ["environment", line.environment, true],
    ...(line.traceId ? [["trace", line.traceId, true] as [string, string, boolean]] : []),
    ...(line.spanId ? [["span", line.spanId, false] as [string, string, boolean]] : []),
  ]
  const actions: ReactNode[] = []
  if (line.traceId)
    actions.push(
      <Link key="trace" to={links.term(fieldTerm("trace", line.traceId))} className={link}>
        Lines on this trace
      </Link>,
    )
  if (line.event)
    actions.push(
      <Link key="issue" to={`/issues/${line.event.issueId}?eventId=${encodeURIComponent(line.event.eventId)}`} className={link}>
        Open the issue
      </Link>,
    )
  if (links.around)
    actions.push(
      <Link key="around" to={links.around(line)} className={link}>
        Lines around this one
      </Link>,
    )
  return (
    <div className="flex flex-col gap-3 px-4 pt-1 pb-3 font-mono text-xs sm:pl-[calc(1rem+12ch+0.75rem)] md:pr-6 md:pl-[calc(1.5rem+12ch+0.75rem)]">
      <p className="font-mono leading-5 break-words whitespace-pre-wrap text-foreground">{line.message}</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0.5 font-mono leading-5">
        {rows.map(([k, v, searchable]) => (
          <Fragment key={k}>
            <dt className="text-faint">{k}</dt>
            <dd className="min-w-0 break-all">
              {searchable ? (
                <Link to={links.term(fieldTerm(k, v))} title="Search for this" className="text-muted-foreground transition-colors duration-150 hover:text-foreground">
                  {v}
                </Link>
              ) : (
                <span className="text-muted-foreground">{v}</span>
              )}
            </dd>
          </Fragment>
        ))}
        <dt className="text-faint">at</dt>
        <dd className="text-muted-foreground">
          <Mono>{line.at}</Mono>
        </dd>
      </dl>
      {actions.length > 0 && <div className="flex flex-wrap gap-x-4 gap-y-1 font-sans">{actions}</div>}
    </div>
  )
}

/** A dated rule between lines from different days. */
export function DayRule({ at }: { at: string }) {
  return (
    <li aria-hidden className="flex items-center gap-3 px-4 pt-3 pb-1 md:px-6">
      <Mono className="text-2xs text-faint">{day(at)}</Mono>
      <span className="h-px flex-1 bg-hairline" />
    </li>
  )
}

/** Lines with a rule wherever the day changes. */
export function LogRows({ lines, projectName, markedId, links, openId }: { lines: LogLine[]; projectName?: (id: string) => string; markedId?: string | null; links: LineLinks; openId?: string | null }) {
  return (
    <>
      {lines.map((l, i) => (
        <Fragment key={l.id}>
          {(i === 0 || day(lines[i - 1]!.at) !== day(l.at)) && <DayRule at={l.at} />}
          <LogRow line={l} project={projectName?.(l.projectId)} marked={l.id === markedId} links={links} defaultOpen={l.id === openId} />
        </Fragment>
      ))}
    </>
  )
}
