# Changelog

What changed in each release of bertha and its SDKs, newest first. bertha, the JavaScript
SDK (`@bigbertha/sdk` on npm) and the Rust SDK (`bigbertha` on crates.io) share one
version number, so an SDK can move to a version that changed nothing in it.

Install or upgrade bertha with `deploy/install.sh`, or let `bertha-update` move to each
release by itself (see `deploy/README.md`).

## Unreleased

### bertha

- A tab left open across an update no longer goes blank when you open a page. The page's
  code from the old version is gone, so bertha reloads once into the new one. If a page
  still can't load, it says so inside the app with a Reload button.

## 0.12.4 · 2026-10-27

### bertha

- Issue alerts name the issue in the subject, with its message and short id, as in
  "New issue in Kiln: TypeError: x is undefined (KILN-4F)". Before, every TypeError in a
  project had the same subject, so mail clients threaded them all together. Webhooks get
  the same title; if one matches on `title`, check it still does.

## 0.12.3 · 2026-10-25

### bertha

- The logs page filters by environment, with an Env control beside Level like the issues
  page's. Clicking a line's environment sets it, and "Alert on this search" carries it
  into the new rule.

## 0.12.2 · 2026-10-25

### JavaScript SDK

- `log.*` takes the request as a third argument, `{ req }`, and a line lands on that
  request's trace, as an error does. Before, a line inside a request took Sentry's trace
  id when Sentry was running, and had no trace at all on Node without OpenTelemetry. Pass
  `{ req }` where the request is in reach; `{ trace }` sets one outright.

## 0.12.1 · 2026-10-23

### bertha

- Log lines are coloured by level, so a page of them scans at a glance: errors and
  crashes red, warnings amber, info and debug grey. The volume strip, the level filter
  and patterns use the same colours.

## 0.12.0 · 2026-10-23

### bertha

- A project is connected as soon as anything arrives with its key: a heartbeat, a log
  line, traces, source maps, a deploy or an error. Before, it stayed "awaiting first
  event" until the app threw, which a working app may never do. Its status now reads
  "Not connected" until then.
- Once connected, a new project's setup and its settings say which release is running in
  which environment and when it was last seen, then "No errors yet" until the first
  error. Projects that already sent anything show as connected after upgrading.
- Setup shows a command that sends a test event from your machine, to see an error
  arrive without breaking anything.

### JavaScript SDK

- `bertha test` sends one error marked as a test, with the message "bertha test event"
  and the tag `test: true`, using `BERTHA_URL` and `BERTHA_KEY` or `--url` and `--key`.
  It's sent in development unless `--env` says otherwise.

## 0.11.1 · 2026-10-23

### Rust SDK

- A heartbeat that doesn't arrive, because the app started before its network or bertha
  was up, is sent again a minute later instead of 20 minutes later. Until it arrives,
  bertha doesn't know the release is running.

## 0.11.0 · 2026-10-23

### Running bertha

- bertha can report its own errors to one of its projects. Set `BERTHA_REPORT_TO` to the
  project's key, id or name and restart. The server's errors, panics and log lines go
  there, and so do the app's uncaught errors in the browser, with stacks that read as
  `src/…`. A failure to take bertha's own reports stays in the log, so it can't loop.
  See "bertha's own errors" in `deploy/README.md`.

## 0.10.1 · 2026-10-23

### JavaScript SDK

- Uncaught errors from scripts with no URL, like the ones Chrome and Safari add to pages
  on iOS, now arrive with frames, marked as not the app's. Before, Safari's stack for
  them was dropped and the event came without frames. When an error's stack gives
  nothing, the event's file, line and column stand in.

## 0.10.0 · 2026-10-23

### bertha

- Logs. Apps send their log lines, `info` included, and bertha keeps them for 14 days by
  default (1 to 90, per project in its settings), in a file of their own beside the
  database. The Logs page searches them by words and `key:value` fields, follows new
  lines live, charts volume by level, and groups lines into patterns so you can see which
  messages are most common. Issues still only come from exceptions: a fallback that
  worked is a log line, not an issue.
