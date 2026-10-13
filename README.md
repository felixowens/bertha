# bertha

Calm, dense error tracking for one developer's handful of small apps. This repo is the
design prototype, built clean-room from the bertha design packet (`packet/`). The backend
is mocked. Every screen reads through one `Backend` adapter over the packet's fixtures.

```bash
npm install
npm run dev -- --port 4321          # http://localhost:4321
open http://localhost:4321/__scenarios   # every route × every state
```

---

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

## Part 2 — This is a prototype

### The adapter seam

- `src/data/backend.ts` exports the single `backend: Backend` (typed by
  `packet/contract/actions.ts`). **Swap this one line to wire up a real API.**
- `src/data/fixtures.ts` is the fixture implementation over `packet/fixtures`, with
  latency.
- `src/data/scenario.ts` reads `?scenario=`:
  - a generic state for every read: `loading`, `empty` or `error`;
  - a bare failure kind, such as `?scenario=conflict`;
  - any named scenario in `packet/fixtures/scenarios.ts`, such as `monitor-down`,
    `invite-expired`, `overview-collaborator` or `issues-inbox-zero`.
- Components import types only from `packet/contract` and get data only through
  `backend`.
- `/__scenarios` lists every route and scenario as links.
- `src/data/extensions.ts` is empty: every contract gap went through
  `CONTRACT-REQUESTS.md` and was applied to the contract (it is a *proposal*).

### Checks

```bash
npx tsc --noEmit -p tsconfig.app.json   # the real type check (app + packet contract)
node .prototype/design-lint.ts          # token discipline
npx -p typescript tsc -p packet         # the packet on its own
```

The root `npx tsc --noEmit` uses a solution-style `tsconfig.json` with `files: []`, so on
its own it checks nothing. Use the `-p tsconfig.app.json` form.

### Contract requests

`CONTRACT-REQUESTS.md` holds three requests. **All three are approved and applied** to
`packet/contract` and `packet/fixtures`:
1. `MonitorDetailPage.relatedIssues` (issues behind a downtime).
2. `AcceptInvitePage.status` (expired or used is known when the link opens).
3. `assignable` on the issue list (for bulk assign).

None are open.

### Deliberately loose

These are prototype shortcuts, not design decisions:

**Data and fixtures**
- **Collaborator view:** the overview KPIs and events chart still show all-project totals.
- **Inbox zero (`issues-inbox-zero`):** the sidebar Issues count still says 80.
- **Mock specifics:**
  - The "around this deploy" 48h series on release detail is seeded in the adapter. It is
    not a fixture.
  - Tag breakdowns are generic across issues.
  - The `allHealthy` scenario is a transform in the adapter.
- **Monitor fixture:** the paused monitor has checks after its pause date (28 Sept).
- **Projects:** `createProject` reuses the `p-recipes` setup fixture (key "RCPE").
- **Issue conflict mock:** `conflict` reports the conflict but doesn't change the issue
  underneath.
- **Missing scenario:** detail pages have no loading scenario; the generic `?scenario=loading`
  covers list pages.

**Permissions**
- Collaborators still see Rotate key and Delete, and the owner row has a remove button.
  This lets the `permission_denied` and `cannot_remove_owner` scenarios be shown. A real
  build would hide them.

**Forms and actions**
- MonitorForm defaults to the first project without a monitor.
- Deleting an alert rule has no confirmation.
- The `delivery_failed` scenario fails the test for every destination, not just one.

**Prototype-only affordances**
- After "Check your inbox", sign-in shows a dashed **"Prototype only: pretend the link was
  opened"** button that stands in for the email magic-link handoff.
- `/__scenarios` is the other one.

### Open questions carried from the brief

- Light mode is not designed (the brief says dark-first).
- Mobile is a read-only glance: lists collapse and triage needs a laptop.
