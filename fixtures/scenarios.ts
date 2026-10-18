import type { Scenario } from "../src/contract/scenarios"

// One entry per awkward case and per named failure in actions.ts.
// `params.viewer` is "owner" (default) or "collaborator" (see fixtures/shell.ts).
export const scenarios: Scenario[] = [
  // ── Overview ──────────────────────────────────────────────────────────
  { id: "overview-default", route: "/", description: "Monday morning: one client site down, one regression, a fresh deploy with new issues, one noisy warning dwarfing everything." },
  { id: "overview-24h", route: "/", description: "Range set to 24h: KPIs swing hard against a quiet previous day.", params: { range: "24h" } },
  { id: "overview-ingest-gap", route: "/", description: "30d range: two days with no data at all (nothing received), which must read differently from zero errors.", params: { range: "30d" } },
  { id: "overview-loading", route: "/", description: "First load.", state: { status: "loading" } },
  { id: "overview-error", route: "/", description: "Couldn't load the overview; retry is possible.", state: { status: "error", message: "bertha couldn't load your overview. Check your connection and try again.", retryable: true } },
  { id: "overview-collaborator", route: "/", description: "Signed in as a collaborator with access to two projects only: no team or alert settings.", params: { viewer: "collaborator" } },
  { id: "overview-all-healthy", route: "/", description: "Every project healthy, no new issues: the calm state should feel rewarding, not empty.", params: { allHealthy: "true" } },
  { id: "overview-empty", route: "/", description: "No projects at all: the first run.", state: { status: "empty" } },

  // ── Issues ────────────────────────────────────────────────────────────
  { id: "issues-default", route: "/issues", description: "Unresolved issues across all projects, sorted by last seen; ~80 rows with mixed levels, assignees and snoozes." },
  { id: "issues-outlier", route: "/issues", description: "Sort by events: a 48,312-event warning sits above issues with single-digit counts.", params: { sort: "events" } },
  { id: "issues-inbox-zero", route: "/issues", description: "Nothing unresolved matches.", state: { list: { status: "empty" } } },
  { id: "issues-no-match", route: "/issues", description: "A search that matches nothing.", params: { query: "webhook signature" }, state: { list: { status: "empty" } } },
  { id: "issues-loading", route: "/issues", description: "Filter changed; list reloading.", state: { list: { status: "loading" } } },
  { id: "issues-bulk-conflict", route: "/issues", description: "Bulk-resolving 6 issues while a collaborator just reopened one of them.", failure: { op: "updateIssues", kind: "conflict" } },
  { id: "issues-bulk-not-found", route: "/issues", description: "One selected issue was deleted with its project in the meantime.", failure: { op: "updateIssues", kind: "not_found" } },
  { id: "issues-collaborator-denied", route: "/issues", description: "A collaborator tries to act on an issue in a project they just lost access to.", params: { viewer: "collaborator" }, failure: { op: "updateIssues", kind: "permission_denied" } },
  { id: "issues-queue", route: "/issues", description: "Start triage from the overview: exactly the three flagged issues, with a banner back to the full list.", params: { ids: "i-cart-map,i-moss-regressed,i-harbour-fetch" } },
  { id: "issues-new-this-week", route: "/issues", description: "The \"New this week\" view: only issues first seen in the last 7 days, matching the New issues card.", params: { view: "v-new" } },
  { id: "issues-30d-by-events", route: "/issues", description: "30 days, sorted by events in the range; trend cells span the whole month.", params: { range: "30d", sort: "events" } },

  // ── Issue detail ──────────────────────────────────────────────────────
  { id: "issue-deploy-fallout", route: "/issues/:issueId", description: "New since yesterday's deploy, assigned, with a note in markdown; 43-frame stack mixing own code, mapped and minified vendor frames.", params: { issueId: "i-cart-map" } },
  { id: "issue-minified-stack", route: "/issues/:issueId", description: "Older event of the same issue: no source maps, every frame minified, in-app browser with a 300-char user agent, no breadcrumbs.", params: { issueId: "i-cart-map", eventId: "e-cart-2" } },
  { id: "issue-regressed", route: "/issues/:issueId", description: "Was resolved, came back in v3.8.1; the activity log tells the story.", params: { issueId: "i-moss-regressed" } },
  { id: "issue-longest-title", route: "/issues/:issueId", description: "Longest message (273 chars, a customer's free text inside a validation error) in a project with a 77-char name.", params: { issueId: "i-longest" } },
  { id: "issue-no-stack", route: "/issues/:issueId", description: "A logged message with no stack, no request and almost no context.", params: { issueId: "i-no-stack" } },
  { id: "issue-noisy", route: "/issues/:issueId", description: "48k events, 3.9k users, empty stack: the obvious candidate to ignore.", params: { issueId: "i-noisy" } },
  { id: "issue-server-fatal", route: "/issues/:issueId", description: "Fatal server-side error behind the downtime: no browser or user, request returned 502.", params: { issueId: "i-harbour-fetch" } },
  { id: "issue-not-found", route: "/issues/:issueId", description: "Link to an issue that no longer exists.", params: { issueId: "i-deleted" }, state: { status: "empty" } },
  { id: "issue-note-not-found", route: "/issues/:issueId", description: "Adding a note to an issue removed seconds ago.", params: { issueId: "i-hydration" }, failure: { op: "addIssueNote", kind: "not_found" } },
  { id: "issue-resolved", route: "/issues/:issueId", description: "Resolved by a person: the header says who and when, and Reopen replaces Resolve.", params: { issueId: "i-16" } },
  { id: "issue-ignored", route: "/issues/:issueId", description: "Ignored issue: the header says who ignored it.", params: { issueId: "i-11" } },
  { id: "issue-merge-different-projects", route: "/issues/:issueId", description: "Merging into an issue that moved to another project meanwhile.", params: { issueId: "i-cart-map" }, failure: { op: "mergeIssues", kind: "different_projects" } },
  { id: "issue-merge-not-found", route: "/issues/:issueId", description: "Merging into an issue deleted seconds ago.", params: { issueId: "i-cart-map" }, failure: { op: "mergeIssues", kind: "not_found" } },

  // ── Releases ──────────────────────────────────────────────────────────
  { id: "releases-all", route: "/releases", description: "All projects' deploys, including a staging release candidate and releases with no commit info." },
  { id: "release-fallout", route: "/releases/:releaseId", description: "Yesterday's shop deploy: two new issues, events jump after the deploy line.", params: { releaseId: "r-kiln-0" } },
  { id: "release-regression", route: "/releases/:releaseId", description: "Deploy that brought back a resolved issue.", params: { releaseId: "r-moss-0" } },
  { id: "release-quiet", route: "/releases/:releaseId", description: "A deploy where nothing happened: no new or regressed issues.", params: { releaseId: "r-portfolio-0" } },
  { id: "release-young-deploy", route: "/releases/:releaseId", description: "Deployed 16h ago: before and after compare 16h each, and the hours still to come are empty.", params: { releaseId: "r-kiln-0" } },
  { id: "release-just-deployed", route: "/releases/:releaseId", description: "Staging deploy 40 minutes old: no full hour after it yet.", params: { releaseId: "r-kiln-staging" } },
  { id: "releases-one-project", route: "/releases", description: "Releases for one project, with its crumb.", params: { projectId: "p-moss" } },

  // ── Uptime ────────────────────────────────────────────────────────────
  { id: "uptime-default", route: "/uptime", description: "One down (25 min), one degraded, one paused, the rest up." },
  { id: "monitor-down", route: "/uptime/:monitorId", description: "Down right now with an open incident and a long error body.", params: { monitorId: "mon-harbour" } },
  { id: "monitor-degraded", route: "/uptime/:monitorId", description: "Degraded: seven short incidents today; the slow/timeout pattern should be legible.", params: { monitorId: "mon-moss" } },
  { id: "monitor-paused", route: "/uptime/:monitorId", description: "Paused monitor: gaps in the check history.", params: { monitorId: "mon-parish" } },
  { id: "monitor-invalid-url", route: "/uptime", description: "Adding a monitor with \"staidans-whitby\" (no scheme or domain).", failure: { op: "saveMonitor", kind: "invalid_url" } },
  { id: "monitor-unreachable", route: "/uptime", description: "First check against the new URL fails (DNS not resolving), so it's not saved.", failure: { op: "saveMonitor", kind: "unreachable" } },
  { id: "monitor-report", route: "/uptime/:monitorId/report", description: "Printable client report: 90 days of uptime by day and the incidents in it.", params: { monitorId: "mon-moss" } },
  { id: "monitor-report-down", route: "/uptime/:monitorId/report", description: "Report for a monitor that is down right now.", params: { monitorId: "mon-harbour" } },
  { id: "monitor-delete-not-found", route: "/uptime/:monitorId", description: "Deleting a monitor already deleted in another tab.", params: { monitorId: "mon-moss" }, failure: { op: "deleteMonitor", kind: "not_found" } },
  { id: "monitor-check-not-found", route: "/uptime/:monitorId", description: "Check now on a monitor deleted in another tab.", params: { monitorId: "mon-moss" }, failure: { op: "checkMonitorNow", kind: "not_found" } },

  // ── Live ──────────────────────────────────────────────────────────────
  { id: "live-new-issues", route: "/issues", description: "Two new issues and a regression arrive while the list is open: they wait behind a banner so rows don't move under the cursor.", params: { live: "replay" } },
  { id: "live-monitor-recovers", route: "/uptime/:monitorId", description: "Watching a down monitor when it comes back up.", params: { monitorId: "mon-harbour", live: "replay" } },
  { id: "live-offline", route: "/", description: "The change stream dropped and is retrying: the live dot reads offline and nothing updates until it's back.", params: { live: "down" } },

  // ── Projects ──────────────────────────────────────────────────────────
  { id: "new-project", route: "/projects/new", description: "Name the project, then the connect step." },
  { id: "new-project-waiting", route: "/projects/new", description: "Created; snippet shown; waiting for the first event (polling).", params: { projectId: "p-recipes" } },
  { id: "new-project-name-taken", route: "/projects/new", description: "\"Kiln & Clay\" already exists.", failure: { op: "createProject", kind: "name_taken" } },
  { id: "new-project-invalid-name", route: "/projects/new", description: "Name that is only spaces and emoji.", failure: { op: "createProject", kind: "invalid_name" } },
  { id: "new-project-key-taken", route: "/projects/new", description: "The suggested key is already used by another project.", failure: { op: "createProject", kind: "key_taken" } },
  { id: "new-project-invalid-key", route: "/projects/new", description: "A key with spaces and punctuation.", failure: { op: "createProject", kind: "invalid_key" } },
  { id: "new-project-connect", route: "/projects/:projectId/connect", description: "Reloaded on the connect step: it picks up where it left off.", params: { projectId: "p-recipes" } },
  { id: "projects-index", route: "/projects", description: "Every project with its state, unresolved count, events in range, monitors and last event." },
  { id: "projects-index-collaborator", route: "/projects", description: "A collaborator sees only their two projects and no New project button.", params: { viewer: "collaborator" } },
  { id: "projects-empty", route: "/projects", description: "No projects yet.", state: { status: "empty" } },
  { id: "projects-loading", route: "/projects", description: "First load.", state: { status: "loading" } },
  { id: "project-home", route: "/projects/:projectId", description: "A client project's home: header, tabs, and the overview limited to it.", params: { projectId: "p-moss" } },
  { id: "project-home-down", route: "/projects/:projectId", description: "Home of the project whose site is down.", params: { projectId: "p-harbour" } },
  { id: "project-home-awaiting", route: "/projects/:projectId", description: "Home of a project with no events yet.", params: { projectId: "p-recipes" } },
  { id: "project-home-not-found", route: "/projects/:projectId", description: "A project that was deleted, or one a collaborator can't see.", params: { projectId: "p-moss", viewer: "collaborator" } },
  { id: "project-edit-name-taken", route: "/projects/:projectId/settings", description: "Renaming a project to a name another one has.", params: { projectId: "p-moss" }, failure: { op: "updateProject", kind: "name_taken" } },
  { id: "project-edit-denied", route: "/projects/:projectId/settings", description: "A collaborator sees the details read-only; a save from a stale tab is refused.", params: { projectId: "p-kiln", viewer: "collaborator" }, failure: { op: "updateProject", kind: "permission_denied" } },
  { id: "project-settings", route: "/projects/:projectId/settings", description: "Client project with monitor, two members and source maps missing for the latest release.", params: { projectId: "p-moss" } },
  { id: "project-settings-awaiting", route: "/projects/:projectId/settings", description: "Project that never received an event.", params: { projectId: "p-recipes" } },
  { id: "project-rotate-denied", route: "/projects/:projectId/settings", description: "Collaborator tries to rotate the connection key.", params: { projectId: "p-kiln", viewer: "collaborator" }, failure: { op: "rotateIngestKey", kind: "permission_denied" } },
  { id: "project-delete-mismatch", route: "/projects/:projectId/settings", description: "Delete confirmation typed with the wrong name.", params: { projectId: "p-field" }, failure: { op: "deleteProject", kind: "name_mismatch" } },
  { id: "project-delete-denied", route: "/projects/:projectId/settings", description: "Collaborator tries to delete a project.", params: { projectId: "p-harbour", viewer: "collaborator" }, failure: { op: "deleteProject", kind: "permission_denied" } },

  // ── Alerts ────────────────────────────────────────────────────────────
  { id: "alerts-default", route: "/settings/alerts", description: "Four rules (one disabled, one with a long name), an email and two webhooks." },
  { id: "alerts-empty", route: "/settings/alerts", description: "No rules or destinations yet.", state: { status: "empty" } },
  { id: "alert-no-destination", route: "/settings/alerts", description: "Saving a rule with no destination picked.", failure: { op: "saveAlertRule", kind: "no_destination" } },
  { id: "alert-no-trigger", route: "/settings/alerts", description: "Saving a rule with every trigger unticked.", failure: { op: "saveAlertRule", kind: "no_trigger" } },
  { id: "alert-delete-not-found", route: "/settings/alerts", description: "Deleting a rule already deleted in another tab.", failure: { op: "deleteAlertRule", kind: "not_found" } },
  { id: "destination-invalid-email", route: "/settings/alerts", description: "Adding \"charles@sundial\" as an email destination.", failure: { op: "saveDestination", kind: "invalid_email" } },
  { id: "destination-invalid-webhook", route: "/settings/alerts", description: "Webhook URL that isn't https.", failure: { op: "saveDestination", kind: "invalid_webhook" } },
  { id: "destination-test-failed", route: "/settings/alerts", description: "Test alert to the chat webhook returns 410 Gone.", failure: { op: "testDestination", kind: "delivery_failed" } },
  { id: "destination-delete-not-found", route: "/settings/alerts", description: "Deleting a destination already deleted in another tab.", failure: { op: "deleteDestination", kind: "not_found" } },
  { id: "alerts-deliveries-failing", route: "/settings/alerts", description: "Recent deliveries include failures with the error each one returned." },

  // ── Team ──────────────────────────────────────────────────────────────
  { id: "team-default", route: "/settings/team", description: "Owner, two collaborators (one with a very long name), one pending invite." },
  { id: "team-already-member", route: "/settings/team", description: "Inviting Priya again.", failure: { op: "inviteMember", kind: "already_member" } },
  { id: "team-invalid-email", route: "/settings/team", description: "Inviting \"tomasz@\".", failure: { op: "inviteMember", kind: "invalid_email" } },
  { id: "team-access-denied", route: "/settings/team", description: "Changing access after the owner role was transferred elsewhere.", failure: { op: "updateMemberAccess", kind: "permission_denied" } },
  { id: "team-remove-owner", route: "/settings/team", description: "Trying to remove the owner.", failure: { op: "removeMember", kind: "cannot_remove_owner" } },
  { id: "team-resend-already-member", route: "/settings/team", description: "Resending an invite that was accepted in the meantime.", failure: { op: "resendInvite", kind: "already_member" } },
  { id: "team-resend-not-found", route: "/settings/team", description: "Resending an invite that was revoked in another tab.", failure: { op: "resendInvite", kind: "not_found" } },

  // ── Invite and sign-in ────────────────────────────────────────────────
  { id: "invite-valid", route: "/invite/:token", description: "Invitation to one client project with a long name.", params: { token: "valid" } },
  { id: "invite-expired", route: "/invite/:token", description: "Link older than 7 days.", params: { token: "expired" }, failure: { op: "acceptInvite", kind: "invite_expired" } },
  { id: "invite-used", route: "/invite/:token", description: "Link already accepted on another device.", params: { token: "used" }, failure: { op: "acceptInvite", kind: "invite_used" } },
  { id: "sign-in", route: "/sign-in", description: "Enter email." },
  { id: "sign-in-sent", route: "/sign-in", description: "Link sent; check your inbox.", state: { sentTo: "hello@sundial.dev" } },
  { id: "sign-in-unknown", route: "/sign-in", description: "Email with no account.", failure: { op: "signIn", kind: "unknown_email" } },
]
