# bertha

Error tracker for one developer's ~10 small apps, run on their own VPS. The app is Vite +
React + Tailwind v4 (`src/`). The server is Rust: axum, sqlx on SQLite, with the app
embedded (`server/`). `sdk/` is `@bigbertha/sdk`. See `README.md` for how it's built,
`docs/design.md` for the design language and `deploy/README.md` for running it.

## Planning: be ambitious about time

Your sense of how long work takes is calibrated to humans doing it by hand. All our work
is done with Claude, so scale your estimates down: what feels like an hour is about
2 minutes, and what feels like a day is about 30 minutes. Plan accordingly:
- Don't trim scope, split work into "phase 2", or offer a "quick version" because a task
  seems big.
- Do the full job, cover every state and fix what you notice along the way.

## Commands

```bash
npm run dev -- --port 4321                # the app on fixtures, always port 4321
npm run dev:api                           # the app against the server on :3000
npx tsc --noEmit -p tsconfig.app.json     # the real type check (includes the contract check)
npx tsc -p e2e/tsconfig.json              # the e2e suite
node .prototype/design-lint.ts            # token discipline (also runs as a hook on every edit)
node .prototype/screenshot.ts "http://localhost:4321/<route>?scenario=<name>"
```

Plain `npx tsc --noEmit` checks nothing: the root `tsconfig.json` has `files: []`.

Server (run from `server/`; `rust-toolchain.toml` pins 1.99, so set
`RUSTUP_TOOLCHAIN=1.99` if the shell's default overrides it):

```bash
cargo fmt --all
cargo clippy -q --workspace --all-features --tests -- -D warnings   # also without --all-features
cargo test -q --workspace --all-features    # also regenerates src/api/generated and sdk/src/generated
DATABASE_URL=sqlite://$PWD/target/sqlx-dev.db SQLX_OFFLINE=false \
  cargo sqlx prepare --workspace -- --tests   # after adding or changing any query! macro
```

`.cargo/config.toml` sets `SQLX_OFFLINE=true`, so the checked-in `.sqlx/` must be current.

SDK (from `sdk/`): `npm run check`, `npm test`, `npm run size`, `npm run e2e`.

Locally: `npm run local` (real binary, `.local/bertha.db`, emails print in the terminal),
`npm run local -- throw "<project>"` for sample errors.

CI doesn't run on pushes to main (the owner pushes straight to main). It runs on release
tags, PRs, weekly and by `gh workflow run ci.yml`, so run the checks above locally before pushing.

Releases: `scripts/version.sh set X.Y.Z`, commit, push, then `scripts/release.sh X.Y.Z`
(`--retry` if the tag's run failed). Never push a `v*` tag around the gate (`--no-verify`).
The release also publishes the SDK to npm as `@bigbertha/sdk` by trusted publishing; there
is no npm token, so never add one.

End to end: `npm run build && (cd server && cargo build --release --features fixtures)`,
then `npx playwright test`. The suite starts its own bertha, SMTP sink and flaky site
(`e2e/harness.ts`).

## Data rules

- Components get data **only** through `backend` from `src/data/backend.ts`. Never import
  from `fixtures/` in a component.
- Types come from `src/contract` (`domain.ts`, `pages.ts`, `actions.ts`).
- `backend` is the HTTP adapter (`src/data/http.ts`) in production and with `dev:api`, and
  the fixture adapter (`src/data/fixtures.ts`) in `npm run dev`. Fixtures are a dynamic
  import and must never reach a production bundle.
- `?scenario=` switches states in fixture mode: `loading`, `empty`, `error`, a bare
  failure kind, or a named scenario from `fixtures/scenarios.ts`. `&shell=ready`
  keeps the sidebar loaded. `/__scenarios` lists them all.
- Design every state of a page, not just ready: loading, empty and each named failure.
- Live updates are `backend.subscribe`; components use the hooks in `src/data/live.ts`.

## Server rules

- Wire types live in `bertha-core` and are generated with ts-rs. Never hand-edit
  `src/api/generated` or `sdk/src/generated`. `src/api/contract-check.ts` must keep
  proving they equal `src/contract`.
- Every read in `bertha-db` takes a `Viewer` scope. Collaborators must never see another
  project; add a case to `reads/tests.rs` for any new read.
- Owner-only actions are checked on the server, not just hidden in the app.
- Mutation failures are per-operation enums that match the contract's failure kinds.
  Anything else is an `ApiError` (4xx/5xx).
- Migrations only add. Never edit a migration that has shipped; write a new one.
- No `unwrap` outside tests. Errors that reach a person say what happened and what to do,
  in the voice below.
- Test knobs (`seed --builtin`, `BERTHA_CHECK_EVERY_SECONDS`) sit behind the `fixtures`
  feature, and release builds refuse them.

## The contract

`src/contract` is the spec for the app, the server and the fixtures. Change it only like
this:
1. Add an entry to `CONTRACT-REQUESTS.md`.
2. Get the user's approval.
3. Edit `src/contract` and `fixtures/` (then `node scripts/export-fixtures.ts` for the
   seed), and mark the entry applied.

`docs/` holds the original brief and brand notes; they describe intent, not the code.

## Design rules

- **Colours come only from tokens** in `src/index.css`. The lint rejects raw palette
  classes, arbitrary colours and inline colour styles. Opacity on a token is fine.
- **Colour is a status traffic light**, mapped only in `src/lib/meaning.ts`:
  - red (`danger`) is act now: a crash (level `fatal`), down, regressed;
  - amber (`warn`) is look soon: new, degraded, a spike, snoozed;
  - green (`ok`) is fine: up, healthy, resolved, delivered, positive deltas, the live dot;
  - everything else is grey, including an ordinary error. Levels also differ by shape
    (`LevelGlyph`), so colour is never the only signal.
- **No shadows inside the app.** Depth comes from surface lightness. `shadow-pop` is only
  for floating menus and dialogs.
- **Charts are built from square cells.** No-data cells are hatched (`cell-void`), never
  shown as zero.
- **Type:** Geist for UI and Geist Mono for every number, duration, timestamp, ID, URL and
  path.
- **Motion:** 120–150ms fades. Name the properties in transitions, never
  `transition: all`. Buttons scale to 0.96 on press.

## Voice

- "bertha" is always lowercase.
- Use sentence case everywhere.
- Copy is short and declarative: state the fact, then the next step, e.g. "Down for 25m",
  "Only the owner can change access. Nothing was changed."
- No cheer, no marketing tone, no emoji.
