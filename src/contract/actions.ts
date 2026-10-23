// The only way the UI reaches data. Read this file first.
// Reads return data (the page wraps them in Loadable); mutations return Result
// with failure kinds named after real failure modes.
//
// This round the backend is mocked: the prototype implements this interface over
// the fixtures. The contract is a proposal and may change with the design.
import type {
  AccessToken,
  AlertDestination,
  AlertRule,
  Environment,
  Event,
  EventCursor,
  EventLogs,
  EventTrace,
  Issue,
  IssueFilter,
  IssueSummary,
  LiveEvent,
  LiveStatus,
  LogFilter,
  LogList,
  LogPatternList,
  Member,
  Monitor,
  Project,
  ProjectLogSettings,
  ProjectSetup,
  Prose,
  RelatedEvent,
  Release,
  Result,
  Runtime,
  Snooze,
  TimeRange,
  Triage,
  UptimeCheck,
} from "./domain"
import type {
  AcceptInvitePage,
  AgentsPage,
  AlertsPage,
  AppShell,
  IssueDetailPage,
  IssuesPage,
  MonitorDetailPage,
  OverviewPage,
  ProjectSettingsPage,
  ProjectsPage,
  ReleaseDetailPage,
  TeamPage,
  UptimePage,
} from "./pages"

/** Data of a ready Loadable. */
type Ready<L> = L extends { status: "ready"; data: infer T } ? T : never

/**
 * Something that finishes outside bertha: the person must open an email and follow
 * a link that brings them back to `returnsTo`. Design the moments before and after.
 */
export type EmailLinkHandoff = { sentTo: string; returnsTo: string }

/** One triage action applied to one or more issues. */
export type IssueChange =
  /** `inNextRelease`: events from the release running now don't count as a regression. */
  { kind: "resolve"; inNextRelease?: true } | { kind: "ignore" } | { kind: "snooze"; snooze: Snooze } | { kind: "reopen" } | { kind: "assign"; personId: string | null }
  /** Either list may be empty. Labels are lowercased; see `IssueSummary.labels`. */
  | { kind: "label"; add: string[]; remove: string[] }
  /**
   * The latest fixed triage's fix is in the release running now: marks it shipped there
   * and resolves the issue, so events from older builds don't reopen it. Works without
   * GitHub. `no_fix`: an issue has no fixed triage.
   */
  | { kind: "fix_shipped" }

/** Fields left out are unchanged. An outcome ends the triage. */
export type TriageInput = {
  found?: Prose
  tried?: Prose
  fix?: Prose
  /** The fix's PR on the project's repo; otherwise read from `fix`. */
  pr?: number
  /** The fix's commit, 7 to 40 hex characters; otherwise read from `fix`. */
  commit?: string
  outcome?: NonNullable<Triage["outcome"]>
}

export type MonitorInput = {
  id?: string
  projectId: string
  name: string
  url: string
  intervalSeconds: 60 | 300 | 900
  paused: boolean
}

export type AlertRuleInput = Omit<AlertRule, "id" | "lastFiredAt"> & { id?: string }

/** With `id`, edits that destination; without, adds one. */
export type DestinationInput = { id?: string; kind: "email"; address: string } | { id?: string; kind: "webhook"; label: string; url: string }

export type ProjectInput = {
  name: string
  client: string | null
  url: string | null
  repoUrl: string | null
  runtimes: Runtime[]
  environments: Environment[]
  /** Markdown, up to 4000 characters; null clears it. */
  brief: Prose | null
  /** Whether bertha follows fixes on GitHub; left out, unchanged. New projects start on. */
  watchFixes?: boolean
  /** Left out, unchanged. New projects keep info and above for 14 days. */
  logs?: ProjectLogSettings
}

export interface Backend {
  // ── Reads ──────────────────────────────────────────────────────────────
  getShell(): Promise<Ready<AppShell>>
  /** `projectId` limits everything to one project (its home page); null = all. */
  getOverview(range: TimeRange, projectId: string | null): Promise<Ready<OverviewPage> | null>
  listProjects(range: TimeRange): Promise<Ready<ProjectsPage>>
  listIssues(filter: IssueFilter): Promise<Ready<IssuesPage["list"]>>
  getIssue(issueId: string): Promise<Ready<IssueDetailPage> | null>
  /** Step through an issue's events. */
  getEvent(issueId: string, which: "latest" | "oldest" | { eventId: string }): Promise<{ event: Event; cursor: EventCursor; related: RelatedEvent[] }>
  /** The spans bertha kept for an event's trace. Null when it received none, or can't find the event. */
  getTrace(issueId: string, eventId: string): Promise<EventTrace | null>
  /** The lines around an event: on its trace, or else near it in time. Null when it can't find the event. */
  getEventLogs(issueId: string, eventId: string): Promise<EventLogs | null>
  /**
   * A page of log lines. Without `page`, the newest lines in the range. `older` continues
   * back from a list's `older`; `newer` returns what arrived after a list's `newer`.
   */
  listLogs(filter: LogFilter, page?: { older: string } | { newer: string }): Promise<LogList>
  listLogPatterns(filter: LogFilter): Promise<LogPatternList>
  listReleases(projectId: string | null): Promise<{ releases: Release[]; projects: Project[] }>
  getRelease(releaseId: string): Promise<Ready<ReleaseDetailPage> | null>
  listMonitors(): Promise<Ready<UptimePage>>
  getMonitor(monitorId: string): Promise<Ready<MonitorDetailPage> | null>
  getProjectSettings(projectId: string): Promise<Ready<ProjectSettingsPage> | null>
  /** Polled after creating a project until `connection`, then `firstEventAt`, is set. */
  getProjectSetup(projectId: string): Promise<ProjectSetup>
  getAlerts(): Promise<Ready<AlertsPage>>
  getTeam(): Promise<Ready<TeamPage>>
  getInvite(token: string): Promise<Ready<AcceptInvitePage> | null>
  getAgents(): Promise<Ready<AgentsPage>>

