// The only way the UI reaches data. Read this file first.
// Reads return data (the page wraps them in Loadable); mutations return Result
// with failure kinds named after real failure modes.
//
// This round the backend is mocked: the prototype implements this interface over
// the fixtures. The contract is a proposal and may change with the design.
import type {
  AlertDestination,
  AlertRule,
  Environment,
  Event,
  EventCursor,
  Issue,
  IssueFilter,
  IssueSummary,
  LiveEvent,
  LiveStatus,
  Member,
  Monitor,
  Person,
  Project,
  ProjectSetup,
  Prose,
  Release,
  Result,
  Runtime,
  Snooze,
  TimeRange,
} from "./domain"
import type {
  AcceptInvitePage,
  AlertsPage,
  AppShell,
  IssueDetailPage,
  MonitorDetailPage,
  OverviewPage,
  ProjectSettingsPage,
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
  | { kind: "resolve" }
  | { kind: "ignore" }
  | { kind: "snooze"; snooze: Snooze }
  | { kind: "reopen" }
  | { kind: "assign"; personId: string | null }

export type MonitorInput = {
  id?: string
  projectId: string
  name: string
  url: string
  intervalSeconds: 60 | 300 | 900
  paused: boolean
}

export type AlertRuleInput = Omit<AlertRule, "id" | "lastFiredAt"> & { id?: string }

export type DestinationInput =
  | { kind: "email"; address: string }
  | { kind: "webhook"; label: string; url: string }

export interface Backend {
  // ── Reads ──────────────────────────────────────────────────────────────
  getShell(): Promise<Ready<AppShell>>
  getOverview(range: TimeRange): Promise<Ready<OverviewPage>>
  listIssues(filter: IssueFilter): Promise<{ issues: IssueSummary[]; total: number; assignable: Person[] }>
  getIssue(issueId: string): Promise<Ready<IssueDetailPage> | null>
  /** Step through an issue's events. */
  getEvent(
    issueId: string,
    which: "latest" | "oldest" | { eventId: string },
  ): Promise<{ event: Event; cursor: EventCursor }>
  listReleases(projectId: string | null): Promise<{ releases: Release[]; projects: Project[] }>
  getRelease(releaseId: string): Promise<Ready<ReleaseDetailPage> | null>
  listMonitors(): Promise<Ready<UptimePage>>
  getMonitor(monitorId: string): Promise<Ready<MonitorDetailPage> | null>
  getProjectSettings(projectId: string): Promise<Ready<ProjectSettingsPage> | null>
  /** Polled after creating a project until `firstEventAt` is set. */
  getProjectSetup(projectId: string): Promise<ProjectSetup>
  getAlerts(): Promise<Ready<AlertsPage>>
  getTeam(): Promise<Ready<TeamPage>>
  getInvite(token: string): Promise<Ready<AcceptInvitePage> | null>

  // ── Issues ─────────────────────────────────────────────────────────────
  /**
   * Applies to every id or none. `conflict`: someone else changed one of them in the
   * meantime; the UI should refresh and show the current state.
   */
  updateIssues(
    issueIds: string[],
    change: IssueChange,
  ): Promise<Result<IssueSummary[], "not_found" | "permission_denied" | "conflict">>
  addIssueNote(issueId: string, body: Prose): Promise<Result<Issue, "not_found">>

  // ── Projects ───────────────────────────────────────────────────────────
  createProject(input: {
    name: string
    client: string | null
    url: string | null
    runtimes: Runtime[]
    environments: Environment[]
  }): Promise<Result<{ project: Project; setup: ProjectSetup }, "name_taken" | "invalid_name">>
  /** The old key stops working immediately; apps must be redeployed with the new one. */
  rotateIngestKey(projectId: string): Promise<Result<ProjectSetup, "permission_denied">>
  /** Requires typing the project name to confirm. */
  deleteProject(
    projectId: string,
    confirmName: string,
  ): Promise<Result<null, "name_mismatch" | "permission_denied">>

  // ── Uptime ─────────────────────────────────────────────────────────────
  /** `unreachable`: the first check failed; the monitor is not saved. */
  saveMonitor(input: MonitorInput): Promise<Result<Monitor, "invalid_url" | "unreachable">>

  // ── Alerts ─────────────────────────────────────────────────────────────
  saveAlertRule(input: AlertRuleInput): Promise<Result<AlertRule, "no_destination" | "no_trigger">>
  deleteAlertRule(ruleId: string): Promise<Result<null, "not_found">>
  saveDestination(
    input: DestinationInput,
  ): Promise<Result<AlertDestination, "invalid_email" | "invalid_webhook">>
  /** Sends a sample alert. `delivery_failed`: the email bounced or the webhook returned an error. */
  testDestination(destinationId: string): Promise<Result<{ deliveredAt: string }, "delivery_failed">>

  // ── Team (owner only) ──────────────────────────────────────────────────
  inviteMember(input: {
    email: string
    projectIds: string[]
  }): Promise<Result<Member, "already_member" | "invalid_email">>
  updateMemberAccess(memberId: string, projectIds: string[]): Promise<Result<Member, "permission_denied">>
  removeMember(memberId: string): Promise<Result<null, "cannot_remove_owner">>
  acceptInvite(token: string): Promise<Result<Member, "invite_expired" | "invite_used">>

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
