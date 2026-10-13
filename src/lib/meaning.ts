import type { Level, MonitorState, ProjectHealth, IssueStatus, AlertTrigger, Environment, Runtime } from "../../packet/contract/domain"
import type { Tone } from "@/components/ui/primitives"

/** Colour is meaning. These maps are the only place meaning becomes colour. */
export const levelTone: Record<Level, Tone> = { fatal: "danger", error: "warn", warning: "quiet" }
export const levelLabel: Record<Level, string> = { fatal: "Fatal", error: "Error", warning: "Warning" }

export const healthTone: Record<ProjectHealth, Tone> = {
  down: "danger",
  regressed: "danger",
  new_issues: "warn",
  healthy: "quiet",
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

export const monitorTone: Record<MonitorState, Tone> = { down: "danger", degraded: "warn", up: "quiet", paused: "void" }
export const monitorLabel: Record<MonitorState, string> = { down: "Down", degraded: "Flapping", up: "Up", paused: "Paused" }

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
  monitor_recovered: "Recovered",
}

export const envShort: Record<Environment, string> = { production: "prod", staging: "staging", development: "dev" }
export const runtimeLabel: Record<Runtime, string> = { browser: "Browser", server: "Server", edge: "Edge" }