  // ── Issues ─────────────────────────────────────────────────────────────
  /**
   * Applies to every id or none. `conflict`: someone else changed one of them in the
   * meantime; the UI should refresh and show the current state.
   */
  updateIssues(issueIds: string[], change: IssueChange): Promise<Result<IssueSummary[], "not_found" | "permission_denied" | "conflict" | "no_fix">>
  addIssueNote(issueId: string, body: Prose): Promise<Result<Issue, "not_found">>
  /**
   * Claims the issue. Resumes the viewer's own active triage; closes a stale one, or
   * with `takeOver` anyone's, as abandoned. `in_progress` names who is on it.
   */
  startTriage(issueId: string, takeOver?: true): Promise<Result<Triage, "not_found" | "in_progress">>
  /** Only its author changes a triage; the owner can also end anyone's as abandoned. */
  updateTriage(triageId: string, input: TriageInput): Promise<Result<Triage, "not_found" | "permission_denied" | "concluded">>
  /** Moves the sources' events, notes and fingerprints into the target, then removes them. */
  mergeIssues(targetId: string, sourceIds: string[]): Promise<Result<Issue, "not_found" | "different_projects">>

  // ── Projects ───────────────────────────────────────────────────────────
  /** `key` is the issue id prefix; omitted, one is made from the name. It can't change later. */
  createProject(input: Omit<ProjectInput, "brief" | "watchFixes" | "logs"> & { key?: string }): Promise<Result<{ project: Project; setup: ProjectSetup }, "name_taken" | "invalid_name" | "key_taken" | "invalid_key">>
  updateProject(projectId: string, input: ProjectInput): Promise<Result<Project, "name_taken" | "invalid_name" | "permission_denied">>
  /** The old key stops working immediately; apps must be redeployed with the new one. */
  rotateIngestKey(projectId: string): Promise<Result<ProjectSetup, "permission_denied">>
  /** Requires typing the project name to confirm. */
  deleteProject(projectId: string, confirmName: string): Promise<Result<null, "name_mismatch" | "permission_denied">>

  // ── Uptime ─────────────────────────────────────────────────────────────
  /** `unreachable`: the first check failed; the monitor is not saved. */
  saveMonitor(input: MonitorInput): Promise<Result<Monitor, "invalid_url" | "unreachable">>
  deleteMonitor(monitorId: string): Promise<Result<null, "not_found" | "permission_denied">>
  /** Runs one check right away and records it like any other. */
  checkMonitorNow(monitorId: string): Promise<Result<UptimeCheck, "not_found">>

  // ── Alerts ─────────────────────────────────────────────────────────────
  saveAlertRule(input: AlertRuleInput): Promise<Result<AlertRule, "no_destination" | "no_trigger">>
  deleteAlertRule(ruleId: string): Promise<Result<null, "not_found">>
  saveDestination(input: DestinationInput): Promise<Result<AlertDestination, "invalid_email" | "invalid_webhook">>
  /** Sends a sample alert. `delivery_failed`: the email bounced or the webhook returned an error. */
  testDestination(destinationId: string): Promise<Result<{ deliveredAt: string }, "delivery_failed">>
  /** Takes it off every rule; rules left with nowhere to send are turned off and named. */
  deleteDestination(destinationId: string): Promise<Result<{ rulesTurnedOff: string[] }, "not_found">>

  // ── Team (owner only) ──────────────────────────────────────────────────
  inviteMember(input: { email: string; projectIds: string[] }): Promise<Result<Member, "already_member" | "invalid_email">>
  updateMemberAccess(memberId: string, projectIds: string[]): Promise<Result<Member, "permission_denied">>
  removeMember(memberId: string): Promise<Result<null, "cannot_remove_owner">>
  /** Sends a fresh invitation link; the old one stops working. */
  resendInvite(memberId: string): Promise<Result<Member, "not_found" | "already_member">>
  acceptInvite(token: string): Promise<Result<Member, "invite_expired" | "invite_used">>

  // ── Agents (each member's own tokens) ──────────────────────────────────
  /** `secret` is shown once and never again; bertha keeps only its hash. */
  createAccessToken(name: string): Promise<Result<{ token: AccessToken; secret: string }, "invalid_name">>
  /** The token stops working at once. */
  revokeAccessToken(tokenId: string): Promise<Result<null, "not_found">>
  /** Owner only: marks an agent's report dealt with, or open again. */
  setAgentReportDone(reportId: string, done: boolean): Promise<Result<null, "not_found" | "permission_denied">>

  // ── Session ────────────────────────────────────────────────────────────
  // OPEN: sign-in by emailed link only (no passwords, no third-party sign-in).
  signIn(email: string): Promise<Result<EmailLinkHandoff, "unknown_email">>

  // ── Live ───────────────────────────────────────────────────────────────
  // A stream, not a request: hears change notices for the viewer's projects until the
  // returned function is called. It reconnects by itself and reports a resync after a gap.
  subscribe(listener: LiveListener): () => void
}

export type LiveListener = {
  event(e: LiveEvent): void
  status(s: LiveStatus): void
}

export type { Result }
