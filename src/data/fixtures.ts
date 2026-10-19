import type { Backend, IssueChange } from "../contract/actions"
import type {
  AccessToken,
  Activity,
  Environment,
  Event,
  Issue,
  IssueFilter,
  IssueSummary,
  Member,
  Monitor,
  Project,
  ProjectHealth,
  ProjectSetup,
  RelatedEvent,
  Result,
  TimeRange,
  TimeSeries,
  UptimeCheck,
} from "../contract/domain"
import { alertRules, deliveries, destinations } from "../../fixtures/alerts"
import { events } from "../../fixtures/events"
import { issues as issueFixtures } from "../../fixtures/issues"
import { monitorHistory, monitorRelatedIssues, monitors } from "../../fixtures/monitors"
import { overviews } from "../../fixtures/overview"
import { accessTokens, members as memberFixtures } from "../../fixtures/people"
import { projectSetups, projects } from "../../fixtures/projects"
import { releases } from "../../fixtures/releases"
import { DEFAULT_FILTER } from "@/components/issues/filters"
import { invites, shells } from "../../fixtures/shell"
import { liveReplay } from "../../fixtures/live"
import type { ActiveScenario } from "./scenario"
import { KEY_PATTERN, keyFromName, uniqueKey } from "@/lib/keys"

const H = 3600e3
const D = 24 * H
const RANGE_MS: Record<TimeRange, number> = { "24h": D, "7d": 7 * D, "30d": 30 * D }
const HEALTH_RANK: Record<ProjectHealth, number> = { down: 0, regressed: 1, new_issues: 2, healthy: 3, awaiting_first_event: 4 }
const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0)

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const never = <T>() => new Promise<T>(() => {})

const MCP_URL = "https://bertha.bishop.barden.dev/mcp"

/** The fixtures' "now". Every relative time in the prototype is measured from here. */
export const NOW = new Date("2026-10-13T09:12:00Z")

/** Messages a real backend would send with each failure kind. */
const MESSAGES: Record<string, string> = {
  not_found: "That no longer exists. It may have been deleted with its project.",
  permission_denied: "You don't have access to do that any more.",
  conflict: "Someone changed one of these issues a moment ago. Showing the current state.",
  name_taken: "A project with that name already exists.",
  invalid_name: "Use at least one letter or number.",
  key_taken: "Another project already uses that key.",
  invalid_key: "Use 2–6 capital letters or digits, starting with a letter.",
  different_projects: "Only issues in the same project can be merged.",
  name_mismatch: "That doesn't match the project name.",
  invalid_url: "Enter a full URL, starting with https://",
  unreachable: "The first check failed: DNS lookup for that host returned nothing.",
  no_destination: "Pick at least one destination.",
  no_trigger: "Pick at least one trigger.",
  invalid_email: "That isn't a complete email address.",
  invalid_webhook: "Webhook URLs must start with https://",
  delivery_failed: "The webhook returned 410 Gone. It may have been deleted on the other side.",
  already_member: "They already have access.",
  cannot_remove_owner: "The owner can't be removed.",
  invite_expired: "This invitation expired. Invitations last 7 days.",
  invite_used: "This invitation was already accepted.",
  unknown_email: "There's no account for that email.",
}

/** Where one operation's failure reads differently from the shared message. */
const OP_MESSAGES: Record<string, string> = {
  "createAccessToken.invalid_name": "Name it after the agent or machine, like \"claude on laptop\".",
  "revokeAccessToken.not_found": "That token was already revoked.",
}

const clone = <T>(v: T): T => structuredClone(v)

