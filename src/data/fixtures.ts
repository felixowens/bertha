import type { Backend, IssueChange } from "../../packet/contract/actions"
import type {
  Activity,
  Environment,
  Event,
  Issue,
  IssueFilter,
  IssueSummary,
  Member,
  Monitor,
  ProjectSetup,
  Result,
  TimeSeries,
} from "../../packet/contract/domain"
import { alertRules, destinations } from "../../packet/fixtures/alerts"
import { events } from "../../packet/fixtures/events"
import { issues as issueFixtures } from "../../packet/fixtures/issues"
import { monitorHistory, monitorRelatedIssues, monitors } from "../../packet/fixtures/monitors"
import { overviews } from "../../packet/fixtures/overview"
import { members as memberFixtures } from "../../packet/fixtures/people"
import { projectSetups, projects } from "../../packet/fixtures/projects"
import { releases } from "../../packet/fixtures/releases"
import { invites, shells } from "../../packet/fixtures/shell"
import type { ActiveScenario } from "./scenario"

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const never = <T>() => new Promise<T>(() => {})

/** The fixtures' "now". Every relative time in the prototype is measured from here. */
export const NOW = new Date("2026-10-13T09:12:00Z")

/** Messages a real backend would send with each failure kind. */
const MESSAGES: Record<string, string> = {
  not_found: "That no longer exists. It may have been deleted with its project.",
  permission_denied: "You don't have access to do that any more.",
  conflict: "Someone changed one of these issues a moment ago. Showing the current state.",
  name_taken: "A project with that name already exists.",
  invalid_name: "Use at least one letter or number.",
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
  const canSee = (projectId: string) =>
    viewer.projectIds === "all" || viewer.projectIds.includes(projectId)

  // In-memory state so triage feels real within a session.
  const issues: Issue[] = clone(issueFixtures)
  const members: Member[] = clone(memberFixtures)
  const rules = clone(alertRules)
  const dests = clone(destinations)
  const setups: ProjectSetup[] = clone(projectSetups)
  const monitorList: Monitor[] = clone(monitors)
  // The calm scenario: every monitor that's running is up, and its recent checks agree.
  if (scenario.params.allHealthy === "true") {
    for (const m of monitorList)
      if (m.state !== "paused") Object.assign(m, { state: "up", recent: m.recent.map((r) => (r === null ? null : "up")) })
  }
  const pollCount = new Map<string, number>()

  const read = async <T>(value: () => T, empty: T): Promise<T> => {
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
  const fail = <F extends string>(failure: F) =>
    ({ ok: false, failure, message: MESSAGES[failure] ?? failure }) as const
  const mutate = async <T, F extends string>(
    op: keyof Backend,
    kinds: readonly F[],
    run: () => Result<T, F>,
  ): Promise<Result<T, F>> => {
    await wait(420)
    const f = forced(op, kinds)
    return f ? fail(f) : run()
  }

  const summary = (i: Issue): IssueSummary => {
    const { firstRelease: _a, regressedIn: _b, tags: _c, activity: _d, ...s } = i
    return s
  }
  const projectOf = (id: string) => projects.find((p) => p.id === id)!
  const visibleIssues = () => issues.filter((i) => canSee(i.projectId))

  const issueEvents = (issueId: string) =>
    events
      .filter((e) => e.issueId === issueId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))

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
                frames: [
                  { file: issue.culprit, function: null, line: null, column: null, inApp: true, mapped: true, context: null },
                ],
              }
            : null,
          breadcrumbs: [],
          request: null,
          user: null,
          context: { browser: null, os: null, runtime: null, userAgent: null },
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

  const assignableFor = (projectId: string) =>
    members
      .filter((m) => m.joinedAt && (m.projectIds === "all" || m.projectIds.includes(projectId)))
      .map(({ id, name, email }) => ({ id, name, email }))

  const applyChange = (issue: Issue, change: IssueChange) => {
    const at = NOW.toISOString()
    const by = { id: viewer.id, name: viewer.name, email: viewer.email }
    let entry: Activity
    switch (change.kind) {
      case "resolve":
      case "ignore":
        issue.status = change.kind === "resolve" ? "resolved" : "ignored"
        issue.snooze = null
        entry = { kind: change.kind === "resolve" ? "resolved" : "ignored", at, by }
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

  const matches = (i: IssueSummary, f: IssueFilter) => {
    if (f.projectIds.length && !f.projectIds.includes(i.projectId)) return false
    if (f.status !== "all" && i.status !== f.status) return false
    if (f.levels.length && !f.levels.includes(i.level)) return false
    if (f.environment !== "all" && !i.environments.includes(f.environment)) return false
    if (f.assignee === "me" && i.assignee?.id !== viewer.id) return false
    if (f.assignee === "unassigned" && i.assignee) return false
    const q = f.query.trim().toLowerCase()
    if (q && ![i.type, i.message, i.culprit ?? "", i.shortId].some((s) => s.toLowerCase().includes(q))) return false
    return true
  }
  const sorters: Record<IssueFilter["sort"], (a: IssueSummary, b: IssueSummary) => number> = {
    last_seen: (a, b) => b.lastSeen.localeCompare(a.lastSeen),
    first_seen: (a, b) => b.firstSeen.localeCompare(a.firstSeen),
    events: (a, b) => b.eventCount - a.eventCount,
    users: (a, b) => b.userCount - a.userCount,
  }

  /** Hourly events from 24h before to 24h after a deploy (not in the fixtures). */
  const aroundDeploy = (releaseId: string, eventCount: number, broke: boolean): TimeSeries => {
    const rnd = seeded(releaseId)
    const base = Math.max(1, Math.round(eventCount / 160))
    const counts = Array.from({ length: 48 }, (_, h) => {
      const after = h >= 24
      const lift = after && broke ? 2.6 + rnd() * 0.8 : 1
      const quiet = h % 24 < 6 ? 0.35 : 1
      return Math.round(base * lift * quiet * (0.55 + rnd() * 0.9))
    })
    const start = new Date(new Date(releases.find((r) => r.id === releaseId)!.deployedAt).getTime() - 24 * 3600e3)
    start.setUTCMinutes(0, 0, 0)
    return { bucket: "hour", start: start.toISOString(), counts }
  }

  const ENVIRONMENTS: Environment[] = ["production", "staging", "development"]

  return {
    // ── Reads ────────────────────────────────────────────────────────────
    getShell: () =>
      read(() => {
        const vis = visibleIssues()
        return {
          ...shell,
          counts: {
            unresolved: vis.filter((i) => i.status === "unresolved").length,
            assignedToMe: vis.filter((i) => i.status === "unresolved" && i.assignee?.id === viewer.id).length,
            monitorsDown: monitorList.filter((m) => canSee(m.projectId) && m.state === "down").length,
          },
        }
      }, shell),

    getOverview: (range) =>
      read(() => {
        const o = clone(overviews[range])
        o.projects = o.projects.filter((p) => canSee(p.id))
        o.attention = o.attention
          .filter((i) => canSee(i.projectId))
          .map((a) => summary(issues.find((i) => i.id === a.id) ?? (a as Issue)))
          .filter((i) => i.status === "unresolved")
        o.monitorsDown = o.monitorsDown.filter((m) => canSee(m.projectId))
        o.releases = o.releases.filter((r) => canSee(r.projectId))
        if (scenario.params.allHealthy === "true") {
          o.projects = o.projects.map((p) =>
            p.health === "awaiting_first_event" ? p : { ...p, health: "healthy" },
          )
          o.attention = []
          o.monitorsDown = []
          o.kpis.newIssues = { ...o.kpis.newIssues, value: 0 }
          o.kpis.regressions = { ...o.kpis.regressions, value: 0 }
          o.kpis.uptime = { ...o.kpis.uptime, value: 100 }
        }
        return o
      }, clone(overviews[range])),

    listIssues: (filter) =>
      read(
        () => {
          const list = visibleIssues().map(summary).filter((i) => matches(i, filter)).sort(sorters[filter.sort])
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
        return {
          issue: clone(issue),
          project,
          event: eventAt(issue, startIndex),
          cursor: cursorAt(issue, startIndex),
          history: issue.trend,
          releases: releases.filter(
            (r) => r.projectId === issue.projectId && r.deployedAt >= issue.trend.start,
          ),
          assignable: assignableFor(issue.projectId),
        }
      }, null),

    getEvent: async (issueId, which) => {
      await wait(160)
      const issue = issues.find((i) => i.id === issueId)!
      const total = Math.max(issue.eventCount, 1)
      const index = which === "latest" ? 0 : which === "oldest" ? total - 1 : indexOf(issue, which.eventId)
      return { event: eventAt(issue, index), cursor: cursorAt(issue, index) }
    },

    listReleases: (projectId) =>
      read(
        () => ({
          releases: releases
            .filter((r) => canSee(r.projectId) && (!projectId || r.projectId === projectId))
            .sort((a, b) => b.deployedAt.localeCompare(a.deployedAt)),
          projects: projects.filter((p) => canSee(p.id)),
        }),
        { releases: [], projects: [] },
      ),

    getRelease: (releaseId) =>
      read(() => {
        const release = releases.find((r) => r.id === releaseId && canSee(r.projectId))
        if (!release) return null
        const sameLine = releases
          .filter((r) => r.projectId === release.projectId && r.environment === release.environment)
          .sort((a, b) => b.deployedAt.localeCompare(a.deployedAt))
        const previous = sameLine[sameLine.findIndex((r) => r.id === release.id) + 1] ?? null
        const inProject = issues.filter((i) => i.projectId === release.projectId)
        return {
          release,
          project: projectOf(release.projectId),
          previous,
          newIssues: inProject.filter((i) => i.firstRelease === release.version).map(summary),
          regressedIssues: inProject.filter((i) => i.regressedIn === release.version).map(summary),
          around: aroundDeploy(release.id, release.eventCount, release.newIssues + release.regressedIssues > 0),
        }
      }, null),

    listMonitors: () =>
      read(
        () => ({
          monitors: monitorList.filter((m) => canSee(m.projectId)),
          projects: projects.filter((p) => canSee(p.id)),
        }),
        { monitors: [], projects: [] },
      ),

    getMonitor: (monitorId) =>
      read(() => {
        const monitor = monitorList.find((m) => m.id === monitorId && canSee(m.projectId))
        if (!monitor) return null
        const h = monitorHistory[monitorId] ?? { checks: [], incidents: [], responseTimes: { bucket: "hour", start: NOW.toISOString(), counts: [] } }
        const relatedIssues = (monitorRelatedIssues[monitorId] ?? []).map((id) => issues.find((i) => i.id === id)).filter((i) => !!i).map(summary)
        return { monitor, project: projectOf(monitor.projectId), ...clone(h), relatedIssues }
      }, null),

    getProjectSettings: (projectId) =>
      read(() => {
        const project = projects.find((p) => p.id === projectId && canSee(p.id))
        if (!project) return null
        return {
          project,
          setup: setups.find((s) => s.projectId === projectId)!,
          monitor: monitorList.find((m) => m.projectId === projectId) ?? null,
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
      }
      return setup
    },

    getAlerts: () =>
      read(
        () => ({ rules: clone(rules), destinations: clone(dests), projects, environments: ENVIRONMENTS }),
        { rules: [], destinations: [], projects, environments: ENVIRONMENTS },
      ),

    getTeam: () => read(() => ({ members: clone(members), projects }), { members: [], projects }),

    getInvite: (token) => read(() => invites[token] ?? null, null),

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

    // ── Projects ─────────────────────────────────────────────────────────
    createProject: (input) =>
      mutate("createProject", ["name_taken", "invalid_name"] as const, () => {
        if (!/[\p{L}\p{N}]/u.test(input.name)) return fail("invalid_name")
        if (projects.some((p) => p.name.toLowerCase() === input.name.trim().toLowerCase())) return fail("name_taken")
        // Reuse the never-connected fixture project so the setup step has real content.
        const base = projects.find((p) => p.id === "p-recipes")!
        const project = { ...base, name: input.name.trim(), client: input.client, url: input.url, runtimes: input.runtimes, environments: input.environments }
        return { ok: true, value: { project, setup: clone(setups.find((s) => s.projectId === base.id)!) } }
      }),

    rotateIngestKey: (projectId) =>
      mutate("rotateIngestKey", ["permission_denied"] as const, () => {
        const s = setups.find((x) => x.projectId === projectId)!
        s.ingestKey = s.ingestKey.replace(/.{8}$/, () => Math.random().toString(16).slice(2, 10))
        return { ok: true, value: clone(s) }
      }),

    deleteProject: (projectId, confirmName) =>
      mutate("deleteProject", ["name_mismatch", "permission_denied"] as const, () =>
        projectOf(projectId).name === confirmName ? { ok: true, value: null } : fail("name_mismatch"),
      ),

    // ── Uptime ───────────────────────────────────────────────────────────
    saveMonitor: (input) =>
      mutate("saveMonitor", ["invalid_url", "unreachable"] as const, () => {
        if (!/^https?:\/\/[^\s/]+\.[^\s/]+/.test(input.url)) return fail("invalid_url")
        const existing = monitorList.find((m) => m.id === input.id)
        const monitor: Monitor = {
          ...(existing ?? { state: "up", since: NOW.toISOString(), uptime30d: 100, latestResponseMs: 180, recent: Array(30).fill(null).map((_, i) => (i > 26 ? "up" : null)) }),
          id: input.id ?? `mon-${Date.now()}`,
          projectId: input.projectId,
          name: input.name,
          url: input.url,
          intervalSeconds: input.intervalSeconds,
          ...(input.paused ? { state: "paused" as const } : {}),
        }
        if (existing) Object.assign(existing, monitor)
        else monitorList.push(monitor)
        return { ok: true, value: monitor }
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
        const d = { ...input, id: `d-${Date.now()}` }
        dests.push(d)
        return { ok: true, value: d }
      }),

    testDestination: () =>
      mutate("testDestination", ["delivery_failed"] as const, () => ({ ok: true, value: { deliveredAt: NOW.toISOString() } })),

    // ── Team ─────────────────────────────────────────────────────────────
    inviteMember: (input) =>
      mutate("inviteMember", ["already_member", "invalid_email"] as const, () => {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) return fail("invalid_email")
        if (members.some((m) => m.email.toLowerCase() === input.email.toLowerCase())) return fail("already_member")
        const m: Member = { id: `m-${Date.now()}`, name: input.email, email: input.email, role: "collaborator", projectIds: input.projectIds, joinedAt: null }
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

    acceptInvite: (token) =>
      mutate("acceptInvite", ["invite_expired", "invite_used"] as const, () => {
        if (token === "expired") return fail("invite_expired")
        if (token === "used") return fail("invite_used")
        return { ok: true, value: members.find((m) => m.id === "m-pending")! }
      }),

    // ── Session ──────────────────────────────────────────────────────────
    signIn: (email) =>
      mutate("signIn", ["unknown_email"] as const, () => ({ ok: true, value: { sentTo: email, returnsTo: "/" } })),
  }
}
