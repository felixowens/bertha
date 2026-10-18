// Domain nouns for bertha, in the owner's own language. Pure types only.
//
// The vocabulary:
//   Project  — one app or site being watched (a personal project or a client site).
//   Event    — one occurrence of an error, as reported by the app.
//   Issue    — events grouped by fingerprint: "the same error". The unit people triage.
//   Release  — a deploy of a project; issues are "new in" or "regressed in" a release.
//   Monitor  — an uptime check that requests a URL on an interval.
//   Incident — a stretch of time a monitor was down.
//   Member   — someone with access: the owner, or a collaborator limited to some projects.

/** ISO 8601 date or date-time string. */
export type IsoDate = string

/** Markdown. Used only for notes people leave on issues. */
export type Prose = string

/** Every page's data is wrapped so loading, empty and error states are explicit. */
export type Loadable<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "empty" } | { status: "error"; message: string; retryable: boolean }

/** Mutation outcome with named failure kinds. */
export type Result<T, Failure extends string> = { ok: true; value: T } | { ok: false; failure: Failure; message: string }

// ── Shared ──────────────────────────────────────────────────────────────

export type TimeRange = "24h" | "7d" | "30d"

export type Environment = "production" | "staging" | "development"

/** Severity of an issue or event. */
export type Level = "fatal" | "error" | "warning"

/**
 * Bucketed counts, oldest first. `null` means no data for that bucket (the app sent
 * nothing at all, e.g. it was down or not yet connected), which is different from 0.
 */
export type TimeSeries = {
  bucket: "hour" | "day"
  start: IsoDate
  counts: (number | null)[]
}

/** Event counts per day split by level, for stacked charts. Arrays align with `start`. */
export type LevelSeries = {
  bucket: "hour" | "day"
  start: IsoDate
  byLevel: Record<Level, (number | null)[]>
}

/** A headline number with its comparison period and a small trend. */
export type Kpi = {
  value: number
  /** Same measure over the previous period of equal length. */
  previous: number
  trend: number[]
}

export type Person = {
  id: string
  name: string
  email: string
}

// ── Projects ────────────────────────────────────────────────────────────

/** Where the project's code runs; decides which setup instructions apply. */
export type Runtime = "browser" | "server" | "edge"

/** Why a project needs attention right now, if it does. Worst one wins. */
export type ProjectHealth =
  | "down" // its monitor is failing
  | "regressed" // a resolved issue came back
  | "new_issues" // issues first seen in the last 24h
  | "healthy"
  | "awaiting_first_event" // created but nothing received yet

export type Project = {
  id: string
  /** Short uppercase prefix used in issue ids, e.g. "KILN" → KILN-4F. */
  key: string
  name: string
  /** The client this is for; null for the owner's own projects. */
  client: string | null
  url: string | null
  /** Where the code lives, e.g. "https://github.com/me/kiln"; commits link into it. */
  repoUrl: string | null
  runtimes: Runtime[]
  environments: Environment[]
  health: ProjectHealth
  lastEventAt: IsoDate | null
  events24h: number
  unresolvedIssues: number
  /** Uptime monitors watching this project, oldest first. */
  monitorIds: string[]
}

/** What someone needs to connect an app to bertha. */
export type ProjectSetup = {
  projectId: string
  /** Connection key the app's error client is configured with. */
  ingestKey: string
  /** Copy-paste setup code for the project's runtimes. */
  snippet: string
  firstEventAt: IsoDate | null
  /** Whether stack traces for the latest release can be shown as original source. */
  sourceMaps: { latestRelease: string | null; uploaded: boolean }
}

// ── Issues and events ───────────────────────────────────────────────────

export type IssueStatus = "unresolved" | "resolved" | "ignored" | "snoozed"

/** A snooze lifts on a date or after N more events, whichever was chosen. */
export type Snooze = { kind: "until"; until: IsoDate } | { kind: "events"; total: number; remaining: number }