- An issue's event shows the log lines on its trace, or else from just before it, with
  the line the error was logged as marked.
- A new alert trigger, "A log search matches enough lines", fires when a search matches a number of
  lines within a window.
- Logs arrive over OTLP/HTTP at `/ingest/v1/logs` with the project's key, so any
  OpenTelemetry logger can send them. Each project takes up to 2,000 lines a minute; past
  that they're dropped and counted.

### Agents

- `search_logs` and `log_patterns` read the logs. `get_issue` and `get_event` say how
  many lines sit around the event, and the triage steps now include reading them.

### JavaScript SDK

- `log.debug`, `log.info`, `log.warn` and `log.error(message, fields?)` send log lines,
  batched in the background. `logLevel` (default `"info"`, or `"off"`) sets what's sent,
  and `captureConsole: true` also sends `console.*`. An error line links to the issue
  event it was reported as.

### Rust SDK

- The `tracing` layer sends every event at or above `log_level` (default `info`, or
  `BERTHA_LOG_LEVEL`; `off` turns it off) as a log line, with its fields and trace.
  ERROR events are still reported as issues, and `WARN` and `INFO` still become
  breadcrumbs. `bigbertha::log::{debug, info, warn, error}` log without `tracing`.

### Running bertha

- Logs live in `<database>.logs.db` next to the database. `bertha backup` leaves it out;
  add it to Litestream if you want it replicated. `deploy/README.md` shows how to forward
  the stdout of apps without an SDK through the OpenTelemetry Collector or Vector.

## 0.9.2 · 2026-10-22

### bertha

- The version beside the wordmark links to its release notes.

### Running bertha

- Each release's notes on GitHub now come from this file.

## 0.9.1 · 2026-10-22

### JavaScript SDK

- Request headers whose names say they hold a secret (`x-auth-token`, `x-session-id`…) are
  no longer sent, and the rest are scrubbed like any text. A `referer` carrying `?token=`
  went out as it was before.

### Rust SDK

- The same header scrubbing as the JavaScript SDK.

## 0.9.0 · 2026-10-21

### bertha

- Rust frames group and read well: std, tokio and dependency frames aren't the app's
  code, and build hashes on function names no longer split an issue in two.
- A server project's setup page offers a Rust snippet beside the JavaScript one. The
  choice is remembered in the browser.

### Rust SDK

- First release of `bigbertha`. It reports panics, errors with their `source()` chain,
  anyhow errors with their backtrace, and `tracing` ERROR events. The tower layer puts the
  request on every report for axum or any tower service, and answers panics with a 500.
  See `server/crates/bigbertha/README.md`.

## 0.8.1 · 2026-10-21

### JavaScript SDK

- A server error stays on the request's trace when another tracer's span is active.
  Sentry runs OpenTelemetry on its own trace ids, so 0.8.0 cut such errors off from the
  page that sent the request.

## 0.8.0 · 2026-10-20

### bertha

- bertha takes OpenTelemetry traces over OTLP/HTTP with the project's key. An event's page
  draws its request as a waterfall across services. Spans are kept for an hour, and a
  trace for good once an error event names it.

### Agents

- `get_trace` reads an event's trace.

### JavaScript SDK

- After an error, the browser sends the page's requests as spans.
- Events land on the OpenTelemetry span that was active when they were captured.
- `otlp()` gives an OTel exporter bertha's endpoint and key.

### Running bertha

- The Docker docs say where `BERTHA_GITHUB_TOKEN` goes.

## 0.7.0 · 2026-10-20

### bertha

- A fixed triage records its PR or commit. With `BERTHA_GITHUB_TOKEN` set, bertha watches
  the PR merge and resolves the issue in the first production release that contains it,
  and events from older builds no longer reopen it.
