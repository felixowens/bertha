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

## 15. Agent access

- **What:** `domain.ts` gains `AccessToken { id, name, createdAt, lastUsedAt }`. The
  `Activity` kinds a person causes (`resolved`, `ignored`, `reopened`, `snoozed`,
  `assigned`, `note`) gain `via?: string`, the name of the access token an agent used.
  `pages.ts` gains `"/settings/agents": AgentsPage = Loadable<{ tokens: AccessToken[];
  mcpUrl: string }>`. `actions.ts` gains `getAgents()`, `createAccessToken(name)` →
  `Result<{ token: AccessToken; secret: string }, "invalid_name">` and
  `revokeAccessToken(tokenId)` → `Result<null, "not_found">`.
- **Why:** most triage is done by a coding agent given an issue URL. It can't follow an
  emailed sign-in link, and the issue URL serves the app shell. Personal access tokens let
  an agent reach bertha's MCP endpoint (`/mcp`) as the member who made the token, seeing
  only their projects. `via` keeps an agent's note or resolve from reading as the
  person's own.
- **Screen:** `/settings/agents`; `via` shows in the issue activity.
- **Importance:** high.
- **Status:** applied (approved with the agent access plan, 2026-10-18).

## 16. Where and how an error surfaced

- **What:** `Event` gains `mechanism: { handler, handled } | null` (the hook that caught
  it: `onerror`, `onunhandledrejection`, `uncaughtException`, `ErrorBoundary`…) and
  `trace: { traceId, spanId } | null`. `Event.context` gains `viewport`, `online`,
  `visible`, `navigation`, `automated`, `pageAgeMs`, `referrer`, `language`, `timezone`,
  `connection`, `host` and `versions`. `Event.exception` gains `data` (the error's own
  fields) and `componentStack`. `Event.request` gains `headers`. `Release` gains
  `source: "deploy" | "heartbeat" | "event"`. `domain.ts` gains `RelatedEvent { issue,
  eventId, receivedAt }`: events of other issues sharing the trace, in projects the viewer
  can see. `IssueDetailPage` and `getEvent` gain `related: RelatedEvent[]`.
- **Why:** an agent triaging a Safari error (BEAU-3) had less to go on than GlitchTip
  gave for the same occurrence: no page, no "unhandled rejection", no page state, no
  React version, no trace. A release only seen in an event read as a deploy at the
  event's own time, and pointed the agent back at itself.
- **Screen:** `/issues/:id` (event pane), `/releases`, `/releases/:id`; the MCP.
- **Importance:** high.
- **Status:** applied (approved with the BEAU-3 gaps plan, 2026-10-19).

## 17. Merge history

- **What:** `Activity` gains `{ kind: "merged"; at: IsoDate; by: Person; via?: string;
  from: string[] }` on the issue that was kept, where `from` holds the short ids folded
  into it.
- **Why:** a merge leaves no trace. The sources are deleted, so a later reader (or agent)
  can't tell the issue absorbed others, which ones, or who did it. That matters more now
  that an agent can merge over the MCP.
- **Screen:** `/issues/:id` activity; the MCP's `get_issue` activity.
- **Importance:** medium.
- **Status:** applied (approved 2026-10-19). `domain.ts` `Activity` `merged`; fixture on
  `i-cart-map` (KILN-R, from KILN-1T); the fixture adapter's `mergeIssues` records it too.

## 18. Agent feedback on bertha