/** Small seeded generator so synthesised series are stable between renders. */
function seeded(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

export function createFixtureBackend(scenario: ActiveScenario): Backend {
  const viewerKind = scenario.params.viewer === "collaborator" ? "collaborator" : "owner"
  const shell = clone(shells[viewerKind])
  const viewer = shell.viewer
  const canSee = (projectId: string) => viewer.projectIds === "all" || viewer.projectIds.includes(projectId)

  // In-memory state so triage feels real within a session.
  const issues: Issue[] = clone(issueFixtures)
  const members: Member[] = clone(memberFixtures)
  const rules = clone(alertRules)
  const dests = clone(destinations)
  const setups: ProjectSetup[] = clone(projectSetups)
  const monitorList: Monitor[] = clone(monitors)
  const projectList: Project[] = clone(projects)
  const history = clone(monitorHistory)
  const sent = clone(deliveries)
  const tokens: AccessToken[] = clone(accessTokens)
  const now = NOW.getTime()
  // The calm scenario: every monitor that's running is up, and its recent checks agree.
  if (scenario.params.allHealthy === "true") {
    for (const m of monitorList) if (m.state !== "paused") Object.assign(m, { state: "up", recent: m.recent.map((r) => (r === null ? null : "up")) })
  }
  const pollCount = new Map<string, number>()

  /** `&shell=ready` keeps the frame loaded, so a page's own loading state shows. */
  const read = async <T>(value: () => T, empty: T, shellRead = false): Promise<T> => {
    if (shellRead && scenario.params.shell === "ready") return value()
    if (scenario.reads === "loading") return never()
    await wait(260)
    if (scenario.reads === "error") throw new Error("bertha couldn't reach the server. Check your connection and try again.")
    return scenario.reads === "empty" ? empty : value()
  }

  /** If the scenario forces one of this operation's failures, return it. */
  const forced = <F extends string>(op: keyof Backend, kinds: readonly F[]): F | null => {
    const f = scenario.failure
    if (!f) return null
    if (f.op !== null && f.op !== op) return null
    return (kinds as readonly string[]).includes(f.kind) ? (f.kind as F) : null
  }
  const fail = <F extends string>(failure: F) => ({ ok: false, failure, message: MESSAGES[failure] ?? failure }) as const
  const mutate = async <T, F extends string>(op: keyof Backend, kinds: readonly F[], run: () => Result<T, F>): Promise<Result<T, F>> => {
    await wait(420)
    const f = forced(op, kinds)
    return f ? { ...fail(f), message: OP_MESSAGES[`${op}.${f}`] ?? MESSAGES[f] ?? f } : run()
  }

  const summary = (i: Issue): IssueSummary => {
    const { firstRelease: _a, regressedIn: _b, tags: _c, activity: _d, ...s } = i
    return s
  }
  /** The stored trend is 30 days; each range gets exactly its own span. */
  const trendFor = (i: IssueSummary, range: TimeRange): TimeSeries => {
    const counts = i.trend.counts
    if (range === "30d") return i.trend
    if (range === "7d") return { bucket: "day", start: new Date(new Date(i.trend.start).getTime() + (counts.length - 7) * D).toISOString(), counts: counts.slice(-7) }
    // The last day spread over 24 hours, quiet at night, nothing outside first/last seen.
    const rnd = seeded(i.id)
    const start = Math.floor((now - 23 * H) / H) * H
    const first = new Date(i.firstSeen).getTime()
    const last = new Date(i.lastSeen).getTime()
    const w = Array.from({ length: 24 }, (_, h) => {
      const at = start + h * H
      if (at + H <= first || at > last) return 0
      return (new Date(at).getUTCHours() < 6 ? 0.3 : 1) * (0.4 + rnd())
    })
    const total = counts.at(-1) ?? 0
    const ws = sum(w) || 1
    return { bucket: "hour", start: new Date(start).toISOString(), counts: w.map((x) => Math.round((total * x) / ws)) }
  }
  /** A trend never reads 0 in the bucket where the issue was last seen. */
  const withLastSeen = (t: TimeSeries, lastSeen: string): TimeSeries => {
    const step = t.bucket === "hour" ? H : D
    const at = Math.floor((new Date(lastSeen).getTime() - new Date(t.start).getTime()) / step)
    if (at < 0 || at >= t.counts.length || (t.counts[at] ?? 0) > 0) return t
    return { ...t, counts: t.counts.map((c, i) => (i === at ? 1 : c)) }
  }
  const inRange = (iso: string, range: TimeRange) => new Date(iso).getTime() >= now - RANGE_MS[range]
  const summaryIn = (i: Issue | IssueSummary, range: TimeRange): IssueSummary => {
    const s = "tags" in i ? summary(i) : i
    const trend = withLastSeen(trendFor(s, range), s.lastSeen)
    return { ...s, trend, eventsInRange: sum(trend.counts), isNew: inRange(s.firstSeen, range) }
  }
  const projectOf = (id: string) => projectList.find((p) => p.id === id)!
  const visibleIssues = () => issues.filter((i) => canSee(i.projectId))
  const visibleProjects = () => projectList.filter((p) => canSee(p.id))
  const byHealth = (a: Project, b: Project) => HEALTH_RANK[a.health] - HEALTH_RANK[b.health] || a.name.localeCompare(b.name)
  /** Releases with `quietSinceDeploy` counted from the issues, so the count and its list agree. */
  const resolvedBefore = (projectId: string, at: string) =>
    issues.filter((i) => i.projectId === projectId && i.status === "resolved" && i.lastSeen < at && i.activity.some((a) => a.kind === "resolved" && a.at <= at))
  const withHeld = <R extends (typeof releases)[number]>(r: R): R => ({ ...r, quietSinceDeploy: resolvedBefore(r.projectId, r.deployedAt).length })

  const issueEvents = (issueId: string) => events.filter((e) => e.issueId === issueId).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))

  /** Events beyond the few in the fixtures are copies of the latest, shifted in time. */
  const eventAt = (issue: Issue, index: number): Event => {
    const known = issueEvents(issue.id)
    if (known[index]) return clone(known[index])
    const base: Event = known[0]
      ? clone(known[0])
      : {
          id: "",
          issueId: issue.id,
          receivedAt: issue.lastSeen,
          release: issue.firstRelease,
          environment: issue.environments[0] ?? "production",
          level: issue.level,
          exception: issue.culprit
            ? {
                type: issue.type,
                message: issue.message,
                frames: [{ file: issue.culprit, function: null, line: null, column: null, inApp: true, mapped: true, context: null }],
                data: {},
                componentStack: null,
              }
            : null,
          mechanism: null,
          trace: null,
          breadcrumbs: [],
          request: null,
          user: null,
          context: {
            browser: null,
            os: null,
            runtime: null,
            userAgent: null,
            viewport: null,
            online: null,
            visible: null,
            navigation: null,
            automated: null,
            pageAgeMs: null,
            referrer: null,
            language: null,
            timezone: null,
            connection: null,
            host: null,
            versions: {},
          },
          tags: {},
        }
    const span = new Date(issue.lastSeen).getTime() - new Date(issue.firstSeen).getTime()
    const total = Math.max(issue.eventCount, 1)
    const t = new Date(issue.lastSeen).getTime() - (span * index) / Math.max(total - 1, 1)
    return { ...base, id: `${issue.id}~${index}`, receivedAt: new Date(t).toISOString() }
  }
  const indexOf = (issue: Issue, eventId: string) => {
    const known = issueEvents(issue.id).findIndex((e) => e.id === eventId)
    if (known >= 0) return known
    const m = eventId.match(/~(\d+)$/)
    return m ? Number(m[1]) : 0
  }
  const cursorAt = (issue: Issue, index: number) => {
    const total = Math.max(issue.eventCount, 1)
    const id = (i: number) => issueEvents(issue.id)[i]?.id ?? `${issue.id}~${i}`
    return {
      index,
      total,
      newerId: index > 0 ? id(index - 1) : null,
      olderId: index < total - 1 ? id(index + 1) : null,
    }
  }

  /** Other issues' newest events in the same trace, in projects the viewer can see. */
  const relatedTo = (event: Event): RelatedEvent[] => {
    const trace = event.trace?.traceId
    if (!trace) return []
    const seen = new Set<string>()
    return events
      .filter((e) => e.trace?.traceId === trace && e.issueId !== event.issueId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .flatMap((e) => {
        const issue = issues.find((i) => i.id === e.issueId)
        if (!issue || !canSee(issue.projectId) || seen.has(issue.id)) return []
        seen.add(issue.id)
        return [{ issue: summary(issue), eventId: e.id, receivedAt: e.receivedAt }]
      })
  }

  const assignableFor = (projectId: string) =>
    members.filter((m) => m.joinedAt && (m.projectIds === "all" || m.projectIds.includes(projectId))).map(({ id, name, email }) => ({ id, name, email }))

  const applyChange = (issue: Issue, change: IssueChange) => {
    const at = NOW.toISOString()
    const by = { id: viewer.id, name: viewer.name, email: viewer.email }
    let entry: Activity
    switch (change.kind) {
      case "resolve":
        issue.status = "resolved"
        issue.snooze = null
        issue.isRegression = false
        entry = { kind: "resolved", at, by }
        break
      case "ignore":
        issue.status = "ignored"
        issue.snooze = null
        entry = { kind: "ignored", at, by }
        break
      case "reopen":
        issue.status = "unresolved"
        issue.snooze = null
        entry = { kind: "reopened", at, by }
        break
      case "snooze":
        issue.status = "snoozed"
        issue.snooze = change.snooze
        entry = { kind: "snoozed", at, by, snooze: change.snooze }
        break
      case "assign": {
        const to = change.personId ? (assignableFor(issue.projectId).find((p) => p.id === change.personId) ?? null) : null
        issue.assignee = to
        entry = { kind: "assigned", at, by, to }
        break
      }
    }
    issue.activity.unshift(entry)
  }

  const matches = (issue: Issue, i: IssueSummary, f: IssueFilter) => {
    if (f.ids && !f.ids.includes(i.id)) return false
    if (!inRange(i.lastSeen, f.range)) return false
    if (f.newInRange && !inRange(i.firstSeen, f.range)) return false
    if (f.projectIds.length && !f.projectIds.includes(i.projectId)) return false
    if (f.status !== "all" && i.status !== f.status) return false
    if (f.levels.length && !f.levels.includes(i.level)) return false
    if (f.environment !== "all" && !i.environments.includes(f.environment)) return false
    if (f.assignee === "me" && i.assignee?.id !== viewer.id) return false
    if (f.assignee === "unassigned" && i.assignee) return false
    const q = f.query.trim().toLowerCase()
    const tagValues = issue.tags.filter((t) => t.key === "user" || t.key === "url" || t.key === "release").flatMap((t) => t.values.map((v) => v.value))
    if (q && ![i.type, i.message, i.culprit ?? "", i.shortId, ...tagValues].some((s) => s.toLowerCase().includes(q))) return false
    return true
  }
  const sorters: Record<IssueFilter["sort"], (a: IssueSummary, b: IssueSummary) => number> = {
    last_seen: (a, b) => b.lastSeen.localeCompare(a.lastSeen),
    first_seen: (a, b) => b.firstSeen.localeCompare(a.firstSeen),
    events: (a, b) => b.eventsInRange - a.eventsInRange,
    users: (a, b) => b.userCount - a.userCount,
  }

  /** Hourly events from 24h before to 24h after a deploy (not in the fixtures); hours to come are null. */
  const aroundDeploy = (releaseId: string, eventCount: number, broke: boolean): TimeSeries => {
    const rnd = seeded(releaseId)
    const base = Math.max(1, Math.round(eventCount / 160))
    const counts = Array.from({ length: 48 }, (_, h) => {
      const after = h >= 24
      const lift = after && broke ? 2.6 + rnd() * 0.8 : 1
      const quiet = h % 24 < 6 ? 0.35 : 1
      return Math.round(base * lift * quiet * (0.55 + rnd() * 0.9))
    })
    const start = new Date(new Date(releases.find((r) => r.id === releaseId)!.deployedAt).getTime() - 24 * H)
    start.setUTCMinutes(0, 0, 0)
    const shown = counts.map((c, h) => (start.getTime() + (h + 1) * H > now ? null : c))
    return { bucket: "hour", start: start.toISOString(), counts: shown }
  }

  /** Daily uptime over 90 days: 100 except on incident days, null before it existed or while paused. */
  const uptimeByDay = (m: Monitor): TimeSeries => {
    const rnd = seeded(m.id)
    const start = Math.floor(now / D) * D - 89 * D
    const incidents = history[m.id]?.incidents ?? []
    const counts = Array.from({ length: 90 }, (_, d) => {
      const from = start + d * D
      if (m.state === "paused" && from >= new Date(m.since).getTime()) return null
      let downMs = 0
      for (const inc of incidents) {
        const a = Math.max(from, new Date(inc.startedAt).getTime())
        const b = Math.min(from + D, inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : now)
        if (b > a) downMs += b - a
      }
      // A blip now and then that never became an incident.
      if (!downMs && rnd() < 0.06) downMs = (1 + Math.floor(rnd() * 3)) * m.intervalSeconds * 1000
      return Math.round(10000 * (1 - downMs / D)) / 100
    })
    return { bucket: "day", start: new Date(start).toISOString(), counts }
  }

  const ENVIRONMENTS: Environment[] = ["production", "staging", "development"]

  return {
    // ── Reads ────────────────────────────────────────────────────────────
    getShell: () =>
      read(
        () => {
          const vis = visibleIssues()
          const order = shell.projects.map((p) => p.id)
          return {
            ...shell,
            projects: visibleProjects().sort((a, b) => {
              const ia = order.indexOf(a.id),
                ib = order.indexOf(b.id)
              return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
            }),
            // Each view counts exactly what opening it lists.
            savedViews: shell.savedViews.map((v) => {
              const f = { ...DEFAULT_FILTER, ...v.filter }
              return { ...v, count: vis.filter((i) => matches(i, summaryIn(i, f.range), f)).length }
            }),
            counts: {
              unresolved: vis.filter((i) => i.status === "unresolved").length,
              assignedToMe: vis.filter((i) => i.status === "unresolved" && i.assignee?.id === viewer.id).length,
              monitorsDown: monitorList.filter((m) => canSee(m.projectId) && m.state === "down").length,
            },
          }
        },
        shell,
        true,
      ),

    getOverview: (range, projectId) =>
      read(() => {
        if (projectId && !canSee(projectId)) return null
        const inScope = (id: string) => canSee(id) && (!projectId || id === projectId)
        const o = clone(overviews[range])
        const scoped = !!projectId || viewer.projectIds !== "all"
        const order = o.projects.map((p) => p.id)
        o.project = projectId ? clone(projectOf(projectId)) : null
        o.projects = projectList.filter((p) => inScope(p.id)).sort((a, b) => (order.indexOf(a.id) + 1 || 999) - (order.indexOf(b.id) + 1 || 999))
        if (!o.projects.length) return null
        // A project seen in the range had at least that one event in it.
        o.projectEvents = Object.fromEntries(o.projects.map((p) => [p.id, Math.max(o.projectEvents[p.id] ?? 0, p.lastEventAt && inRange(p.lastEventAt, range) ? 1 : 0)]))
        const fromFixture = o.attention.filter((i) => inScope(i.projectId)).map((a) => a.id)
        const extra = projectId
          ? issues
              .filter(
                (i) =>
                  i.projectId === projectId &&
                  !fromFixture.includes(i.id) &&
                  i.status === "unresolved" &&
                  inRange(i.lastSeen, range) &&
                  (i.isRegression || inRange(i.firstSeen, range)),
              )
              .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
              .map((i) => i.id)
          : []
        o.attention = [...fromFixture, ...extra]
          .slice(0, 8)
          .map((id) => issues.find((i) => i.id === id))
          .filter((i): i is Issue => !!i && i.status === "unresolved")
          .map((i) => summaryIn(i, range))
        o.monitorsAttention = monitorList
          .filter((m) => inScope(m.projectId) && (m.state === "down" || m.state === "degraded"))
          .sort((a, b) => (a.state === "down" ? 0 : 1) - (b.state === "down" ? 0 : 1))
        o.releases = o.releases.filter((r) => inScope(r.projectId))
        // Counted from the issues, so the cards agree with the lists they open.
        const seen = issues.filter((i) => inScope(i.projectId))
        o.kpis.newIssues.value = seen.filter((i) => inRange(i.firstSeen, range)).length
        o.kpis.regressions.value = seen.filter((i) => i.isRegression && i.status === "unresolved" && inRange(i.lastSeen, range)).length
        if (scoped) {
          // The KPIs and the chart cover only what this viewer (or this project) includes.
          const all = sum(Object.values(overviews[range].projectEvents))
          const mine = sum(Object.values(o.projectEvents))
          const share = all ? mine / all : 0
          const mons = monitorList.filter((m) => inScope(m.projectId) && m.state !== "paused")
          o.kpis.events = { value: mine, previous: Math.round(o.kpis.events.previous * share), trend: o.kpis.events.trend.map((x) => Math.round(x * share)) }
          o.kpis.newIssues.previous = Math.round(o.kpis.newIssues.previous * share)
          o.kpis.regressions.previous = Math.round(o.kpis.regressions.previous * share)
          if (mons.length) o.kpis.uptime = { ...o.kpis.uptime, value: Math.round((100 * sum(mons.map((m) => m.uptime30d))) / mons.length) / 100 }
          // Rounded cumulatively, so the chart adds up to the Events KPI exactly.
          const { fatal, error, warning } = o.events.byLevel
          const cells = [...fatal, ...error, ...warning]
          const chartTotal = sum(cells.map((x) => x ?? 0))
          let exact = 0
          let given = 0
          const fitted = cells.map((x) => {
            if (x === null) return null
            exact += chartTotal ? (x * mine) / chartTotal : 0
            const n = Math.round(exact) - given
            given += n
            return n
          })
          const n = fatal.length
          o.events = { ...o.events, byLevel: { fatal: fitted.slice(0, n), error: fitted.slice(n, 2 * n), warning: fitted.slice(2 * n) } }
        }
        if (scenario.params.allHealthy === "true") {
          o.projects = o.projects.map((p) => (p.health === "awaiting_first_event" ? p : { ...p, health: "healthy" }))
          o.attention = []
          o.monitorsAttention = []
          o.kpis.newIssues = { ...o.kpis.newIssues, value: 0 }
          o.kpis.regressions = { ...o.kpis.regressions, value: 0 }
          o.kpis.uptime = { ...o.kpis.uptime, value: 100 }
        }
        return o
      }, null),

    listProjects: (range) =>
      read(
        () => {
          const list = visibleProjects().sort(byHealth)
          return {
            projects: list,
            projectEvents: Object.fromEntries(list.map((p) => [p.id, overviews[range].projectEvents[p.id] ?? 0])),
            monitors: monitorList.filter((m) => canSee(m.projectId)),
          }
        },
        { projects: [], projectEvents: {}, monitors: [] },
      ),

    listIssues: (filter) =>
      read(
        () => {
          const list = visibleIssues()
            .map((i) => ({ issue: i, s: summaryIn(i, filter.range) }))
            .filter(({ issue, s }) => matches(issue, s, filter))
            .map(({ s }) => s)
            .sort(sorters[filter.sort])
          const shown = new Set(list.map((i) => i.projectId))
          const assignable = members
            .filter((m) => m.joinedAt !== null && (m.projectIds === "all" || [...shown].every((id) => (m.projectIds as string[]).includes(id))))
            .map(({ id, name, email }) => ({ id, name, email }))
          return { issues: list, total: list.length, assignable }
        },
        { issues: [], total: 0, assignable: [] },
      ),

    getIssue: (issueId) =>
      read(() => {
        const issue = issues.find((i) => i.id === issueId && canSee(i.projectId))
        if (!issue) return null
        const project = projectOf(issue.projectId)
        const startIndex = scenario.params.eventId ? indexOf(issue, scenario.params.eventId) : 0
        const event = eventAt(issue, startIndex)
        return {
          issue: clone(issue),
          project,
          event,
          cursor: cursorAt(issue, startIndex),
          related: relatedTo(event),
          history: issue.trend,
          releases: releases.filter((r) => r.projectId === issue.projectId && r.deployedAt >= issue.trend.start),
          assignable: assignableFor(issue.projectId),
        }
      }, null),

    getEvent: async (issueId, which) => {
      await wait(160)
      const issue = issues.find((i) => i.id === issueId)!
      const total = Math.max(issue.eventCount, 1)
      const index = which === "latest" ? 0 : which === "oldest" ? total - 1 : indexOf(issue, which.eventId)
      const event = eventAt(issue, index)
      return { event, cursor: cursorAt(issue, index), related: relatedTo(event) }
    },

    listReleases: (projectId) =>
      read(
        () => ({
          releases: releases
            .filter((r) => canSee(r.projectId) && (!projectId || r.projectId === projectId))
            .map(withHeld)
            .sort((a, b) => b.deployedAt.localeCompare(a.deployedAt)),
          projects: visibleProjects(),
        }),
        { releases: [], projects: [] },
      ),

    getRelease: (releaseId) =>
      read(() => {
        const found = releases.find((r) => r.id === releaseId && canSee(r.projectId))
        if (!found) return null
        const release = withHeld(found)
        const sameLine = releases
          .filter((r) => r.projectId === release.projectId && r.environment === release.environment)
          .sort((a, b) => b.deployedAt.localeCompare(a.deployedAt))
          .map(withHeld)
        const at = sameLine.findIndex((r) => r.id === release.id)
        const inProject = issues.filter((i) => i.projectId === release.projectId)
        const deployed = new Date(release.deployedAt).getTime()
        return {
          release,
          project: projectOf(release.projectId),
          previous: sameLine[at + 1] ?? null,
          next: sameLine[at - 1] ?? null,
          newIssues: inProject.filter((i) => i.firstRelease === release.version).map(summary),
          regressedIssues: inProject.filter((i) => i.regressedIn === release.version).map(summary),
          heldFixes: resolvedBefore(release.projectId, release.deployedAt).map(summary),
          around: aroundDeploy(release.id, release.eventCount, release.newIssues + release.regressedIssues > 0),
          afterHours: Math.max(0, Math.min(24, Math.floor((now - deployed) / H))),
        }
      }, null),

    listMonitors: () =>
      read(
        () => ({
          monitors: monitorList.filter((m) => canSee(m.projectId)),
          projects: visibleProjects(),
        }),
        { monitors: [], projects: [] },
      ),

    getMonitor: (monitorId) =>
      read(() => {
        const monitor = monitorList.find((m) => m.id === monitorId && canSee(m.projectId))
        if (!monitor) return null
        const h = history[monitorId] ?? { checks: [], incidents: [], responseTimes: { bucket: "hour", start: NOW.toISOString(), counts: [] } }
        const relatedIssues = (monitorRelatedIssues[monitorId] ?? [])
          .map((id) => issues.find((i) => i.id === id))
          .filter((i) => !!i)
          .map(summary)
        return { monitor: clone(monitor), project: projectOf(monitor.projectId), ...clone(h), relatedIssues, uptimeByDay: uptimeByDay(monitor) }
      }, null),

    getProjectSettings: (projectId) =>
      read(() => {
        const project = projectList.find((p) => p.id === projectId && canSee(p.id))
        if (!project) return null
        return {
          project: clone(project),
          setup: clone(setups.find((s) => s.projectId === projectId)!),
          monitors: project.monitorIds.map((id) => monitorList.find((m) => m.id === id)).filter((m): m is Monitor => !!m),
          members: members.filter((m) => m.projectIds === "all" || m.projectIds.includes(projectId)),
        }
      }, null),

    getProjectSetup: async (projectId) => {
      await wait(200)
      const setup = clone(setups.find((s) => s.projectId === projectId)!)
      // A freshly created project receives its first event after a few polls.
      // The "new-project-waiting" scenario holds the waiting state for screenshots.
      const n = (pollCount.get(projectId) ?? 0) + 1
      pollCount.set(projectId, n)
      if (!setup.firstEventAt && scenario.id !== "new-project-waiting" && n >= 4) {
        setup.firstEventAt = NOW.toISOString()
        setups.find((s) => s.projectId === projectId)!.firstEventAt = setup.firstEventAt
        const p = projectList.find((x) => x.id === projectId)
        if (p) Object.assign(p, { health: "healthy", lastEventAt: setup.firstEventAt, events24h: 1 })
      }
      return setup
    },

    getAlerts: () =>
      read(() => ({ rules: clone(rules), destinations: clone(dests), deliveries: clone(sent), projects: visibleProjects(), environments: ENVIRONMENTS }), {
        rules: [],
        destinations: [],
        deliveries: [],
        projects: visibleProjects(),
        environments: ENVIRONMENTS,
      }),

    getTeam: () => read(() => ({ members: clone(members), projects: visibleProjects() }), { members: [], projects: visibleProjects() }),

    getInvite: (token) => read(() => invites[token] ?? null, null),

    getAgents: () => read(() => ({ tokens: clone(tokens), mcpUrl: MCP_URL }), { tokens: [], mcpUrl: MCP_URL }),

    // ── Issues ───────────────────────────────────────────────────────────
    updateIssues: (ids, change) =>
      mutate("updateIssues", ["not_found", "permission_denied", "conflict"] as const, () => {
        const targets = issues.filter((i) => ids.includes(i.id))
        if (targets.length !== ids.length) return fail("not_found")
        targets.forEach((i) => applyChange(i, change))
        return { ok: true, value: targets.map(summary) }
      }),

    addIssueNote: (issueId, body) =>
      mutate("addIssueNote", ["not_found"] as const, () => {
        const issue = issues.find((i) => i.id === issueId)
        if (!issue) return fail("not_found")
        issue.activity.unshift({ kind: "note", at: NOW.toISOString(), by: { id: viewer.id, name: viewer.name, email: viewer.email }, body })
        return { ok: true, value: clone(issue) }
      }),

    mergeIssues: (targetId, sourceIds) =>
      mutate("mergeIssues", ["not_found", "different_projects"] as const, () => {
        const target = issues.find((i) => i.id === targetId && canSee(i.projectId))
        const sources = sourceIds.map((id) => issues.find((i) => i.id === id && canSee(i.projectId)))
        if (!target || sources.some((s) => !s)) return fail("not_found")
        const from = sources as Issue[]
        if (from.some((s) => s.projectId !== target.projectId)) return fail("different_projects")
        for (const s of from) {
          target.eventCount += s.eventCount
          target.eventsInRange += s.eventsInRange
          target.userCount += s.userCount
          if (s.firstSeen < target.firstSeen) target.firstSeen = s.firstSeen
          if (s.lastSeen > target.lastSeen) target.lastSeen = s.lastSeen
          target.trend = { ...target.trend, counts: target.trend.counts.map((c, k) => (c === null && s.trend.counts[k] === null ? null : (c ?? 0) + (s.trend.counts[k] ?? 0))) }
          target.activity.push(...s.activity.filter((a) => a.kind === "note"))
          issues.splice(issues.indexOf(s), 1)
        }
        target.activity.push({ kind: "merged", at: NOW.toISOString(), by: { id: viewer.id, name: viewer.name, email: viewer.email }, from: from.map((s) => s.shortId) })
        target.activity.sort((a, b) => b.at.localeCompare(a.at))
        return { ok: true, value: clone(target) }
      }),

    // ── Projects ─────────────────────────────────────────────────────────
    createProject: (input) =>
      mutate("createProject", ["name_taken", "invalid_name", "key_taken", "invalid_key"] as const, () => {
        if (!/[\p{L}\p{N}]/u.test(input.name)) return fail("invalid_name")
        if (projectList.some((p) => p.name.toLowerCase() === input.name.trim().toLowerCase())) return fail("name_taken")
        const taken = projectList.map((p) => p.key)
        const key = input.key?.trim().toUpperCase()
        if (key !== undefined && key !== "" && !KEY_PATTERN.test(key)) return fail("invalid_key")
        if (key && taken.includes(key)) return fail("key_taken")
        // Setup content comes from the never-connected fixture project.
        const base = setups.find((s) => s.projectId === "p-recipes")!
        const id = `p-${Date.now()}`
        const ingestKey = Math.random().toString(16).slice(2, 10) + base.ingestKey.slice(8)
        const project: Project = {
          id,
          key: key || uniqueKey(keyFromName(input.name), taken),
          name: input.name.trim(),
          client: input.client,
          url: input.url,
          repoUrl: input.repoUrl,
          runtimes: input.runtimes,
          environments: input.environments,
          health: "awaiting_first_event",
          lastEventAt: null,
          events24h: 0,
          unresolvedIssues: 0,
          monitorIds: [],
        }
        const setup: ProjectSetup = { ...clone(base), projectId: id, ingestKey, snippet: base.snippet.replaceAll(base.ingestKey, ingestKey) }
        projectList.push(project)
        setups.push(setup)
        return { ok: true, value: { project: clone(project), setup: clone(setup) } }
      }),

    updateProject: (projectId, input) =>
      mutate("updateProject", ["name_taken", "invalid_name", "permission_denied"] as const, () => {
        if (viewer.role !== "owner") return fail("permission_denied")
        if (!/[\p{L}\p{N}]/u.test(input.name)) return fail("invalid_name")
        const name = input.name.trim()
        if (projectList.some((p) => p.id !== projectId && p.name.toLowerCase() === name.toLowerCase())) return fail("name_taken")
        const p = projectOf(projectId)
        Object.assign(p, { ...input, name })
        return { ok: true, value: clone(p) }
      }),

    rotateIngestKey: (projectId) =>
      mutate("rotateIngestKey", ["permission_denied"] as const, () => {
        const s = setups.find((x) => x.projectId === projectId)!
        const next = s.ingestKey.replace(/.{8}$/, () => Math.random().toString(16).slice(2, 10))
        s.snippet = s.snippet.replaceAll(s.ingestKey, next)
        s.ingestKey = next
        return { ok: true, value: clone(s) }
      }),

    deleteProject: (projectId, confirmName) =>
      mutate("deleteProject", ["name_mismatch", "permission_denied"] as const, () => {
        if (projectOf(projectId).name !== confirmName) return fail("name_mismatch")
        projectList.splice(
          projectList.findIndex((p) => p.id === projectId),
          1,
        )
        return { ok: true, value: null }
      }),

    // ── Uptime ───────────────────────────────────────────────────────────
    saveMonitor: (input) =>
      mutate("saveMonitor", ["invalid_url", "unreachable"] as const, () => {
        if (!/^https?:\/\/[^\s/]+\.[^\s/]+/.test(input.url)) return fail("invalid_url")
        const existing = monitorList.find((m) => m.id === input.id)
        const monitor: Monitor = {
          ...(existing ?? {
            state: "up",
            since: NOW.toISOString(),
            uptime30d: 100,
            latestResponseMs: 180,
            recent: Array(30)
              .fill(null)
              .map((_, i) => (i > 26 ? "up" : null)),
          }),
          id: input.id ?? `mon-${Date.now()}`,
          projectId: input.projectId,
          name: input.name,
          url: input.url,
          intervalSeconds: input.intervalSeconds,
          ...(input.paused ? { state: "paused" as const } : existing?.state === "paused" ? { state: "up" as const } : {}),
        }
        if (existing) Object.assign(existing, monitor)
        else {
          monitorList.push(monitor)
          projectOf(input.projectId).monitorIds.push(monitor.id)
        }
        return { ok: true, value: clone(monitor) }
      }),

    deleteMonitor: (monitorId) =>
      mutate("deleteMonitor", ["not_found", "permission_denied"] as const, () => {
        const i = monitorList.findIndex((m) => m.id === monitorId && canSee(m.projectId))
        if (i < 0) return fail("not_found")
        if (viewer.role !== "owner") return fail("permission_denied")
        const [m] = monitorList.splice(i, 1)
        const p = projectOf(m.projectId)
        p.monitorIds = p.monitorIds.filter((id) => id !== monitorId)
        return { ok: true, value: null }
      }),

    checkMonitorNow: (monitorId) =>
      mutate("checkMonitorNow", ["not_found"] as const, () => {
        const m = monitorList.find((x) => x.id === monitorId && canSee(x.projectId))
        if (!m) return fail("not_found")
        const last = history[monitorId]?.checks[0]
        const check: UptimeCheck =
          m.state === "down" && last
            ? { ...last, at: new Date().toISOString() }
            : { at: new Date().toISOString(), ok: true, httpStatus: 200, responseMs: m.latestResponseMs ?? 200, error: null, region: last?.region ?? "London" }
        history[monitorId]?.checks.unshift(check)
        m.recent = [...m.recent.slice(1), check.ok ? (m.state === "degraded" ? "degraded" : "up") : "down"]
        return { ok: true, value: check }
      }),

    // ── Alerts ───────────────────────────────────────────────────────────
    saveAlertRule: (input) =>
      mutate("saveAlertRule", ["no_destination", "no_trigger"] as const, () => {
        if (!input.triggers.length) return fail("no_trigger")
        if (!input.destinationIds.length) return fail("no_destination")
        const existing = rules.find((r) => r.id === input.id)
        const rule = { ...input, id: input.id ?? `a-${Date.now()}`, lastFiredAt: existing?.lastFiredAt ?? null }
        if (existing) Object.assign(existing, rule)
        else rules.push(rule)
        return { ok: true, value: rule }
      }),

    deleteAlertRule: (ruleId) =>
      mutate("deleteAlertRule", ["not_found"] as const, () => {
        const i = rules.findIndex((r) => r.id === ruleId)
        if (i < 0) return fail("not_found")
        rules.splice(i, 1)
        return { ok: true, value: null }
      }),

    saveDestination: (input) =>
      mutate("saveDestination", ["invalid_email", "invalid_webhook"] as const, () => {
        if (input.kind === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.address)) return fail("invalid_email")
        if (input.kind === "webhook" && !input.url.startsWith("https://")) return fail("invalid_webhook")
        const d = { ...input, id: input.id ?? `d-${Date.now()}` }
        const existing = dests.findIndex((x) => x.id === d.id)
        if (existing >= 0) dests.splice(existing, 1, d)
        else dests.push(d)
        return { ok: true, value: d }
      }),

    testDestination: async (destinationId) => {
      const r = await mutate("testDestination", ["delivery_failed"] as const, () => ({ ok: true, value: { deliveredAt: NOW.toISOString() } }))
      // The scenario breaks the webhooks (its message is a 410), not every destination.
      const email = dests.find((d) => d.id === destinationId)?.kind === "email"
      return !r.ok && email ? { ok: true, value: { deliveredAt: NOW.toISOString() } } : r
    },

    deleteDestination: (destinationId) =>
      mutate("deleteDestination", ["not_found"] as const, () => {
        const i = dests.findIndex((d) => d.id === destinationId)
        if (i < 0) return fail("not_found")
        dests.splice(i, 1)
        const rulesTurnedOff: string[] = []
        for (const r of rules) {
          if (!r.destinationIds.includes(destinationId)) continue
          r.destinationIds = r.destinationIds.filter((id) => id !== destinationId)
          if (!r.destinationIds.length && r.enabled) {
            r.enabled = false
            rulesTurnedOff.push(r.id)
          }
        }
        return { ok: true, value: { rulesTurnedOff } }
      }),

    // ── Team ─────────────────────────────────────────────────────────────
    inviteMember: (input) =>
      mutate("inviteMember", ["already_member", "invalid_email"] as const, () => {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) return fail("invalid_email")
        if (members.some((m) => m.email.toLowerCase() === input.email.toLowerCase())) return fail("already_member")
        const m: Member = {
          id: `m-${Date.now()}`,
          name: input.email,
          email: input.email,
          role: "collaborator",
          projectIds: input.projectIds,
          joinedAt: null,
          invitedAt: NOW.toISOString(),
          inviteExpiresAt: new Date(now + 7 * D).toISOString(),
        }
        members.push(m)
        return { ok: true, value: m }
      }),

    updateMemberAccess: (memberId, projectIds) =>
      mutate("updateMemberAccess", ["permission_denied"] as const, () => {
        const m = members.find((x) => x.id === memberId)!
        m.projectIds = projectIds
        return { ok: true, value: clone(m) }
      }),

    removeMember: (memberId) =>
      mutate("removeMember", ["cannot_remove_owner"] as const, () => {
        const i = members.findIndex((x) => x.id === memberId)
        if (members[i]?.role === "owner") return fail("cannot_remove_owner")
        members.splice(i, 1)
        return { ok: true, value: null }
      }),

    resendInvite: (memberId) =>
      mutate("resendInvite", ["not_found", "already_member"] as const, () => {
        const m = members.find((x) => x.id === memberId)
        if (!m) return fail("not_found")
        if (m.joinedAt) return fail("already_member")
        m.invitedAt = NOW.toISOString()
        m.inviteExpiresAt = new Date(now + 7 * D).toISOString()
        return { ok: true, value: clone(m) }
      }),

    acceptInvite: (token) =>
      mutate("acceptInvite", ["invite_expired", "invite_used"] as const, () => {
        if (token === "expired") return fail("invite_expired")
        if (token === "used") return fail("invite_used")
        return { ok: true, value: members.find((m) => m.id === "m-pending")! }
      }),

    // ── Agents ───────────────────────────────────────────────────────────
    createAccessToken: (name) =>
      mutate("createAccessToken", ["invalid_name"] as const, () => {
        const trimmed = name.trim()
        if (!/[\p{L}\p{N}]/u.test(trimmed)) return { ...fail("invalid_name"), message: OP_MESSAGES["createAccessToken.invalid_name"]! }
        const token: AccessToken = { id: `at-${Date.now()}`, name: trimmed, createdAt: NOW.toISOString(), lastUsedAt: null }
        tokens.unshift(token)
        return { ok: true, value: { token: clone(token), secret: "ba_7Qm2xVb9RkTn4LpWc8YdHs3Ef6Gj5Nu1" } }
      }),

    revokeAccessToken: (tokenId) =>
      mutate("revokeAccessToken", ["not_found"] as const, () => {
        const i = tokens.findIndex((t) => t.id === tokenId)
        if (i < 0) return { ...fail("not_found"), message: OP_MESSAGES["revokeAccessToken.not_found"]! }
        tokens.splice(i, 1)
        return { ok: true, value: null }
      }),

    // ── Session ──────────────────────────────────────────────────────────
    signIn: (email) => mutate("signIn", ["unknown_email"] as const, () => ({ ok: true, value: { sentTo: email, returnsTo: "/" } })),

    // ── Live ─────────────────────────────────────────────────────────────
    // Quiet and connected by default. `live=replay` plays fixtures/live.ts; `live=down`
    // shows the stream dropping and retrying.
    subscribe: (listener) => {
      const timers: ReturnType<typeof setTimeout>[] = []
      const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms))
      if (scenario.params.live === "down") {
        listener.status("connecting")
        later(1_200, () => listener.status("down"))
      } else {
        listener.status("open")
        if (scenario.params.live === "replay")
          for (const { afterMs, event } of liveReplay) if (event.kind === "resync" || canSee(event.projectId)) later(afterMs, () => listener.event(clone(event)))
      }
      return () => timers.forEach(clearTimeout)
    },
  }
}