- Without a token, or for a project that turns watching off, the fix shows as waiting to
  ship, and "Mark shipped" resolves it.

### Agents

- `update_issue` with `fix_shipped` marks a fix shipped.

## 0.6.1 · 2026-10-20

### bertha

- An issue's event tags show in its breakdown, and `key:value` in the search box finds
  issues by any tag.

## 0.6.0 · 2026-10-20

### bertha

- Triages: a person or agent claims an issue, records what they found, tried and fixed,
  and ends with an outcome.
- Each project has a brief, written by the owner, that agents read with every issue.
- Issues take labels, with a filter, bulk labelling and the `l` key.

### Agents

- `start_triage`, `update_triage` and labels through `update_issue`. `get_issue` includes
  the brief and earlier triages.

## 0.5.7 · 2026-10-19

### Agents

- `report_problem` and `request_feature` put a report in front of the owner, with the
  issue and tool the agent was on. Settings → Agents lists them, and the owner marks them
  done. Collaborators see only their own.

## 0.5.6 · 2026-10-19

### bertha

- Links to bertha's own issues show their short id.

## 0.5.5 · 2026-10-19

### bertha

- Notes and commit messages name links the way you'd say them (#212, a41c9e2,
  api/cart.ts:88, owner/repo#3) and link the shorthand too. Event data links its URLs and
  keeps every character.
- `/issues/KILN-4F` opens the issue.

## 0.5.4 · 2026-10-19

### bertha

- Errors whose frames have no function names, common in a browser's async stacks, group
  by their message too. Every plain `Error` thrown in one file fell into one issue before.

## 0.5.3 · 2026-10-19

### bertha

- A merge shows in the kept issue's activity.

## 0.5.2 · 2026-10-19

### Agents

- `merge_issues` folds an issue split by grouping into another, like the app's merge
  dialog. It can't be undone.

## 0.5.1 · 2026-10-19

### JavaScript SDK

- `captureException` takes the framework's request as `req` (Koa, Express, Strapi), so
  events from your own error middleware carry headers, the client's IP and the trace.
- `wrapHandler` says the error escaped the handler.

## 0.5.0 · 2026-10-19

### bertha

- Events say where, how and in what state an error surfaced, and a server error lists the
  page error whose request caused it, and the reverse.
- Frames in browser extensions and Safari's hidden scripts aren't the app's code, and an
  issue made only of them says so.
- Releases record whether they were deployed, first seen in an event or first reported by
  a running process. A full commit sha as the release is taken as its commit.

### JavaScript SDK

- Browser events carry the page, how the error surfaced (onerror, a rejection, a
  boundary), the page's state and the visitor's IP. Requests carry a W3C `traceparent`.
- Server events add request headers without credentials, the host, versions and the
  error's own fields.
- `@bigbertha/sdk/react` has an `ErrorBoundary` that reports React's component stack.
- `withBertha` records the deploy on Vercel.

## 0.4.1 · 2026-10-19

### bertha

- Breadcrumb times keep their milliseconds, so breadcrumbs show the order things happened
  in.

## 0.4.0 · 2026-10-19

### Agents

- `get_issue` shows every frame, the source of the throw and the app's frames, and where
  the app's code called into a dependency. It says plainly when an event came without a
  request, user or breadcrumbs.
- `list_events` shows an issue's newest events one per line.

### JavaScript SDK

- The Node SDK sends the running commit with its heartbeat, from `BERTHA_COMMIT` or the
  host (Heroku, Render, Railway, Vercel, GitHub Actions), so a release no deploy recorded
  still names its code. `bertha deploy` falls back to the same variables.
- Unnamed async frames (`at async /app/x.js:1:2`) read their source lines again.

## 0.3.0 · 2026-10-18

### Agents

- Agents triage through MCP. Any member makes a personal access token under Settings →
  Agents and connects Claude Code or Codex to `/mcp`. A token acts as its member, sees only
  their projects, and can't touch settings.
