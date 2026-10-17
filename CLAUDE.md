# bertha

Design prototype for bertha, an error tracker for one developer's ~10 small apps. Vite +
React + Tailwind v4. The backend is mocked. See `README.md` for the design language and
the list of deliberate prototype shortcuts.

## Planning: be ambitious about time

Your sense of how long work takes is calibrated to humans doing it by hand. All our work
is done with Claude, so scale your estimates down: what feels like an hour is about
2 minutes, and what feels like a day is about 30 minutes. Plan accordingly:
- Don't trim scope, split work into "phase 2", or offer a "quick version" because a task
  seems big.
- Do the full job, cover every state and fix what you notice along the way.

## Commands

```bash
npm run dev -- --port 4321                # dev server, always port 4321
npx tsc --noEmit -p tsconfig.app.json     # the real type check
node .prototype/design-lint.ts            # token discipline (also runs as a hook on every edit)
npx -p typescript tsc -p packet           # the packet contract on its own
node .prototype/screenshot.ts "http://localhost:4321/<route>?scenario=<name>"
```

Plain `npx tsc --noEmit` checks nothing: the root `tsconfig.json` has `files: []`.

## Data rules

- Components get data **only** through `backend` from `src/data/backend.ts`. Never import
  from `packet/fixtures` in a component.
- Types come from `packet/contract` (`domain.ts`, `pages.ts`, `actions.ts`).
- The fixture adapter is `src/data/fixtures.ts`. Swapping `backend` is the seam for a real
  API.
- `?scenario=` switches states: `loading`, `empty`, `error`, a bare failure kind, or a
  named scenario from `packet/fixtures/scenarios.ts`. `/__scenarios` lists them all.
- Design every state of a page, not just ready: loading, empty and each named failure.

## The packet

`packet/` is a copy of `~/playground/design/bertha-packet`. Its contract is a **proposal**,
so it can change, but only like this:
1. Add an entry to `CONTRACT-REQUESTS.md`.
2. Get the user's approval.
3. Edit `packet/contract` and `packet/fixtures`, and mark the entry applied.
4. Remind the user to copy `packet/` back to the original.

Never edit anything else in `packet/`.

## Design rules

- **Colours come only from tokens** in `src/index.css`. The lint rejects raw palette
  classes, arbitrary colours and inline colour styles. Opacity on a token is fine.
- **Colour means something:**
  - red (`danger`) is fatal, down or regressed;
  - amber (`warn`) is error, degraded or snoozed;
  - green (`ok`) is only positive deltas and the live dot;
  - everything else is grey.
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
