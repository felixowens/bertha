# bertha

Calm, dense error tracking for one developer's handful of small apps. One Rust binary
with the app embedded, one SQLite file, and its own small SDK. It collects errors,
groups them into issues, watches uptime and sends alerts by email or webhook.

```
src/        the app (Vite + React + Tailwind v4)
server/     the Rust server: axum, sqlx on SQLite, workers, the embedded app, a CLI
sdk/        @bertha/sdk: browser, Node, edge, Next.js, the Vite plugin and a CLI
packet/     the design packet: the contract (types) and fixtures the app was designed from
deploy/     systemd unit, Caddyfile, install script, Litestream
e2e/        Playwright journeys against the real binary
```

```bash
npm install
npm run dev -- --port 4321               # the app on fixtures: http://localhost:4321
open http://localhost:4321/__scenarios   # every route × every state
```

To run it for real, see [deploy/README.md](deploy/README.md). To send it errors, see
[sdk/README.md](sdk/README.md).


## Part 1 — The design language: "Instrument"

### Mood

bertha should read like a bench instrument: dark, quiet and precise. It stays grey until
something is wrong. The owner should be able to take in all ten projects at once and only
notice the ones that need them. There is no gloss, no cheer and no emoji. It has a bit of
terminal edge: numbers, durations and timestamps are set in mono, the way a readout would
show them.

### Colour roles

All colour comes from tokens in `src/index.css`. `node .prototype/design-lint.ts` rejects
raw palette utilities, arbitrary colours and inline colour styles. **Colour carries meaning
only.** Everything else is grey.

| Token | Role |
| --- | --- |
| `--sidebar` `oklch(0.12…)` | Nav column, one step darker than content |
| `--background` `oklch(0.155…)` | Content surface |
| `--card` / `--raised` / `--popover` | Each layer one lightness step up. **No drop shadows inside the app.** Depth comes from lightness alone. |
| `--border` / `--hairline` | Borders around controls / quieter row dividers |
| `--foreground` → `--muted-foreground` → `--faint` | Three text levels, all AA on `--background` (faint ≥ 4.6:1) |
| `--danger` (red) | fatal, **down**, **regressed**. The things that should wake you. |
| `--warn` (amber) | error, degraded, snoozed, expired invites |
| `--ok` (green) | **Only** positive deltas and the live dot. Never "healthy". Healthy is just grey. |
| `--info` (blue) | One secondary category in breakdowns, used sparingly |
| `--cell` / `--cell-quiet` / `--cell-void` | Chart cells: a value with nothing to say / the long tail / *no data received* (outlined and hatched, so it is never mistaken for zero) |
| `--primary` | The one solid white button per view |
| `--backdrop*` | Warm grey dotted backdrop, used only for standalone pages (sign-in, invite) |

### Type

- **Geist** (variable) for UI text and **Geist Mono** for every number, delta, duration,
  timestamp, ID, URL and file path. Mono has `tabular-nums`, so live numbers never jitter.
- The scale is deliberately small and dense: `2xs 11/16`, `xs 12/18`, `sm 13/20` (body
  default), `base 14/22`. Page titles are 22–24px medium and KPI values are 22px mono.
- Section labels are small muted sentence case, not shouty caps. The one exception is the
  sidebar's UPTIME card label.
- Headings use `text-wrap: balance` and paragraphs use `text-wrap: pretty`.

### Shape

- `--radius: 6px`. Radii are concentric where surfaces nest: the menu is `xl` around
  `md` items with 4px padding, the bulk bar is `2xl` around `md` buttons with 6px padding,
  and the segmented control's outer radius is its inner radius plus padding.
- Hairline borders, not boxes inside boxes. Lists are rows divided by `--hairline`, not
  cards.
- **Charts are built from square cells.** Daily level columns, the 48-check uptime strip,
  the hourly response-time grid, the KPI micro-bars, issue sparklines and the sidebar
  uptime meter all use the same 4px-gap cell grid. The wordmark's lowercase "b" is drawn in
  the same cells.

### Motion

- Fades of 120–150ms with `ease-smooth` / `ease-out-quart`. Transitions name their
  properties; nothing uses `transition: all`.
- Buttons scale to `0.96` on press. Small icon buttons get a 40px hit area through an
  `::after` overlay.
- Chart cells grow in once (`cell-in`, 420ms) on first paint. The live dot pulses. That is
  all the motion there is.
- `prefers-reduced-motion` collapses all of it.