- An issue can be named by its link, id or short id, so "please triage <link>" is enough.
  What an agent writes shows with the token's name.

### Running bertha

- `bertha token create` makes a token from the command line.

## 0.2.1 · 2026-10-18

### bertha

- Motion that says where things went: pages and late blocks settle in, a highlight slides
  between nav items and tabs, and menus and dialogs animate out as well as in. Reduced
  motion turns it all off.
- The sidebar scrolls only its middle, so a long project list never scrolls the page.
- An owner's live updates include projects made after the page opened.

### JavaScript SDK

- Node frames without a source map send their source lines, read from disk.
- V8's stack limit goes from 10 frames to 50, unless the app set its own.

## 0.2.0 · 2026-10-18

### bertha

- Projects in the sidebar, a projects index and a home for each project. Project settings
  edit its details, and a project can have several monitors.
- Colour is a traffic light: red is act now, amber look soon, green fine, and an ordinary
  error is grey. A fatal error reads "Crash", and levels differ by shape too.
- Resolve in the next release, merge issues, and email on assignment.
- Destinations can be edited and deleted, with a delivery log and a degraded trigger.
- Invites show when they expire and can be resent.
- Releases show the next deploy and fixes holding. A printable uptime report per client.

## 0.1.10 · 2026-10-18

### bertha

- The running version shows beside the wordmark.

## 0.1.9 · 2026-10-18

### bertha

- Only bundled code counts as minified, so a devtools eval or a Node file run as it is no
  longer asks for source maps that can't exist.

### Running bertha

- Docker deploys move to the latest release by themselves. `bertha-update` builds the new
  image while the old one serves, takes a checked backup, switches over, and rolls back if
  `/healthz` doesn't answer within 60s.

## 0.1.8 · 2026-10-18

### bertha

- A release named by a commit sha shows its first 7 characters, with the full sha on
  hover.

## 0.1.7 · 2026-10-18

### JavaScript SDK

- With Sentry's SDK also installed, the process exits after an uncaught exception again.

## 0.1.6 · 2026-10-18

### JavaScript SDK

- Types resolve for projects on `moduleResolution: "node"`.
- CSS source maps are removed from the build like JS maps.

## 0.1.5 · 2026-10-18

### JavaScript SDK

- `withBertha` keeps Next's server source maps, which Vercel's build output needs.
  `keepMaps` also takes a function.

## 0.1.4 · 2026-10-18

### JavaScript SDK

- Works beside Sentry's bundler plugin: a bundle that already had a debug id gets
  bertha's runtime line, so its frames match their maps.
- A Vercel preview reports as staging, not production.

## 0.1.3 · 2026-10-18

### Running bertha

- bertha runs in Docker behind Traefik, with daily backups and a tested restore. See
  `deploy/docker`.
- `BERTHA_TRUSTED_PROXIES` lets bertha read the client's address from a proxy that isn't on
  localhost.

## 0.1.2 · 2026-10-18

### Running bertha

- No changes to bertha or the SDKs. The README gained screenshots.

## 0.1.1 · 2026-10-18

### Upgrading

- The SDK is now `@bigbertha/sdk` on npm, under the MIT license. Replace `@bertha/sdk` in
  your imports and `package.json`.

### Running bertha

- `install.sh` downloads with curl.

## 0.1.0 · 2026-10-18

### bertha

- First release: issues grouped from events, releases and deploys, uptime monitors with
  incidents, alert rules with email and webhook delivery, invites and per-project access,
  sign-in by emailed link, and live updates.

### JavaScript SDK

- Browser, Node, edge, Next.js and Vite, with source maps matched by debug id, and the
  `bertha deploy` and `bertha sourcemaps upload` commands.

### Running bertha

- One static binary with a hardened systemd unit, Caddy, `install.sh` (upgrades with a
  backup, a health check and rollback) and Litestream.