- **What:** `domain.ts` gains `AgentReport { id, kind: "problem" | "request", summary,
  details, tool: string | null, issue: { id, shortId } | null, version, by: Person, via: string,
  at: IsoDate, done: boolean }`, where `issue` is the issue the agent was working on (when
  it can see it), `tool` the MCP tool it was using and `version` the bertha version that
  served it. `AgentsPage` gains `reports: AgentReport[]`, newest first: every report for
  the owner, a member's own otherwise. `actions.ts` gains `setAgentReportDone(reportId,
  done)` → `Result<null, "not_found" | "permission_denied">`. The MCP gains `report_problem` and
  `request_feature` (summary, details, optional tool and issue), and its instructions tell
  the agent to use them when bertha gets in the way.
- **Why:** agents are bertha's heaviest users. When a tool returns too little or the wrong
  thing (BEAU-3's frames, the deploy that pointed back at itself), the agent works round
  it and the gap is only found by reading its transcript. A report puts it in front of the
  owner with the issue it happened on.
- **Screen:** `/settings/agents` gains a "Reports from agents" list with kind, summary,
  details, the issue link, who and which token, and a done toggle for the owner.
- **Importance:** medium.
- **Status:** applied (approved 2026-10-19). Fixture `agentReports` in `fixtures/people.ts`,
  not seeded; scenarios `agents-no-reports`, `agents-reports-all-done`,
  `agents-report-not-found` and `agents-report-denied`.

## 19. Triages

- **What:** `domain.ts` gains `Triage { id, by: Person, via: string | null, startedAt,
  updatedAt, state: "active" | "stale" | "done", outcome: "fixed" | "not_a_bug" |
  "cant_fix" | "needs_data" | "abandoned" | null, found: Prose | null, tried: Prose | null,
  fix: Prose | null, release: string | null }`. `found` is the cause and what was learned,
  including data bertha didn't have. `tried` is what didn't work. `fix` is the change,
  with its PR or commit. `release` is the release the issue was on when the triage
  started, so a later reader can tell which occurrence it was about. A triage is `stale`
  when it's active with no update for 2 hours. `Issue` gains `triages: Triage[]`, newest
  first. `IssueSummary` gains `triage: { by: Person; via: string | null; since: IsoDate } |
  null`, which is set only while one is active. `IssueFilter` gains `triage?: "active" |
  "never"`. `actions.ts` gains:
  - `startTriage(issueId, takeOver?)` → `Result<Triage, "not_found" | "in_progress">`.
    `in_progress` names who is triaging and since when. Starting again as the same person
    and token resumes their triage. A stale triage, or `takeOver`, closes the old one as
    `abandoned`.
  - `updateTriage(triageId, { found?, tried?, fix?, outcome? })` →
    `Result<Triage, "not_found" | "permission_denied" | "concluded">`. Setting an outcome
    ends the triage. Only its author edits it; the owner can also end anyone's as
    `abandoned`.

  The MCP gains `start_triage` and `update_triage`. `get_issue` opens with the active
  triage, if there is one, and the earlier triages' outcomes, causes and fixes, before the
  stack. The instructions change: start a triage after reading the issue, and end it
  with an outcome and whatever is worth keeping in `found`, `tried` and `fix`. Agents
  update a triage when they have something worth recording, not as a running log.
  `add_note` stays for remarks that aren't a triage.
- **Why:** each triage today starts from nothing. When an issue regresses, the previous
  cause and fix sit in a free-text note, if anyone wrote one. Two agents, or an agent and
  you, can work the same issue at once without knowing it. A triage record makes "last
  time, this was the cause, this was tried, this was the fix" the first thing anyone
  sees. The active state stops duplicate work. It's also the base that auto-triage would
  build on later.
- **Screen:** `/issues/:id` gets a "Triage" section above the activity. It shows the
  active triage (who, via which token, how long, the last update), a "Start triage"
  button, a form for found, tried, fix and outcome, and earlier triages folded by
  default. On `/issues`, a row being triaged shows who is on it. A "Being triaged" and a
  "Never triaged" filter. The MCP.
- **Importance:** high.
- **Status:** applied (approved 2026-10-20). `domain.ts` `Triage`, `IssueDetail.triages`
  and `IssueSummary.triage`; `actions.ts` `startTriage` and `updateTriage`. The section sits
  at the top of the issue's side column. Fixtures on KILN-R, the hydration issue (stale)
  and the regressed Mossgrove issue (fixed).

## 20. Project brief

- **What:** `ProjectSettingsPage` gains `brief: Prose | null`, and `ProjectInput` gains
  `brief`, up to 4,000 characters. The project home shows it. The MCP's `get_issue`
  includes the brief of the issue's project, and `list_projects` says which projects have
  one. Only the owner edits it, through `updateProject`, which is already owner-only.
- **Why:** an agent spends its first steps on every issue working out the stack, the
  hosting and the known noise (on BEAU-3: Next.js on Vercel, calling an API on Heroku). A
  few lines written once save that on every triage, for collaborators too.
- **Screen:** `/projects/:id/settings` gets a "Brief" field (markdown, with a preview).
  `/projects/:id` shows it under the header, folded past a few lines. The MCP.
- **Importance:** high.
- **Status:** applied (approved 2026-10-20). The brief is on `OverviewPage` (a project's
  overview) and `ProjectSettingsPage`; `createProject` leaves it out, so a new project
  starts without one. Fixtures for Kiln & Clay and Mossgrove.

## 21. Issue labels

- **What:** `IssueSummary` gains `labels: string[]`: lowercase letters, digits and `-`,
  up to 32 characters, up to 10 per issue, created on first use. `IssueChange` gains
  `{ kind: "label"; add: string[]; remove: string[] }`, so labelling works in bulk through
  `updateIssues`. `IssueFilter` gains `labels: string[]` (an issue must have all of
  them), and the free-text `query` accepts `label:checkout`. `IssuesPage.list` gains
  `labels: { name: string; count: number }[]`: the labels in use on issues the viewer can
  see, for the filter and for autocomplete. `Activity` gains `{ kind: "labelled"; at; by;
  via?; added: string[]; removed: string[] }`. Merging unions the labels. The MCP's
  `update_issue` gains `add_labels` and `remove_labels`, and `list_issues` takes `labels`.
- **Why:** project, level and status don't capture what the issues are about: `checkout`
  across a client's two apps, `client-reported`, `safari`, `flaky-ci`. Labels let you, a
  collaborator or an agent group them once and find them again.
- **Screen:** `/issues` gets a label filter in the filter bar, label chips on rows, and
  "Label…" in the bulk actions. On `/issues/:id`, labels show in the header with an add
  and remove control. Labels are grey, since colour is reserved for status.
- **Importance:** medium.
- **Status:** applied (approved 2026-10-20). Keyboard `l` opens the label menu on the list
  and the issue.

## 22. Search by tag

- **What:** `TagBreakdown.key` becomes `string`: a `TagKey`, or a tag the app sent with
  its events. Those tags are now rolled up per issue like the built-in ones; a key named
  like a built-in one is left to the built-in. The free-text `query` accepts `key:value`,
  which matches a tag value exactly in any case; every such token must match.
- **Why:** apps tag events (`area`, `tenant`) to say where they happened, but the tags
  only lived in the event payload, so you couldn't find or break down issues by them.
- **Screen:** `/issues/:id` lists the app's tags after the built-in ones, and each value
  links to `/issues?query=key:value`.
- **Importance:** medium.
- **Status:** applied (approved 2026-10-20). Only events from now on are counted; older
  events' tags aren't backfilled.

## 23. Fixes that ship

- **What:** `Triage.watch: FixWatch | null` follows a fixed triage's PR or commit:
  `waiting_merge`, `waiting_release`, `shipped` (with its `release`), `closed` or
  `unwatched` (with a `problem`). `TriageInput` gains `pr` and `commit`; without them
  they're read from `fix`. `IssueSummary.fix` carries the latest fixed triage's PR and
  state while the issue isn't resolved, and `IssueFilter.triage` gains `fix_waiting`.
  `Activity` gains `fix_shipped` (`by` null when bertha saw it ship). `IssueChange` gains
  `{ kind: "fix_shipped" }`, the manual path, with the failure `no_fix`.
  `ProjectInput.watchFixes` turns GitHub watching off per project, and
  `ProjectSettingsPage` gains `watchFixes` and `fixWatching`.
- **Why:** dogfooding BEAU2-5, an agent ended its triage fixed with a draft PR and the
  issue stayed unresolved, since nothing linked the two. With a GitHub token bertha now
  resolves the issue when a production release contains the fix; without one, the fix
  shows as waiting and one click marks it shipped.
- **Screen:** `/issues/:id`'s triage card shows the watch and "Mark shipped"; the header
  and the list's bulk actions offer "Fix shipped"; list rows get a fix chip and the filter
  "Fix waiting to ship". Project settings get a "Watch fixes on GitHub" switch.
- **Importance:** high.
- **Status:** applied (approved 2026-10-20). Events from releases first seen before the
  fix shipped no longer reopen the issue; the same goes for "resolve in next release".

## 24. Traces on events

- **What:** an event whose trace bertha kept carries its spans: `EventTrace` with the
  trace's start, duration and `TraceSpan`s. Each span has its service, runtime, name,
  kind, start offset and duration, status, attributes, and the issue event recorded on it,
  if any. Spans from a project the viewer can't see arrive without a name or attributes.
  Apps send spans over OTLP/HTTP with the project's key. bertha keeps every span for an
  hour and pins a trace for good once an error event names its trace id.
- **Why:** an event's page already links other issues' errors on the same trace, but it
  can't show what happened in the request that didn't throw. That's a slow query, an
  upstream call that timed out, or a service that answered 200 with bad data, and for
  triage that's often where the cause is.
- **Screen:** `/issues/:id` gets a "Trace" waterfall under the breadcrumbs. It's drawn as
  continuous bars on round time marks (the one chart that isn't square cells, since spans
  need millisecond precision) and scoped to this request, with a switch to the whole trace. This error's
  span is red, other issues' spans link to them, and a call into a service that sent
  nothing is hatched. A span opens into its attributes. Without spans, "Same trace" stays
  as it is.
- **Importance:** medium.
- **Status:** applied (approved 2026-10-20). Spans arrive at `/ingest/v1/traces`; the
  browser SDK sends the page's requests as spans after an error, and the MCP reads a
  trace with `get_trace`.

## 25. Rust setup

- **What:** `ProjectSetup.snippet: string` becomes `snippets: { label: string; code: string }[]`.
  The first is the JavaScript setup chosen by runtimes as before, labelled by what it sets
  up ("Next.js", "Vite" or "Node"). Projects with the `server` runtime also get "Rust":
  `bigbertha` from crates.io with its tracing and tower layers.
- **Why:** bbta's backend is moving to Rust, and bertha now has a Rust SDK. Its setup
  shouldn't live only in a README.
- **Screen:** the snippet on `/projects/:id/connect` and in project settings gets a
  segmented choice in its header when there's more than one. The choice is remembered per
  browser.
- **Importance:** medium.
- **Status:** applied (approved 2026-10-21 with the Rust SDK plan).