### Imagery

There are no illustrations and no photos. Empty and error states draw a small cell motif
(`cells="void"` for "nothing matched", a quiet grid for "nothing yet"). The only image-like
thing is the wordmark.

### Voice

Short and declarative, written as one developer talking to themselves.
- **State the fact, then the next step:** "Down for 25m", "That link doesn't match an
  invitation.", "Only the owner can change access. Nothing was changed."
- **Readouts read like an instrument:** `new 31m`, `back 2h`, `fired 3d ago`,
  `never fired`.
- **Sentence case everywhere.** "bertha" is always lowercase.
- **Failures say what happened and what is still true:** "…The list has been refreshed.",
  "Ownership can't be given away here yet, so the owner stays."

---

## Part 2 — How it's built

### One contract, two backends

`packet/contract` is the spec. `Backend` in `actions.ts` lists every read and mutation,
and every mutation returns a `Result` with named failure kinds.

- `src/data/backend.ts` is the one seam:
  - production builds always use `src/data/http.ts`, which calls `/api/v1/…`;
  - `npm run dev` uses the fixture adapter (`src/data/fixtures.ts`) with `?scenario=`;
  - `npm run dev:api` uses the server at `BERTHA_API` (default `127.0.0.1:3000`).
- The fixtures are a dynamic import, so they never ship in a production build.
- The server's types are Rust (`server/crates/bertha-core`), generated to TypeScript with
  ts-rs into `src/api/generated` and `sdk/src/generated`. `src/api/contract-check.ts`
  asserts they equal the contract's types, so drift fails `tsc`.
- Live updates are `Backend.subscribe`. The HTTP adapter reads the server's SSE stream at
  `/api/v1/live`, filtered to the viewer's projects; the fixture adapter replays
  `packet/fixtures/live.ts` with `&live=replay` (or drops the stream with `&live=down`).
  `src/data/live.ts` shares one subscription and turns it into the live dot, sidebar
  counts, the issue list's "N new" banner and refetches.

### Scenarios (fixtures only)

`?scenario=` takes:
- a generic state for every read: `loading`, `empty` or `error`;
- a bare failure kind, such as `?scenario=conflict`;
- any named scenario in `packet/fixtures/scenarios.ts`, such as `monitor-down`,
  `invite-expired`, `overview-collaborator` or `issues-inbox-zero`.

Add `&shell=ready` to keep the sidebar loaded, so `?scenario=loading&shell=ready` shows a
detail page's own loading state.

### The server

```bash
cd server
cargo run --features fixtures -- seed --builtin --dev-invites   # the design fixtures, into bertha.db
BERTHA_URL=http://localhost:4321 cargo run -- serve               # then npm run dev:api in the root
```

- On an empty database, `cargo run -- owner create you@example.com --name "Your Name"`
  makes the first account. The seeded owner is `hello@sundial.dev`.
- Without `SMTP_HOST`, emails (sign-in links included) are written to the log.
- `BERTHA_FIXED_NOW=2026-10-13T10:00:00Z` stops the clock and the workers, for comparing
  seeded data with the prototype's screenshots.
- Ingest runs through a bounded queue and one writer. Requests never wait on the
  database, and each project is limited to 50 events a second with bursts of 500.
- Workers in the same process check monitors, deliver alerts with retries, lift
  snoozes and delete what's past retention (`BERTHA_RETENTION_DAYS`, default 90).
- The `fixtures` feature adds `seed --builtin` and `BERTHA_CHECK_EVERY_SECONDS`. Release
  builds leave it out, and refuse the variable.

### Sign-in and access

- Magic links only, valid for 15 minutes and usable once. Sessions are a 30-day sliding
  cookie.
- Signing in with an unknown email says so. It's an owner tool with one or two people,
  so that's accepted over hiding who has an account.
- Mutations need `Content-Type: application/json` and `X-Bertha: 1` on top of the
  SameSite cookie.
- Collaborators see only the projects they were invited to. Every read in `bertha-db`
  takes a scope that can only come from a verified session, and
  `reads/tests.rs` checks no other project leaks.
- Owner-only actions (keys, deleting projects, team, alerts, monitors) are checked on the
  server, and the app hides them from collaborators.

### Checks

