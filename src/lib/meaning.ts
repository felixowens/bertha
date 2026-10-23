import type { AgentReport, FixWatch, Triage, Level, MonitorState, ProjectHealth, IssueStatus, AlertTrigger, Environment, LogLevel, Runtime } from "../contract/domain"
import type { Tone } from "@/components/ui/primitives"

/**
 * Colour is meaning, and these maps are the only place meaning becomes colour. It's a
 * traffic light for how things stand: red is act now (down, regressed, a crash), amber is
 * look soon (degraded, new, snoozed), green is fine (up, healthy, resolved). Everything
 * else, including an ordinary error, is grey.
 */
export const levelTone: Record<Level, Tone> = { fatal: "danger", error: "quiet", warning: "cell" }
export const levelLabel: Record<Level, string> = { fatal: "Crash", error: "Error", warning: "Warning" }
/** What each level means, for tooltips and the colour key. */
export const levelHint: Record<Level, string> = {
  fatal: "The app crashed: an uncaught exception or unhandled rejection stopped the process.",
  error: "An exception was reported and the app kept running.",
  warning: "A message the app logged with captureMessage.",
}

/**
 * Log lines take the colours every log viewer uses, so a page of them scans by level: red
 * for errors and crashes, amber for warnings, grey below. The glyph still tells a crash
 * from an error. This is the one place colour follows severity rather than how things stand.
 */
export const logLevelTone: Record<LogLevel, Tone> = { fatal: "danger", error: "danger", warning: "warn", info: "quiet", debug: "cell" }
/** A line's message: what went wrong reads brightest. */
export const logMessageTone: Record<LogLevel, Tone> = { fatal: "fg", error: "fg", warning: "fg", info: "quiet", debug: "cell" }
/** The volume strip's cells, bottom first: the worst lines sit at the base of each column. */
export const logVolumeFill: Record<LogLevel, string> = {
  fatal: "bg-danger",
  error: "bg-danger/60",
  warning: "bg-warn/70",
  info: "bg-cell-quiet",
  debug: "bg-cell-quiet/50",
}
export const logLevelLabel: Record<LogLevel, string> = { fatal: "Fatal", error: "Error", warning: "Warn", info: "Info", debug: "Debug" }
/** A level as a minimum, for the level filter. */
export const logLevelAtLeast: Record<LogLevel, string> = { debug: "Debug and up", info: "Info and up", warning: "Warnings and up", error: "Errors and up", fatal: "Fatal only" }

/** Issue state, separate from level: what changed about it. */
export const issueStateTone = { new: "warn", regressed: "danger" } as const satisfies Record<string, Tone>
export const statusTone: Record<IssueStatus, Tone> = { unresolved: "quiet", resolved: "ok", ignored: "void", snoozed: "warn" }

export const healthTone: Record<ProjectHealth, Tone> = {
  down: "danger",
  regressed: "danger",
  new_issues: "warn",
  healthy: "ok",
  awaiting_first_event: "void",
}
export const healthLabel: Record<ProjectHealth, string> = {
  down: "Down",
  regressed: "Regressed",
  new_issues: "New issues",
  healthy: "Healthy",
  awaiting_first_event: "Not connected",
}
export const healthRank: Record<ProjectHealth, number> = {
  down: 0,
  regressed: 1,
  new_issues: 2,
  healthy: 3,
  awaiting_first_event: 4,
}

export const monitorTone: Record<MonitorState, Tone> = { down: "danger", degraded: "warn", up: "ok", paused: "void" }
export const monitorLabel: Record<MonitorState, string> = { down: "Down", degraded: "Degraded", up: "Up", paused: "Paused" }
export const monitorHint: Record<MonitorState, string> = {
  down: "Checks are failing.",
  degraded: "Answering, but slowly or with a certificate about to expire.",
  up: "Checks are passing.",
  paused: "Not being checked.",
}

export const statusLabel: Record<IssueStatus, string> = {
  unresolved: "Unresolved",
  resolved: "Resolved",
  ignored: "Ignored",
  snoozed: "Snoozed",
}

export const triggerLabel: Record<AlertTrigger, string> = {
  new_issue: "New issue",
  regression: "Regression",
  spike: "Spike",
  monitor_down: "Site down",
  monitor_degraded: "Site degraded",
  monitor_recovered: "Recovered",
  log_match: "Log match",
}

/** An agent's report about bertha: open is grey, dealt with is green like a resolved issue. */
export const reportTone = { open: "quiet", done: "ok" } as const satisfies Record<string, Tone>
export const reportKindLabel: Record<AgentReport["kind"], string> = { problem: "Problem", request: "Request" }

export const envShort: Record<Environment, string> = { production: "prod", staging: "staging", development: "dev" }
export const runtimeLabel: Record<Runtime, string> = { browser: "Browser", server: "Server", edge: "Edge" }

/**
 * A triage: one going on is foreground, a stale one is hollow. Of the outcomes, fixed is
 * green like a resolved issue and needing data is amber, since someone should look again.
 */
export const triageStateTone: Record<Triage["state"], Tone> = { active: "fg", stale: "void", done: "quiet" }
export const outcomeTone: Record<NonNullable<Triage["outcome"]>, Tone> = { fixed: "ok", needs_data: "warn", not_a_bug: "quiet", cant_fix: "quiet", abandoned: "void" }
export const outcomeLabel: Record<NonNullable<Triage["outcome"]>, string> = {
  fixed: "Fixed",
  not_a_bug: "Not a bug",
  cant_fix: "Can't fix",
  needs_data: "Needs data",
  abandoned: "Abandoned",
}
/** A fix on its way: shipped is green, a PR closed without merging is amber, waiting is grey. */
export const fixTone: Record<FixWatch["state"], Tone> = { waiting_merge: "quiet", waiting_release: "quiet", shipped: "ok", closed: "warn", unwatched: "quiet" }
export const outcomeHint: Record<NonNullable<Triage["outcome"]>, string> = {
  fixed: "The cause is fixed. bertha resolves the issue when the fix ships.",
  not_a_bug: "Expected behaviour, or noise from outside the app.",
  cant_fix: "Understood, but it can't or shouldn't be fixed.",
  needs_data: "Stuck until bertha captures more. Say what's missing.",
  abandoned: "Stopped without an answer.",
}
