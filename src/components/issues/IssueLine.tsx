import { cn } from "cn"
import type { IssueSummary } from "../../contract/domain"
import { CellBars } from "@/components/charts/cells"
import { Mono, Square, toneText, type Tone } from "@/components/ui/primitives"
import { compact, since, ago } from "@/lib/format"
import { levelLabel, levelTone } from "@/lib/meaning"
import { Link } from "@/lib/router"

/** The left-hand readout: why this issue is here, as an instrument would say it. */
export function readout(i: IssueSummary): { text: string; tone: Tone } {
  if (i.isRegression) return { text: `back ${since(i.lastSeen)}`, tone: "danger" }
  if (i.isNew) return { text: `new ${since(i.firstSeen)}`, tone: i.level === "fatal" ? "danger" : "warn" }
  if (i.status === "snoozed") return { text: "snoozed", tone: "warn" }
  return { text: ago(i.lastSeen), tone: "cell" }
}

/** One issue on the overview or a release: readout · what · where · how much. */
export function IssueLine({ issue, projectName, days = 14 }: { issue: IssueSummary; projectName: string; days?: number }) {
  const r = readout(issue)
  return (
    <li className="border-b border-hairline last:border-b-0">
      <Link
        to={`/issues/${issue.id}`}
        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-4 transition-colors sm:grid-cols-[112px_minmax(0,1fr)_auto_auto] md:gap-x-6"
      >
        <Mono className={cn("col-span-full text-xs sm:col-span-1 sm:text-sm", toneText[r.tone])}>{r.text}</Mono>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-sm text-foreground">
            <Square tone={levelTone[issue.level]} />
            <span className="sr-only">{levelLabel[issue.level]}:</span>
            <span className="truncate group-hover:underline group-hover:decoration-border group-hover:underline-offset-4">
              <span className="font-medium">{issue.type}</span>
              <span className="text-muted-foreground"> {issue.message}</span>
            </span>
          </div>
          <div className="mt-1 truncate text-sm text-muted-foreground">
            <span className="text-faint">{projectName}</span>
            {issue.culprit && <span className="font-mono text-xs text-faint"> · {issue.culprit}</span>}
          </div>
        </div>
        <div className="text-right">
          <Mono className="block text-sm text-foreground">{compact(issue.eventCount)}</Mono>
          <Mono className="block text-xs text-faint">{compact(issue.userCount)} users</Mono>
        </div>
        <div className="hidden sm:block">
          <CellBars values={issue.trend.counts.slice(-days)} rows={5} label={`Events per day, last ${days} days`} />
        </div>
      </Link>
    </li>
  )
}