```bash
npx tsc --noEmit -p tsconfig.app.json   # the app, the contract and the generated types
npx tsc -p e2e/tsconfig.json            # the e2e suite
node .prototype/design-lint.ts          # token discipline
npx -p typescript tsc -p packet         # the packet on its own

cd server
cargo fmt --all --check
cargo clippy --workspace --all-features --tests -- -D warnings
cargo test --workspace --all-features

cd sdk && npm run check && npm test && npm run size && npm run e2e

npm run build && (cd server && cargo build --release --features fixtures)
npx playwright test                     # sign-in, first event, triage, uptime, invites
```

CI (`.github/workflows/ci.yml`) runs all of it, but not on every push to main, to save
minutes. It runs on every release tag, on pull requests, weekly on main, and by hand:
`gh workflow run ci.yml` (add `--ref <branch>` for another branch). The weekly run
matters: a cache saved on a tag can only be read by that tag, so main's caches are what
each release starts from. All four jobs run side by side (about 3½ minutes), and the e2e
binary uses the `e2e` cargo profile, which is release without LTO.

### Running it locally

```bash
npm run local                       # builds, then bertha at http://localhost:3000
npm run local -- throw "<project>"  # in another terminal: sample errors for a project
```

This is the real binary on `.local/bertha.db`, which is kept between runs (`--fresh`
starts over). The owner is your `git config user.email` (or `--email`). Emails go to a
local SMTP sink and their links print in the terminal, starting with a sign-in link. A
test site at `127.0.0.1:4400/health` answers until you `curl -X POST
127.0.0.1:4400/down` (and `/up`), so you can watch a monitor go down and recover; checks
run every 10s. `--demo` loads the design fixtures instead, with the clock stopped on
13 October 2026 (owner `hello@sundial.dev`). `--no-build` skips the build.

To send real errors from an app, use the SDK snippet on the project's setup page with
`url: "http://localhost:3000"`. The examples in `sdk/examples` work too.

### Releasing

```bash
scripts/version.sh set 0.2.0      # server, Cargo.lock, SDK and its lockfile, in step
git commit -am "v0.2.0" && git push
scripts/release.sh 0.2.0          # gate, tag, push the tag
```

The tag starts `.github/workflows/release.yml`, which builds static Linux binaries for
x86_64 and arm64, plus the SDK tarball, and attaches them to a GitHub release. A tag with
a suffix (`v0.2.0-rc.1`) is a prerelease, and `install.sh` skips it.

One gate, `scripts/release-gate.sh`, guards every way a tag can go out:
- the tag matches every version, and its commit is on `origin/main`;
- locally (`release.sh` and the `pre-push` hook in `.githooks/`, which `npm install`
  turns on), a CI run on that commit, if there is one, must have passed;
- in the release workflow, the gate runs first. Then the whole CI suite and the builds
  run side by side on the tagged commit, and the release is published only if both
  pass (about 6 minutes in all). The binary must report the tag's version.

If CI fails on the tag, nothing is published. Fix it on main, then
`scripts/release.sh 0.2.0 --retry` moves the tag to the fix. A published release never
moves: fix forward with the next version. GitHub's tag protection rules need a paid plan
on a private repo, so that rule is kept by the script, not by GitHub.

The root `npx tsc --noEmit` uses a solution-style `tsconfig.json` with `files: []`, so on
its own it checks nothing. Use the `-p tsconfig.app.json` form.

### Contract requests

`CONTRACT-REQUESTS.md` holds four:
1. `MonitorDetailPage.relatedIssues` (issues behind a downtime): applied.
2. `AcceptInvitePage.status` (expired or used is known when the link opens): applied.
3. `assignable` on the issue list (for bulk assign): applied.
4. `LiveEvent` and `Backend.subscribe` (live updates): applied.

### Still loose

Only in fixture mode; the real server doesn't have these:
- The "around this deploy" 48h series on release detail is seeded in the adapter.
- Tag breakdowns are generic across issues.
- The `allHealthy` scenario is a transform in the adapter.
- `createProject` reuses the `p-recipes` setup fixture (key "RCPE").
- `conflict` reports the conflict but doesn't change the issue underneath.
- `/__scenarios` exists only in dev.

In the real app:
- The ingest key is the only secret an SDK holds, and it's public by design. A leaked key
  can send events up to the rate limit, and rotating it stops it at once.
- An owner can point a monitor at any URL, internal addresses included. Only the owner
  can save monitors, so that's no wider than the owner's own access.

### Open questions carried from the brief

- Light mode is not designed (the brief says dark-first).
- Mobile is a read-only glance: lists collapse and triage needs a laptop.
