// One view model per page/route a journey touches.
import type {
  AccessToken,
  AgentReport,
  AlertDelivery,
  AlertDestination,
  AlertRule,
  Environment,
  Event,
  EventCursor,
  Incident,
  Issue,
  IssueFilter,
  IssueSummary,
  Kpi,
  LevelSeries,
  Loadable,
  Member,
  Monitor,
  Person,
  Project,
  ProjectSetup,
  Prose,
  RelatedEvent,
  Release,
  SavedView,
  TimeRange,
  TimeSeries,
  UptimeCheck,
} from "./domain"

/**
 * Around every signed-in page: who is looking, the projects they can see, and counts
 * worth showing in navigation. A collaborator sees only their projects and no
 * team or alert settings.
 */
export type AppShell = Loadable<{
  viewer: Member
  projects: Project[]
  savedViews: SavedView[]
  counts: { unresolved: number; assignedToMe: number; monitorsDown: number }
}>

/**
 * Morning check: what changed across every project, at a glance. With a project set it is
 * that project's home, and everything below is limited to it. Every part follows `range`.
 */
export type OverviewPage = Loadable<{
  range: TimeRange
  /** The project this overview is limited to; null for all projects. */
  project: Project | null
  /** That project's brief; null for all projects or when it has none. */
  brief: Prose | null
  kpis: {
    events: Kpi
    newIssues: Kpi
    regressions: Kpi
    /** Percentage across all monitors. */
    uptime: Kpi
  }
  /** Worst health first. */
  projects: Project[]
  /** Events per project within the range, keyed by project id. */
  projectEvents: Record<string, number>
  /** Issues most worth looking at in the range: new, regressed or spiking. */
  attention: IssueSummary[]
  /** Hourly for 24h, daily for 7d and 30d. */
  events: LevelSeries
  /** Deploys in the range, to mark on the events chart. */
  releases: Release[]
  /** Monitors that are down or degraded, worst first. */
  monitorsAttention: Monitor[]
}>

/** Every project the viewer can see, with what each one is doing. */
export type ProjectsPage = Loadable<{
  /** Worst health first. */
  projects: Project[]
  /** Events per project within the range, keyed by project id. */
  projectEvents: Record<string, number>
  monitors: Monitor[]
}>

/** Triage the inbox. The filter is always present; the list loads. */
export type IssuesPage = {
  filter: IssueFilter
  /** "empty" = nothing matches (with the default filter: inbox zero). */
  /** `assignable`: people who can be assigned the listed issues (bulk "Assign to…"). */
  /** `labels`: labels in use in the filtered projects, most used first, for the filter bar. */
  list: Loadable<{ issues: IssueSummary[]; total: number; assignable: Person[]; labels: { name: string; count: number }[] }>
}

export type IssueDetailPage = Loadable<{
  issue: Issue
  project: Project
  event: Event
  cursor: EventCursor
  /** Other issues' events on the same trace as `event`. */
  related: RelatedEvent[]
  /** Events per day, last 30 days, with deploys marked. */
  history: TimeSeries
  releases: Release[]
  /** People who can be assigned (members with access to this project). */
  assignable: Person[]
}>

export type ReleasesPage = {
  /** Null = all projects. */
  projectId: string | null
  list: Loadable<{ releases: Release[]; projects: Project[] }>
}

/** "Did that deploy break anything / fix anything?" */
export type ReleaseDetailPage = Loadable<{
  release: Release
  project: Project
  previous: Release | null
  /** The next deploy of the same project to the same environment. */
  next: Release | null
  newIssues: IssueSummary[]
  regressedIssues: IssueSummary[]
  /** Issues resolved before this deploy that stayed quiet since (`quietSinceDeploy`). */
  heldFixes: IssueSummary[]
  /** Hourly events from 24h before to 24h after the deploy; hours still to come are null. */
  around: TimeSeries
  /** How many whole hours after the deploy have passed, 0–24. */
  afterHours: number
}>

export type UptimePage = Loadable<{ monitors: Monitor[]; projects: Project[] }>

export type MonitorDetailPage = Loadable<{
  monitor: Monitor
  project: Project
  /** Newest first. */
  checks: UptimeCheck[]
  /** Newest first; an open incident has `resolvedAt: null`. */
  incidents: Incident[]
  responseTimes: TimeSeries
  /**
   * Server-side issues in the same project that started or spiked while the open
   * (or latest) incident ran: the likely "why" behind a downtime. Newest first.
   */
  relatedIssues: IssueSummary[]
  /** Daily uptime percentage over 90 days; null where it was paused or didn't exist. */
  uptimeByDay: TimeSeries
}>

export type ProjectSettingsPage = Loadable<{
  project: Project
  /** What anyone triaging the project should know: stack, hosting, known noise. Markdown. */
  brief: Prose | null
  /** `ProjectInput.watchFixes` as saved. */
  watchFixes: boolean
  /**
   * Whether bertha follows this project's fixes on GitHub: `on`; `off` (turned off here);
   * `no_token` (bertha has no GitHub token); `not_github` or `no_repo` (no repo it can read).
   * Otherwise fixes are marked shipped by hand.
   */
  fixWatching: "on" | "off" | "no_token" | "not_github" | "no_repo"
  setup: ProjectSetup
  /** Oldest first. */
  monitors: Monitor[]
  /** Members who can see this project. */
  members: Member[]
}>

/**
 * Add a project: name it, then connect it. `setup` is null until the project is
 * created; after that the page polls `getProjectSetup` until `firstEventAt` is set.
 */
export type NewProjectPage = {
  created: Project | null
  setup: Loadable<ProjectSetup> | null
}

export type AlertsPage = Loadable<{
  rules: AlertRule[]
  destinations: AlertDestination[]
  /** The last 50 alerts sent or attempted, newest first. */
  deliveries: AlertDelivery[]
  projects: Project[]
  environments: Environment[]
}>

export type TeamPage = Loadable<{ members: Member[]; projects: Project[] }>

/**
 * The viewer's own access tokens, where agents connect, and what agents reported about
 * bertha. "empty" = no tokens and no reports yet.
 */
export type AgentsPage = Loadable<{
  tokens: AccessToken[]
  /** Newest first: every report for the owner, the viewer's own agents' otherwise. */
  reports: AgentReport[]
  /** bertha's MCP endpoint, e.g. "https://bertha.example.com/mcp". */
  mcpUrl: string
}>

/** Reached from the invitation email link. */
export type AcceptInvitePage = Loadable<{
  /** Known when the link opens, so a dead link says so before anyone presses Accept. */
  status: "pending" | "expired" | "used"
  invitedBy: Person
  email: string
  projectNames: string[]
}>

/** Sign in by email link. `sentTo` is set once the link has been sent. */
export type SignInPage = { sentTo: string | null }

/** Every route the design should cover, with its view model. */
export type Routes = {
  "/": OverviewPage
  "/projects": ProjectsPage
  "/projects/:projectId": OverviewPage
  "/issues": IssuesPage
  "/issues/:issueId": IssueDetailPage
  "/releases": ReleasesPage
  "/releases/:releaseId": ReleaseDetailPage
  "/uptime": UptimePage
  "/uptime/:monitorId": MonitorDetailPage
  "/uptime/:monitorId/report": MonitorDetailPage
  "/projects/new": NewProjectPage
  "/projects/:projectId/connect": NewProjectPage
  "/projects/:projectId/settings": ProjectSettingsPage
  "/settings/alerts": AlertsPage
  "/settings/team": TeamPage
  "/settings/agents": AgentsPage
  "/invite/:token": AcceptInvitePage
  "/sign-in": SignInPage
}

export type { Loadable }