export type IssueSummary = {
  id: string
  /** Human id, project key + suffix, e.g. "KILN-4F". */
  shortId: string
  projectId: string
  /** Error class, e.g. "TypeError", "ChunkLoadError", "UnhandledRejection". */
  type: string
  message: string
  /** Where it happens: function, route or file. Null when there is no stack. */
  culprit: string | null
  level: Level
  status: IssueStatus
  snooze: Snooze | null
  assignee: Person | null
  firstSeen: IsoDate
  lastSeen: IsoDate
  /** Every event ever. */
  eventCount: number
  /** Events within the selected range. */
  eventsInRange: number
  /** Distinct users ever affected; 0 when the app reports no user at all. */
  userCount: number
  environments: Environment[]
  /** Events per hour (24h range) or per day (7d/30d), spanning exactly the range. */
  trend: TimeSeries
  /** First seen within the selected range. */
  isNew: boolean
  /** Was resolved, then happened again. */
  isRegression: boolean
}

/** How affected users, browsers, URLs etc. break down for an issue. */
export type TagKey = "url" | "browser" | "os" | "release" | "environment" | "user"

export type TagBreakdown = {
  key: TagKey
  /** Number of distinct values seen; `values` holds only the top few. */
  distinct: number
  values: { value: string; count: number }[]
}

export type Activity =
  | { kind: "first_seen"; at: IsoDate; release: string | null }
  | { kind: "regressed"; at: IsoDate; release: string | null }
  | { kind: "resolved" | "ignored" | "reopened"; at: IsoDate; by: Person; via?: string }
  | { kind: "snoozed"; at: IsoDate; by: Person; via?: string; snooze: Snooze }
  | { kind: "unsnoozed"; at: IsoDate; reason: "date_passed" | "event_threshold" }
  | { kind: "assigned"; at: IsoDate; by: Person; via?: string; to: Person | null }
  | { kind: "note"; at: IsoDate; by: Person; via?: string; body: Prose }

export type Issue = IssueSummary & {
  firstRelease: string | null
  /** Release the latest regression appeared in. */
  regressedIn: string | null
  tags: TagBreakdown[]
  /** Newest first. */
  activity: Activity[]
}

export type StackFrame = {
  file: string
  function: string | null
  line: number | null
  column: number | null
  /** The project's own code, as opposed to dependencies or the runtime. */
  inApp: boolean
  /** Shown as original source; false means minified/bundled code. */
  mapped: boolean
  /** Source lines around `line`; null when source is unavailable. */
  context: { startLine: number; lines: string[]; highlight: number } | null
}

export type Breadcrumb = {
  at: IsoDate
  category: "navigation" | "fetch" | "click" | "console" | "log"
  level: "info" | "warning" | "error"
  message: string
}

/** Who hit the error, as far as the app reported it. Any field may be missing. */
export type AffectedUser = {
  id: string | null
  email: string | null
  ip: string | null
}

export type Event = {
  id: string
  issueId: string
  receivedAt: IsoDate
  release: string | null
  environment: Environment
  level: Level
  /** Null for errors reported without a stack (e.g. a logged message). */
  exception: {
    type: string
    message: string
    /** Innermost (where it was thrown) first. */
    frames: StackFrame[]
  } | null
  /** Oldest first, ending just before the error. */
  breadcrumbs: Breadcrumb[]
  request: { method: string; url: string; status: number | null } | null
  user: AffectedUser | null
  context: {
    browser: string | null
    os: string | null
    runtime: string | null
    userAgent: string | null
  }
  tags: Record<string, string>
}

/** Position within an issue's events, newest = index 0. */
export type EventCursor = {
  index: number
  total: number
  newerId: string | null
  olderId: string | null
}

// ── Releases ────────────────────────────────────────────────────────────

export type Release = {
  id: string
  projectId: string
  version: string
  environment: Environment
  deployedAt: IsoDate
  commit: { sha: string; message: string; author: string } | null
  newIssues: number
  regressedIssues: number
  /** Issues resolved before this deploy that have stayed quiet since. */
  quietSinceDeploy: number
  eventCount: number
}

// ── Uptime ──────────────────────────────────────────────────────────────

export type MonitorState = "up" | "down" | "degraded" | "paused"

export type Monitor = {
  id: string
  projectId: string
  name: string
  url: string
  intervalSeconds: number
  state: MonitorState
  /** When the current state began. */
  since: IsoDate
  /** Percentage, 0–100, over the last 30 days. */
  uptime30d: number
  latestResponseMs: number | null
  /** Most recent checks, oldest first, one cell each; null = no check (paused). */
  recent: (MonitorState | null)[]
}

