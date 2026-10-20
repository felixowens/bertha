import { cn } from "cn"
import type { IssueSummary } from "../../contract/domain"
import { CellBars } from "@/components/charts/cells"
import { Avatar, LevelGlyph, Mono, toneText } from "@/components/ui/primitives"
import { CheckBox } from "@/components/ui/menu"
import { ago, compact, num, plural, since, snoozeText } from "@/lib/format"
import { envShort, issueStateTone, levelHint, levelLabel, statusTone } from "@/lib/meaning"
import { Link } from "@/lib/router"
import { LabelList } from "./Labels"

export const ROW_GRID = "grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-3 md:grid-cols-[20px_minmax(0,1fr)_auto_64px_64px_64px_24px] md:gap-x-4"

function Flag({ issue }: { issue: IssueSummary }) {
  if (issue.isRegression && issue.status === "unresolved") return <Mono className={cn("text-xs", toneText[issueStateTone.regressed])}>regressed</Mono>
  if (issue.status === "snoozed" && issue.snooze) return <Mono className={cn("text-xs", toneText[statusTone.snoozed])}>snoozed {snoozeText(issue.snooze)}</Mono>
  if (issue.status === "resolved") return <Mono className={cn("text-xs", toneText[statusTone.resolved])}>resolved</Mono>
  if (issue.status === "ignored") return <Mono className="text-xs text-faint">ignored</Mono>
  if (issue.isNew) return <Mono className={cn("text-xs", toneText[issueStateTone.new])}>new</Mono>
  return null
}

export function IssueRow({
  issue,
  projectName,
  selected,
  focused,
  onToggle,
  onFocus,
  rangeLabel,
  leaving,
  arrived,
  me,
  labelHref,
}: {
  issue: IssueSummary
  projectName: string
  selected: boolean
  focused: boolean
  onToggle: (shift: boolean) => void
  /** A click moves the cursor here; hovering only highlights, so triage never lands on the row under a resting mouse. */
  onFocus: () => void
  rangeLabel: string
  /** Triaged out of this list: it folds away. */
  leaving?: boolean
  /** Just came in live: a short wash marks it. */
  arrived?: boolean
  me?: string
  /** Where a label on the row goes: this list, narrowed to it. */
  labelHref?: (label: string) => string
}) {
  return (
    <li
      data-issue={issue.id}
      aria-selected={selected}
      inert={leaving}
      onPointerDown={onFocus}
      className={cn(
        "relative grid border-b border-hairline transition-[background-color,grid-template-rows,opacity,border-color] duration-150 ease-smooth",
        leaving ? "grid-rows-[0fr] border-transparent opacity-0" : "grid-rows-[1fr]",
        selected ? "bg-raised" : focused ? "bg-raised/40" : "hover:bg-raised/25",
        arrived && !selected && !focused && "animate-arrive",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-0.5 origin-center bg-foreground transition-[scale,opacity] duration-150 ease-smooth",
          focused ? "opacity-100" : "scale-y-50 opacity-0",
        )}
      />
      <div className={cn(ROW_GRID, "min-h-0 px-4 md:px-6", leaving ? "overflow-hidden py-0 transition-[padding] duration-150 ease-smooth" : "py-2.5")}>
        <button role="checkbox" aria-checked={selected} aria-label={`Select ${issue.shortId}`} onClick={(e) => onToggle(e.shiftKey)} className="-m-2 grid place-items-center p-2">
          <CheckBox checked={selected} />
        </button>
        <div className="min-w-0">
          <Link to={`/issues/${issue.id}`} className="group block min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span title={`${levelLabel[issue.level]}: ${levelHint[issue.level]}`} className="flex shrink-0">
                <LevelGlyph level={issue.level} />
              </span>
              <span className="sr-only">{levelLabel[issue.level]}:</span>
              <span className="truncate">
                <span className="font-medium text-foreground underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-150 group-hover:decoration-border">
                  {issue.type}
                </span>
                <span className="text-muted-foreground"> {issue.message}</span>
              </span>
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-x-2 text-xs text-faint">
              <Mono className="shrink-0 text-muted-foreground">{issue.shortId}</Mono>
              <span className="shrink-0">·</span>
              <span className="max-w-[40%] shrink-0 truncate">{projectName}</span>
              {issue.culprit && (
                <>
                  <span className="shrink-0">·</span>
                  <Mono className="truncate">{issue.culprit}</Mono>
                </>
              )}
              {issue.environments.length > 0 && !issue.environments.includes("production") && (
                <Mono className="shrink-0 rounded-[3px] border border-hairline px-1">{issue.environments.map((e) => envShort[e]).join(" ")}</Mono>
              )}
              <span className="ml-1 shrink-0">
                <Flag issue={issue} />
              </span>
              {issue.triage && (
                <Mono
                  className="shrink-0 truncate text-muted-foreground"
                  title={`Being triaged by ${issue.triage.by.name}${issue.triage.via ? ` via ${issue.triage.via}` : ""}, for ${since(issue.triage.since)}`}
                >
                  {issue.triage.by.id === me ? "you're" : issue.triage.by.name.split(" ")[0]} on it
                </Mono>
              )}
            </div>
          </Link>
          {issue.labels.length > 0 && (
            <div className="mt-1.5 flex min-w-0">
              <LabelList labels={issue.labels} hrefOf={labelHref} />
            </div>
          )}
        </div>
        <div className="hidden md:block">
          <CellBars values={issue.trend.counts} rows={5} label={`Events per ${issue.trend.bucket}, ${rangeLabel}`} />
        </div>
        <div className="text-right md:contents">
          <Mono className="block text-right text-sm text-foreground" title={`${num(issue.eventsInRange)} events in ${rangeLabel}, ${num(issue.eventCount)} all time`}>
            {compact(issue.eventsInRange)}
          </Mono>
          <Mono
            className="block text-right text-xs text-faint md:text-sm md:text-muted-foreground"
            title={issue.userCount ? `${plural(issue.userCount, "user")} affected, all time` : "The app doesn't send who was affected"}
          >
            <span className="md:hidden">{issue.userCount ? plural(issue.userCount, "user") : "no user data"}</span>
            <span className={cn("hidden md:inline", !issue.userCount && "text-faint")}>{issue.userCount ? compact(issue.userCount) : "—"}</span>
          </Mono>
        </div>
        <Mono className="hidden text-right text-xs text-muted-foreground md:block" title={`First seen ${since(issue.firstSeen)} ago`}>
          {ago(issue.lastSeen)}
        </Mono>
        <span className="hidden justify-end md:flex">
          {issue.assignee ? <Avatar name={issue.assignee.name} className="size-5" /> : <span className="sr-only">Unassigned</span>}
        </span>
      </div>
    </li>
  )
}
