import type { AgentReport, Triage, Level, MonitorState, ProjectHealth, IssueStatus, AlertTrigger, Environment, Runtime } from "../contract/domain"
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
  awaiting_first_event: "Awaiting first event",
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
export const outcomeHint: Record<NonNullable<Triage["outcome"]>, string> = {
  fixed: "The cause is fixed. Resolve the issue once the fix ships.",
  not_a_bug: "Expected behaviour, or noise from outside the app.",
  cant_fix: "Understood, but it can't or shouldn't be fixed.",
  needs_data: "Stuck until bertha captures more. Say what's missing.",
  abandoned: "Stopped without an answer.",
}
