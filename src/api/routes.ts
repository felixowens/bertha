// Where each `Backend` method goes on the server: its route, the body it sends and the
// reply it expects, all in the types generated from Rust. `src/data/http.ts` makes its
// requests from this table. A new `Backend` method doesn't compile without an entry,
// `contract-check.ts` proves each reply equals the contract, and `e2e/contract.spec.ts`
// calls every entry and holds the real JSON to the contract.
import type { Backend } from "../contract/actions"
import type { Result } from "../contract/domain"
import type * as G from "./generated/api"

export type Route<Reply> = {
  method: "GET" | "POST"
  path: string
  body?: unknown
  /** Never set. Carries the reply's type. */
  reply?: Reply
}

/** Every `Backend` method that is a request. `subscribe` is a stream. */
export type Wired = Exclude<keyof Backend, "subscribe">

const read = <Reply>(path: string): Route<Reply> => ({ method: "GET", path })
const write = <Reply, Body = undefined>(path: string, ...body: [Body] extends [undefined] ? [] : [Body]): Route<Reply> => ({
  method: "POST",
  path,
  body: body[0],
})
const seg = encodeURIComponent

export const routes = {
  // ── Reads ──
  getShell: () => read<G.ShellData>("/shell"),
  getOverview: (range, projectId) => read<G.OverviewData | null>(`/overview?range=${seg(range)}${projectId ? `&project=${seg(projectId)}` : ""}`),
  listProjects: (range) => read<G.ProjectsData>(`/projects?range=${seg(range)}`),
  listIssues: (filter) => write<G.IssueList, G.IssueQuery>("/issues/query", { filter }),
  getIssue: (issueId) => read<G.IssueDetail | null>(`/issues/${seg(issueId)}`),
  getEvent: (issueId, which) => read<G.EventAt>(`/issues/${seg(issueId)}/events/${seg(typeof which === "string" ? which : which.eventId)}`),
  getTrace: (issueId, eventId) => read<G.EventTrace | null>(`/issues/${seg(issueId)}/events/${seg(eventId)}/trace`),
  getEventLogs: (issueId, eventId) => read<G.EventLogs | null>(`/issues/${seg(issueId)}/events/${seg(eventId)}/logs`),
  listLogs: (filter, page) => write<G.LogList, G.LogQuery>("/logs/query", page ? { filter, page } : { filter }),
  listLogPatterns: (filter) => write<G.LogPatternList, Pick<G.LogQuery, "filter">>("/logs/patterns", { filter }),
  listReleases: (projectId) => read<G.ReleaseList>(projectId ? `/releases?project=${seg(projectId)}` : "/releases"),
  getRelease: (releaseId) => read<G.ReleaseDetail | null>(`/releases/${seg(releaseId)}`),
  listMonitors: () => read<G.UptimeData>("/monitors"),
  getMonitor: (monitorId) => read<G.MonitorDetail | null>(`/monitors/${seg(monitorId)}`),
  getProjectSettings: (projectId) => read<G.ProjectSettings | null>(`/projects/${seg(projectId)}/settings`),
  getProjectSetup: (projectId) => read<G.ProjectSetup>(`/projects/${seg(projectId)}/setup`),
  getAlerts: () => read<G.AlertsData>("/alerts"),
  getTeam: () => read<G.TeamData>("/team"),
  getInvite: (token) => read<G.InviteData | null>(`/invites/${seg(token)}`),
  getAgents: () => read<G.AgentsData>("/agents"),

  // ── Issues ──
  updateIssues: (issueIds, change, seen?: G.UpdateIssuesInput["seen"]) =>
    write<Result<G.IssueSummary[], G.UpdateIssuesFailure>, G.UpdateIssuesInput>("/issues/update", { issueIds, change, seen }),
  addIssueNote: (issueId, body) => write<Result<G.Issue, G.AddIssueNoteFailure>, G.NoteInput>(`/issues/${seg(issueId)}/notes`, { body }),
  mergeIssues: (targetId, sourceIds) => write<Result<G.Issue, G.MergeIssuesFailure>, G.MergeIssuesInput>("/issues/merge", { targetId, sourceIds }),
  startTriage: (issueId, takeOver) => write<Result<G.Triage, G.StartTriageFailure>, G.StartTriageInput>(`/issues/${seg(issueId)}/triages`, takeOver ? { takeOver } : {}),
  updateTriage: (triageId, input) => write<Result<G.Triage, G.UpdateTriageFailure>, G.TriageInput>(`/triages/${seg(triageId)}`, input),

  // ── Projects ──
  createProject: (input) => write<Result<G.CreatedProject, G.CreateProjectFailure>, G.CreateProjectInput>("/projects", input),
  updateProject: (projectId, input) => write<Result<G.Project, G.UpdateProjectFailure>, G.ProjectInput>(`/projects/${seg(projectId)}`, input),
  rotateIngestKey: (projectId) => write<Result<G.ProjectSetup, G.RotateIngestKeyFailure>>(`/projects/${seg(projectId)}/rotate-key`),
  deleteProject: (projectId, confirmName) => write<Result<null, G.DeleteProjectFailure>, G.DeleteProjectInput>(`/projects/${seg(projectId)}/delete`, { confirmName }),

  // ── Uptime ──
  saveMonitor: (input) => write<Result<G.Monitor, G.SaveMonitorFailure>, G.MonitorInput>("/monitors", input),
  deleteMonitor: (monitorId) => write<Result<null, G.DeleteMonitorFailure>>(`/monitors/${seg(monitorId)}/delete`),
  checkMonitorNow: (monitorId) => write<Result<G.UptimeCheck, G.CheckMonitorNowFailure>>(`/monitors/${seg(monitorId)}/check`),

  // ── Alerts ──
  saveAlertRule: (input) => write<Result<G.AlertRule, G.SaveAlertRuleFailure>, G.AlertRuleInput>("/alerts/rules", input),
  deleteAlertRule: (ruleId) => write<Result<null, G.DeleteAlertRuleFailure>>(`/alerts/rules/${seg(ruleId)}/delete`),
  saveDestination: (input) => write<Result<G.AlertDestination, G.SaveDestinationFailure>, G.DestinationInput>("/alerts/destinations", input),
  testDestination: (destinationId) => write<Result<G.Delivered, G.TestDestinationFailure>>(`/alerts/destinations/${seg(destinationId)}/test`),
  deleteDestination: (destinationId) => write<Result<G.DestinationDeleted, G.DeleteDestinationFailure>>(`/alerts/destinations/${seg(destinationId)}/delete`),

  // ── Team ──
  inviteMember: (input) => write<Result<G.Member, G.InviteMemberFailure>, G.InviteInput>("/team/invites", input),
  updateMemberAccess: (memberId, projectIds) => write<Result<G.Member, G.UpdateMemberAccessFailure>, G.MemberAccessInput>(`/team/members/${seg(memberId)}/access`, { projectIds }),
  removeMember: (memberId) => write<Result<null, G.RemoveMemberFailure>>(`/team/members/${seg(memberId)}/remove`),
  resendInvite: (memberId) => write<Result<G.Member, G.ResendInviteFailure>>(`/team/members/${seg(memberId)}/resend`),
  acceptInvite: (token) => write<Result<G.Member, G.AcceptInviteFailure>>(`/invites/${seg(token)}/accept`),

  // ── Agents ──
  createAccessToken: (name) => write<Result<G.CreatedToken, G.CreateAccessTokenFailure>, G.CreateAccessTokenInput>("/agents/tokens", { name }),
  revokeAccessToken: (tokenId) => write<Result<null, G.RevokeAccessTokenFailure>>(`/agents/tokens/${seg(tokenId)}/revoke`),
  setAgentReportDone: (reportId, done) => write<Result<null, G.SetAgentReportDoneFailure>, G.AgentReportDoneInput>(`/agents/reports/${seg(reportId)}/done`, { done }),

  // ── Session ──
  signIn: (email, next?: string) => write<Result<G.EmailLinkHandoff, G.SignInFailure>, G.SignInInput>("/sign-in", { email, next }),
} satisfies { [M in Wired]: (...args: Parameters<Backend[M]>) => Route<unknown> }
