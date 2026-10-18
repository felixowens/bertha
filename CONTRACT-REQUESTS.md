# Contract requests

Changes to `src/contract`. Approved requests are applied to `src/contract` and
`fixtures/` and marked `applied`. Rejected ones stay here with the reason. (Requests 1–4
were made when the contract lived in `packet/`, a copy of the design packet.)

## 1. Issues behind a downtime on the monitor page

- **What:** `MonitorDetailPage` gains `relatedIssues: IssueSummary[]`: server-side issues
  from the same project first seen or spiking while the open (or latest) incident ran.
- **Why:** job 4 (site down) asks "why is it down?" right after "since when?". Today the
  page can only link to the project's whole issue list, so the owner has to work out the
  overlap themselves.
- **Screen:** `/uptime/:monitorId`, in the open-incident box.
- **Importance:** medium.
- **Status:** applied. `pages.ts` `MonitorDetailPage.relatedIssues`; fixture `monitorRelatedIssues` in `fixtures/monitors.ts` (`mon-harbour` → `i-harbour-fetch`, `i-68`). Shown in the open-incident box.

## 2. Know an invitation is expired or used when the link opens

- **What:** `AcceptInvitePage` data gains `status: "pending" | "expired" | "used"`.
- **Why:** today `invite_expired` and `invite_used` only show up after "Accept invitation"
  is pressed. The person reads the invitation, presses the button and only then learns it
  is dead. With the status known at load, the page can open on the right message.
- **Screen:** `/invite/:token`.
- **Importance:** medium.
- **Status:** applied. `pages.ts` `AcceptInvitePage.status`; fixture `invite` replaced by `invites` keyed by token in `fixtures/shell.ts`. The page opens on the expired or used message. `acceptInvite` keeps its failures for links that die while the page is open.

## 3. Assignable people on the issue list

- **What:** `IssuesPage` gains `assignable: Person[]` (members who can see the filtered
  projects).
- **Why:** bulk "Assign to…" in the triage bar needs a list of people. The issue detail page
  already has `assignable`; the list page does not, so the prototype builds the list from
  fixtures.
- **Screen:** `/issues`, bulk action bar.
- **Importance:** low.
- **Status:** applied. `pages.ts` `IssuesPage.list` gains `assignable`; `actions.ts` `listIssues` returns it. Derived from `members` in the adapter, so no new fixture.

## 4. Live updates

- **What:** a stream of small change notices next to `Backend` (not a `Backend`
  method, since the contract is request/response only):
  `LiveEvent = ingested { projectId, events, newIssues, regressed, touched }
  | issuesChanged { projectId, issueIds } | monitor { projectId, monitorId, state }
  | resync`. The server sends it over SSE at `GET /api/v1/live`, filtered to the
  viewer's projects.
