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
