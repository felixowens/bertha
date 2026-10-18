import { cn } from "cn"
import type { IssueSummary } from "../../contract/domain"
import { CellBars } from "@/components/charts/cells"
import { LevelGlyph, Mono, toneText, type Tone } from "@/components/ui/primitives"
import { compact, plural, since, ago } from "@/lib/format"
import { issueStateTone, levelHint, levelLabel, statusTone } from "@/lib/meaning"
import { Link } from "@/lib/router"

/** The left-hand readout: why this issue is here, as an instrument would say it. */
export function readout(i: IssueSummary): { text: string; tone: Tone } {
  if (i.status === "resolved") return { text: "resolved", tone: statusTone.resolved }
  // The summary has no regression time, and last seen is not when it came back.
  if (i.isRegression) return { text: "regressed", tone: issueStateTone.regressed }
  if (i.isNew) return { text: `new ${since(i.firstSeen)}`, tone: issueStateTone.new }
  if (i.status === "snoozed") return { text: "snoozed", tone: statusTone.snoozed }
  return { text: ago(i.lastSeen), tone: "cell" }
}

/** One issue on the overview or a release: readout · what · where · how much. */
export function IssueLine({ issue, projectName, days }: { issue: IssueSummary; projectName: string | null; days?: number }) {
  const counts = days ? issue.trend.counts.slice(-days) : issue.trend.counts
  const r = readout(issue)
  return (
    <li className="border-b border-hairline last:border-b-0">
      <Link
        to={`/issues/${issue.id}`}
        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-4 transition-colors sm:grid-cols-[136px_minmax(0,1fr)_auto_auto] md:gap-x-6"
      >
        <Mono className={cn("col-span-full text-xs sm:col-span-1 sm:text-sm", toneText[r.tone])}>{r.text}</Mono>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-sm text-foreground">
            <span title={`${levelLabel[issue.level]}: ${levelHint[issue.level]}`} className="flex shrink-0">
              <LevelGlyph level={issue.level} />
            </span>
            <span className="sr-only">{levelLabel[issue.level]}:</span>
            <span className="truncate group-hover:underline group-hover:decoration-border group-hover:underline-offset-4">
              <span className="font-medium">{issue.type}</span>
              <span className="text-muted-foreground"> {issue.message}</span>
            </span>
          </div>
          <div className="mt-1 truncate text-sm text-muted-foreground">
            {projectName && <span className="text-faint">{projectName}</span>}
            {issue.culprit && (
              <span className="font-mono text-xs text-faint">
                {projectName && " · "}
                {issue.culprit}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <Mono className="block text-sm text-foreground">{compact(issue.eventCount)}</Mono>
          <Mono className="block text-xs text-faint">{issue.userCount ? plural(issue.userCount, "user") : "no user data"}</Mono>
        </div>
        <div className="hidden sm:block">
          <CellBars values={counts} rows={5} label={`Events per ${issue.trend.bucket}, last ${plural(counts.length, issue.trend.bucket)}`} />
        </div>
      </Link>
    </li>
  )
}
