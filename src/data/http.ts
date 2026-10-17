import type { Backend, IssueChange } from "../../packet/contract/actions"
import type { IssueStatus, IssueSummary, Result } from "../../packet/contract/domain"

/**
 * `Backend` over bertha's HTTP API (`/api/v1`). Reads return the data or throw; a
 * missing detail comes back as `null`. Mutations return the server's `Result` as-is.
 */

const BASE = "/api/v1"

/** Pages that work signed out: a 401 there is not a reason to leave. */
const SIGNED_OUT_PAGES = ["/sign-in", "/invite/"]

class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function toSignIn() {
  const { pathname, search } = window.location
  if (SIGNED_OUT_PAGES.some((p) => pathname.startsWith(p))) return
  const next = encodeURIComponent(pathname + search)
  window.location.assign(`/sign-in?next=${next}`)
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(method === "POST" ? { "Content-Type": "application/json", "X-Bertha": "1" } : {}),
      },
      body: method === "POST" ? JSON.stringify(body ?? null) : undefined,
    })
  } catch {
    throw new ApiError(0, "Can't reach bertha. Check your connection and try again.")
  }
  if (res.ok) return (await res.json()) as T
  if (res.status === 401) toSignIn()
  const message = await res
    .json()
    .then((b: { error?: string }) => b.error)
    .catch(() => undefined)
  throw new ApiError(res.status, message ?? `bertha answered ${res.status}. Try again.`)
}

const get = <T>(path: string) => request<T>("GET", path)
const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body)
const seg = encodeURIComponent

export function createHttpBackend(): Backend {
  /**
   * The last state of each issue this tab saw. Sent with `updateIssues` so the server
   * can answer `conflict` when someone else triaged an issue in the meantime.
   */
  const seen = new Map<string, { status: IssueStatus; assigneeId: string | null }>()
  const remember = (issues: Pick<IssueSummary, "id" | "status" | "assignee">[]) => {
    for (const i of issues) seen.set(i.id, { status: i.status, assigneeId: i.assignee?.id ?? null })
  }

  return {
    // ── Reads ──
    getShell: () => get("/shell"),
    getOverview: (range) => get(`/overview?range=${seg(range)}`),
    listIssues: async (filter) => {
      const list = await post<Awaited<ReturnType<Backend["listIssues"]>>>("/issues/query", { filter })
      remember(list.issues)
      return list
    },
    getIssue: async (issueId) => {
      const detail = await get<Awaited<ReturnType<Backend["getIssue"]>>>(`/issues/${seg(issueId)}`)
      if (detail) remember([detail.issue])
      return detail
    },
    getEvent: (issueId, which) =>
      get(`/issues/${seg(issueId)}/events/${seg(typeof which === "string" ? which : which.eventId)}`),
    listReleases: (projectId) => get(projectId ? `/releases?project=${seg(projectId)}` : "/releases"),
    getRelease: (releaseId) => get(`/releases/${seg(releaseId)}`),
    listMonitors: () => get("/monitors"),
    getMonitor: (monitorId) => get(`/monitors/${seg(monitorId)}`),
    getProjectSettings: (projectId) => get(`/projects/${seg(projectId)}/settings`),
    getProjectSetup: (projectId) => get(`/projects/${seg(projectId)}/setup`),
    getAlerts: () => get("/alerts"),
    getTeam: () => get("/team"),
    getInvite: (token) => get(`/invites/${seg(token)}`),

    // ── Issues ──
    updateIssues: async (issueIds, change: IssueChange) => {
      const known = issueIds.flatMap((id) => {
        const s = seen.get(id)
        return s ? [{ id, ...s }] : []
      })
      const result = await post<Result<IssueSummary[], "not_found" | "permission_denied" | "conflict">>(
        "/issues/update",
        { issueIds, change, seen: known.length === issueIds.length ? known : undefined },
      )
      if (result.ok) remember(result.value)
      else if (result.failure === "conflict") for (const id of issueIds) seen.delete(id)
      return result
    },
    addIssueNote: (issueId, body) => post(`/issues/${seg(issueId)}/notes`, { body }),

    // ── Projects ──
    createProject: (input) => post("/projects", input),
    rotateIngestKey: (projectId) => post(`/projects/${seg(projectId)}/rotate-key`),
    deleteProject: (projectId, confirmName) => post(`/projects/${seg(projectId)}/delete`, { confirmName }),

    // ── Uptime ──
    saveMonitor: (input) => post("/monitors", input),

    // ── Alerts ──
    saveAlertRule: (input) => post("/alerts/rules", input),
    deleteAlertRule: (ruleId) => post(`/alerts/rules/${seg(ruleId)}/delete`),
    saveDestination: (input) => post("/alerts/destinations", input),
    testDestination: (destinationId) => post(`/alerts/destinations/${seg(destinationId)}/test`),

    // ── Team ──
    inviteMember: (input) => post("/team/invites", input),
    updateMemberAccess: (memberId, projectIds) => post(`/team/members/${seg(memberId)}/access`, { projectIds }),
    removeMember: (memberId) => post(`/team/members/${seg(memberId)}/remove`),
    acceptInvite: (token) => post(`/invites/${seg(token)}/accept`),

    // ── Session ──
    signIn: (email) => {
      // Sign-in carries `?next=` from the page that sent the person here.
      const next = new URLSearchParams(window.location.search).get("next") ?? undefined
      return post("/sign-in", { email, next })
    },
  }
}

/** Ends the session. Not part of `Backend`: the prototype had no sign-out. */
export async function signOut(): Promise<void> {
  await post("/sign-out")
  window.location.assign("/sign-in")
}