- **Why:** the live dot, the sidebar counts and the issue list's "N new" banner need to
  know when something happened without polling. Job 1 ("a deploy goes out → a new error
  appears") is about noticing quickly.
- **Screen:** the shell (live dot, sidebar counts), `/issues` (new-issues banner), and
  issue and monitor detail (refetch when theirs changes).
- **Importance:** medium. Every page works without it; it only saves a reload.
- **Status:** applied. `domain.ts` gains `LiveEvent` and `LiveStatus`; `actions.ts`
  `Backend.subscribe(listener): () => void` with `LiveListener { event, status }`. Fixture
  `liveReplay` in `fixtures/live.ts`, played by the scenarios `live-new-issues` and
  `live-monitor-recovers` (`params.live = "replay"`); `live-offline` (`params.live =
  "down"`) shows the stream dropping. The server's type is checked against it in
  `src/api/contract-check.ts`.

## 5. Edit a project, choose its key, link its repo

- **What:** `Backend.updateProject(projectId, { name, client, url, repoUrl, runtimes,
  environments })` → `Result<Project, "name_taken" | "invalid_name" | "permission_denied">`.
  `Project` gains `repoUrl: string | null`. `createProject` takes an optional `key` and gains
  the failures `key_taken` and `invalid_key`.
- **Why:** a project's name, client, URL, runtimes and environments can't be changed after
  it's created, and its key (the prefix of every issue id) is picked for you. `repoUrl` lets
  commits link to the code.
- **Screen:** `/projects/:id/settings` (Details), `/projects/new`, `/releases/:id`.
- **Importance:** high.
- **Status:** applied (UX review, 2026-10-18).

## 6. A home for each project, and one time window on the overview

- **What:** `getOverview(range, projectId: string | null)`. `OverviewPage` gains
  `project: Project | null` and `projectEvents: Record<string, number>` (events in the range),
  and `monitorsDown` becomes `monitorsAttention` (down and degraded). `LevelSeries.bucket` may
  be `"hour"`, and `events` covers the selected range (hourly for 24h).
- **Why:** there's no page for one project, so "how is Kiln & Clay doing?" has no answer. The
  overview mixed three windows: the range for KPIs, 14 days for the chart and 24h for project
  rows. Degraded monitors never reached "Needs attention".
- **Also:** `listProjects(range)` → `ProjectsPage` data `{ projects, projectEvents, monitors }`
  for a `/projects` index, since there was no list of projects anywhere.
- **Screen:** `/`, `/projects`, `/projects/:id`.
- **Importance:** high.
- **Status:** applied (UX review, 2026-10-18).

## 7. Several monitors per project; delete one; check now

- **What:** `Project.monitorId` → `monitorIds: string[]`. `ProjectSettingsPage.monitor` →
  `monitors: Monitor[]`. `deleteMonitor(monitorId)` → `Result<null, "not_found" |
  "permission_denied">`. `checkMonitorNow(monitorId)` → `Result<UptimeCheck, "not_found">`.
- **Why:** a site and its API health check are both worth watching. A monitor could only be
  paused, never removed. After a fix, waiting for the next interval to see "up" is slow.
- **Screen:** `/projects/:id/settings`, `/uptime/:id`.
- **Importance:** medium.
- **Status:** applied (UX review, 2026-10-18).

## 8. Edit and delete destinations; delivery history; a degraded trigger

- **What:** `DestinationInput` gains `id?` (edit). `deleteDestination(destinationId)` →
  `Result<{ rulesTurnedOff: string[] }, "not_found">`: the destination is removed from its
  rules, and rules left with none are turned off. `AlertTrigger` gains `monitor_degraded`.
  `AlertsPage` gains `deliveries: AlertDelivery[]` (last 50, newest first), with
  `AlertDelivery = { id, at, ruleId, destinationId, ok, error, summary }`.
- **Why:** a failed test says "Replace the URL with a fresh one", but there was no way to do
  it. Nothing showed whether alerts actually went out. A slow site or an expiring certificate
  couldn't alert.
- **Screen:** `/settings/alerts`.
- **Importance:** high.
- **Status:** applied (UX review, 2026-10-18).

## 9. The issue range filters

- **What:** `IssueFilter.range` keeps only issues seen in the range. `IssueSummary` gains
  `eventsInRange`. Sorting by `events` uses it, and `trend` spans exactly the range.
  `IssueFilter.newInRange?: true` keeps only issues first seen in the range, which is what
  the New issues card counts; the "New this week" view uses it.
- **Why:** "80 issues · Range 7 days · 48.3k events" read as 48.3k this week. The range only
  changed the sparkline. "New this week" listed every issue seen this week, so its count and
  the New issues card disagreed.
- **Screen:** `/issues`.
- **Importance:** high.
- **Status:** applied (UX review, 2026-10-18). `newInRange` was added while applying 9.

## 10. Search users, URLs and releases; a triage queue

- **What:** `IssueFilter.query` also matches `user`, `url` and `release` tag values.
  `IssueFilter.ids?: string[]` limits the list to those issues.
- **Why:** "a client says customer X hit an error" starts from an email or a URL. "Start
  triage" on the overview should open what "Needs attention" listed, not all 80 issues.
- **Screen:** `/issues`, `/`.
- **Importance:** medium.
- **Status:** applied (UX review, 2026-10-18).

## 11. Invitation dates and resend

- **What:** `Member` gains `invitedAt: IsoDate | null` and `inviteExpiresAt: IsoDate | null`
  (both null once joined; `inviteExpiresAt` stays set after it passes).
  `resendInvite(memberId)` → `Result<Member, "not_found" | "already_member">`.
- **Why:** an invitation silently stopped working after 7 days, and the person stayed under
  "Waiting to accept" with no way to send it again.
- **Screen:** `/settings/team`.
- **Importance:** medium.
- **Status:** applied (UX review, 2026-10-18).

## 12. Resolve in the next release

- **What:** `IssueChange` `{ kind: "resolve"; inNextRelease?: true }`. Events from the
  release that was current when it was resolved don't count as a regression.
- **Why:** a fix that's merged but not deployed comes straight back as a "regression" from
  the old code still running.
- **Screen:** `/issues/:id`, `/issues`.
- **Importance:** medium.
- **Status:** applied (UX review, 2026-10-18).

## 13. Merge issues

- **What:** `mergeIssues(targetId, sourceIds)` → `Result<Issue, "not_found" |
  "different_projects">`. The sources' events, notes and fingerprints move to the target;
  future events with those fingerprints land on it.
- **Why:** the same bug with two messages (say, a minified and an unminified one) shows as
  two issues, so it's triaged twice.
- **Screen:** `/issues/:id`.
- **Importance:** low.
- **Status:** applied (UX review, 2026-10-18).

## 14. Release navigation, fixes that held, and a client uptime report

- **What:** `ReleaseDetailPage` gains `next: Release | null`, `heldFixes: IssueSummary[]`
  (the issues behind `quietSinceDeploy`) and `afterHours: number` (complete hours after the
  deploy, 0–24). `MonitorDetailPage` gains `uptimeByDay: TimeSeries` (90 days of daily uptime
  percentages; null where it was paused or didn't exist yet).
- **Why:** a release only linked back, never forward. "Held 3 fixes" never said which. A
  young deploy compared a partial window to a full one. The brief asks for uptime history
  that can be shown to a client.
- **Screen:** `/releases/:id`, `/uptime/:id/report`.
- **Importance:** medium.
- **Status:** applied (UX review, 2026-10-18).