export type UptimeCheck = {
  at: IsoDate
  ok: boolean
  httpStatus: number | null
  responseMs: number | null
  /** Why it failed, in plain words: "Timed out after 10s", "TLS certificate expired". */
  error: string | null
  region: string
}

export type Incident = {
  id: string
  startedAt: IsoDate
  resolvedAt: IsoDate | null
  cause: string
  failedChecks: number
}

// ── People and alerts ───────────────────────────────────────────────────

export type Member = Person & {
  role: "owner" | "collaborator"
  /** Projects they can see. The owner always sees all. */
  projectIds: string[] | "all"
  /** Null while the invitation is pending. */
  joinedAt: IsoDate | null
  /** When the current invitation was sent; null once joined. */
  invitedAt: IsoDate | null
  /** When the current invitation stops working (may be past); null once joined. */
  inviteExpiresAt: IsoDate | null
}

/**
 * Lets an agent reach bertha's MCP endpoint as the member who made it, seeing only what
 * they see. The secret is shown once, when it's made.
 */
export type AccessToken = {
  id: string
  /** Says which agent it is, e.g. "claude on laptop". Shown as "via" in issue activity. */
  name: string
  createdAt: IsoDate
  lastUsedAt: IsoDate | null
}

export type AlertDestination = { id: string; kind: "email"; address: string } | { id: string; kind: "webhook"; label: string; url: string }

export type AlertTrigger = "new_issue" | "regression" | "spike" | "monitor_down" | "monitor_degraded" | "monitor_recovered"

export type AlertRule = {
  id: string
  name: string
  projectIds: string[] | "all"
  environments: Environment[]
  triggers: AlertTrigger[]
  // OPEN: is a per-rule spike threshold enough, or does each project need its own?
  /** Required when triggers include "spike". */
  spike: { events: number; withinMinutes: number } | null
  destinationIds: string[]
  enabled: boolean
  lastFiredAt: IsoDate | null
}

/** One alert that bertha tried to send. */
export type AlertDelivery = {
  id: string
  at: IsoDate
  ruleId: string
  destinationId: string
  ok: boolean
  /** Why it failed, in plain words; null when it went out. */
  error: string | null
  /** What it was about, e.g. "New issue KILN-4F in Kiln & Clay". */
  summary: string
}

export type IssueFilter = {
  projectIds: string[]
  status: IssueStatus | "all"
  levels: Level[]
  environment: Environment | "all"
  assignee: "me" | "unassigned" | "anyone"
  /** Free text over type, message, culprit, short id, and user, URL and release values. */
  query: string
  /** `events` sorts by events within the range. */
  sort: "last_seen" | "first_seen" | "events" | "users"
  /** Only issues seen within the range. */
  range: TimeRange
  /** Only issues first seen within the range: what the New issues card counts. */
  newInRange?: true
  /** When set, only these issues (a triage queue); other fields still apply. */
  ids?: string[]
}

// OPEN: built-in presets only for now; user-defined saved views later?
/** Shortcut filters shown alongside navigation, with live counts. */
export type SavedView = {
  id: string
  name: string
  count: number
  filter: Partial<IssueFilter>
}

// ── Live ────────────────────────────────────────────────────────────────
/**
 * A nudge that something changed, so open pages can refetch what they show. Each one
 * names a single project and only reaches people who can see it.
 */
export type LiveEvent =
  | {
      kind: "ingested"
      projectId: string
      events: number
      /** Issues seen for the first time. */
      newIssues: string[]
      /** Resolved issues that came back. */
      regressed: string[]
      /** Every other issue that got events, including ignored and snoozed ones. */
      touched: string[]
    }
  /** Someone triaged, noted or assigned issues. */
  | { kind: "issuesChanged"; projectId: string; issueIds: string[] }
  /** A monitor went up, down or degraded. */
  | { kind: "monitor"; projectId: string; monitorId: string; state: MonitorState }
  /** The stream missed changes (it dropped, or fell behind): refetch everything shown. */
  | { kind: "resync" }

/** Whether change notices are arriving. Drives the live dot. */
export type LiveStatus = "connecting" | "open" | "down"
