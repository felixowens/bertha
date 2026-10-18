# bertha — design brief

Contract status: proposal

This is a new product. The contract in `contract/` is the smallest set of types and
operations that serves the jobs below. The design may change it, with the owner's approval.
This round the backend is mocked: the prototype implements `Backend` over `fixtures/`. Once
the design settles, the contract becomes the spec for the real backend.

## What this is

bertha is error tracking for one developer's handful of small web apps: about ten personal
projects and client sites, low traffic, a few hundred errors on a bad day. It collects
errors from the browser and the server, groups them into issues, ties them to deploys,
and watches whether each site is up. It is the opposite of tools built for large
engineering orgs, which the owner finds messy, ugly and bloated. Everything here should
earn its place on screen.

## Who visits

- **The owner.** A solo developer who built and runs every project. Fluent in stack
  traces, deploys and HTTP, so nothing needs explaining. Opens bertha once in the morning
  and whenever an alert fires. Wants to know in seconds whether anything needs them,
  and worries about a client finding a broken site before they do. Sees every project and
  manages alerts, projects and the team.
- **A collaborator.** An occasional freelancer helping on one or two client projects.
  Sees only the projects they were given and triages issues assigned to them. Can't
  manage alerts, the team, or project keys. Their main worry is losing track of what was
  handed to them.

## Jobs

1. **Morning check:** open bertha → scan the four headline numbers against the previous
   period → see which projects are down, regressed or have new issues → open the one that
   needs attention.
   Served by: `OverviewPage`, `AppShell`, `Backend.getOverview`, `Backend.getShell`
2. **Deploy fallout:** a deploy goes out → an alert says a new issue appeared → open it and
   read the stack trace, breadcrumbs and who it hits (users, browsers, URLs) → fix and
   mark it resolved → after the next deploy, confirm it stayed quiet.
   Served by: `IssueDetailPage`, `Backend.getIssue`, `Backend.getEvent`,
   `Backend.updateIssues` (resolve), `ReleaseDetailPage`, `Backend.getRelease`
3. **Triage the inbox:** open Issues → narrow by project, level, environment or assignee
   → for each issue, or a selection, assign, snooze, ignore or resolve → reach inbox zero.
   Served by: `IssuesPage`, `Backend.listIssues`, `Backend.updateIssues`,
   `Backend.addIssueNote`
4. **Site down:** an uptime alert fires → open the monitor and see since when, the failing
   checks and the error → find the server-side issue behind it → the site recovers and
   the incident closes in history.
   Served by: `UptimePage`, `MonitorDetailPage`, `Backend.getMonitor`, `IssueDetailPage`
5. **Add a project:** name it and say where it runs → copy the connection key and setup
   snippet → deploy → watch for the first event → the project shows as live (optionally
   add a monitor).
   Served by: `NewProjectPage`, `Backend.createProject`, `Backend.getProjectSetup`,
   `Backend.saveMonitor`
6. **Share with a collaborator:** invite by email → pick their projects → they follow the
   email link and accept → the owner adjusts or removes access later.
   Served by: `TeamPage`, `Backend.inviteMember`, `AcceptInvitePage`,
   `Backend.acceptInvite`, `Backend.updateMemberAccess`, `Backend.removeMember`
7. **Tune alerts:** add an email or webhook destination → send a test → create a rule:
   which projects and environments, which triggers (new, regression, spike, down,
   recovered) → turn a noisy rule off.
   Served by: `AlertsPage`, `Backend.saveDestination`, `Backend.testDestination`,
   `Backend.saveAlertRule`, `Backend.deleteAlertRule`

## What the owner needs from the product

1. Signal over noise: what is new, back or down should stand out instantly, and the
   long tail should stay quiet.
2. Fast triage: getting from an alert to a stack trace to "resolved" in as few steps as
   possible, with the keyboard.
3. Confidence about client sites: down or broken is never missed, and the history can
   be shown to a client.
4. Restraint: few pages and few settings. Nothing built for teams of fifty.

## Tone

Quiet, precise, dense, tidy, with a slight terminal edge: numbers and timestamps read like
instrument readouts. Copy is short, plain and a little dry ("Nothing new since
yesterday." rather than "Great job! 🎉"). Avoid: marketing gloss, cheerfulness, emoji,
illustrations of mascots, enterprise clutter, tooltips explaining what an error is.

## Hard constraints

- Dark-first. Light mode isn't required this round (see open questions).
- Triage must work fully from the keyboard: move through the list, open, resolve,
  ignore, snooze, assign.
- WCAG 2.2 AA contrast, including muted greys on near-black. Colour is never the only
  carrier of severity or state.
- Designed for laptop and desktop widths. On a phone, the overview, an issue and
  a monitor must be readable (see open questions).
- "No data" (nothing received) must look different from zero.
- Sign-in is by emailed link. The person leaves bertha to open their email; design the
  "check your inbox" moment and the return.
- Collaborators never see projects they weren't given, or team, alert or key settings.
- Non-UI: apps report errors with the standard open error-reporting client libraries,
  configured with a per-project connection key. That's why setup is a key plus a snippet
  rather than a bertha-specific install.

## Out of scope this round

Billing, plans and quotas; performance tracing; session replay; logs; an AI assistant or
chat box; user-defined dashboards; single sign-on; public status pages; mobile apps.

## Open questions

- Is a light mode needed, or is dark-only fine for a single-owner tool?
- How far does mobile go: read-only glance, or can you also resolve and snooze from a
  phone?
- Saved views: only the built-in presets (`SavedView`), or can the owner save their own
  filters? (`// OPEN` in `domain.ts`)
- Spike alerts: is one threshold per rule enough, or does each project need its own?
  (`// OPEN` in `domain.ts`)
- Sign-in: emailed link only, no passwords or third-party sign-in? (`// OPEN` in
  `actions.ts`)
- The setup snippet's exact wording depends on which client library each app uses. The
  fixture shows a generic two-step version.

## Packet contents

- `contract/`: types the design must compile against. Read `actions.ts` first.
- `fixtures/`: invented content with realistic texture. `fixtures/scenarios.ts` lists
  edge cases and failures to design for, and `fixtures/shell.ts` has owner and
  collaborator sessions.
- `brand/`: see `brand/README.md` for fixed, open and references.
- `assets/`: empty. There's no photography; this product is all type, data and charts.
