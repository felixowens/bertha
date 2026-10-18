import { cn } from "cn"
import type { IssueSummary } from "../../contract/domain"
import { CellBars } from "@/components/charts/cells"
import { Avatar, Mono, Square } from "@/components/ui/primitives"
import { CheckBox } from "@/components/ui/menu"
import { ago, compact, since, snoozeText } from "@/lib/format"
import { envShort, levelLabel, levelTone } from "@/lib/meaning"
import { Link } from "@/lib/router"

export const ROW_GRID =
  "grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-3 md:grid-cols-[20px_minmax(0,1fr)_auto_56px_56px_64px_24px] md:gap-x-4"

function Flag({ issue }: { issue: IssueSummary }) {
  if (issue.isRegression) return <Mono className="text-xs text-danger">regressed</Mono>
  if (issue.status === "snoozed" && issue.snooze) return <Mono className="text-xs text-warn">snoozed {snoozeText(issue.snooze)}</Mono>
  if (issue.status === "resolved") return <Mono className="text-xs text-faint">resolved</Mono>
  if (issue.status === "ignored") return <Mono className="text-xs text-faint">ignored</Mono>
  if (issue.isNew) return <Mono className={cn("text-xs", issue.level === "fatal" ? "text-danger" : "text-warn")}>new</Mono>
  return null
}

export function IssueRow({
  issue,
  projectName,
  selected,
  focused,
  onToggle,
  onFocus,
  trendDays,
}: {
  issue: IssueSummary
  projectName: string
  selected: boolean
  focused: boolean
  onToggle: (shift: boolean) => void
  onFocus: () => void
  trendDays: number
}) {
  return (
    <li
      data-issue={issue.id}
      aria-selected={selected}
      onMouseEnter={onFocus}
      className={cn(
        "relative border-b border-hairline transition-colors duration-100",
        selected ? "bg-raised" : focused && "bg-raised/40",
      )}
    >
      {focused && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-foreground" />}
      <div className={cn(ROW_GRID, "px-4 py-2.5 md:px-6")}>
        <button
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select ${issue.shortId}`}
          onClick={(e) => onToggle(e.shiftKey)}
          className="-m-2 grid place-items-center p-2"
        >
          <CheckBox checked={selected} />
        </button>
        <Link to={`/issues/${issue.id}`} className="group min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Square tone={levelTone[issue.level]} />
            <span className="sr-only">{levelLabel[issue.level]}:</span>
            <span className="truncate">
              <span className="font-medium text-foreground group-hover:underline group-hover:decoration-border group-hover:underline-offset-4">{issue.type}</span>
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
          </div>
        </Link>
        <div className="hidden md:block">
          <CellBars values={issue.trend.counts.slice(-trendDays)} rows={5} label={`Events per ${issue.trend.bucket}`} />
        </div>
        <div className="text-right md:contents">
          <Mono className="block text-right text-sm text-foreground" title={`${issue.eventCount} events`}>
            {compact(issue.eventCount)}
          </Mono>
          <Mono className="block text-right text-xs text-faint md:text-sm md:text-muted-foreground" title={`${issue.userCount} users`}>
            <span className="md:hidden">{compact(issue.userCount)} users</span>
            <span className="hidden md:inline">{compact(issue.userCount)}</span>
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
