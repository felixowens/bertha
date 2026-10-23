# The design language: "Instrument"

Largely inspired by [Halden: Fraud Analyst Dashboard](https://dribbble.com/shots/27806206-Halden-Fraud-Analyst-Dashboard) by
[Petras Nargela](https://dribbble.com/nargela) for Flair.

## Mood

bertha should read like a bench instrument: dark, quiet and precise. It stays grey until
something is wrong. The owner should be able to take in all ten projects at once and only
notice the ones that need them. There is no gloss, no cheer and no emoji. It has a bit of
terminal edge: numbers, durations and timestamps are set in mono, the way a readout would
show them.

## Colour roles

All colour comes from tokens in `src/index.css`. `node .prototype/design-lint.ts` rejects
raw palette utilities, arbitrary colours and inline colour styles. **Colour carries meaning
only.** It is a traffic light for how things stand, not how loud an error is: red is act
now, amber is look soon, green is fine, and everything else, including an ordinary error,
is grey. `src/lib/meaning.ts` is the only place meaning becomes colour, and the `?` sheet
shows the key.

Log lines are the one exception: they take the colours every log viewer uses, so a page
of them scans by level. A line's level reads red for `error` and `fatal` (the glyph tells
them apart), amber for `warning` and grey below. Messages stay in greys: `error` and
`warning` in full foreground, `info` muted and `debug` the quietest. The logs volume strip
stacks the same colours worst-first at the base of each column, and hatches the times bertha kept no logs.

| Token | Role |
| --- | --- |
| `--sidebar` `oklch(0.12…)` | Nav column, one step darker than content |
| `--background` `oklch(0.155…)` | Content surface |
| `--card` / `--raised` / `--popover` | Each layer one lightness step up. **No drop shadows inside the app.** Depth comes from lightness alone. |
| `--border` / `--hairline` | Borders around controls / quieter row dividers |
| `--foreground` → `--muted-foreground` → `--faint` | Three text levels, all AA on `--background` (faint ≥ 4.6:1) |
| `--danger` (red) | Act now: a crash (the `fatal` level), **down**, **regressed**, failed deliveries |
| `--warn` (amber) | Look soon: new issues, degraded, a spike, snoozed, expired invites |
| `--ok` (green) | Fine: up, healthy, resolved, a delivered test, fixes holding, positive deltas and the live dot |
| grey (`--cell`, `--cell-quiet`, text levels) | Everything else, including the ordinary `error` level and warnings. Levels also differ by shape: a triangle for a crash, a filled square for an error, a hollow square for a warning |
| `--info` (blue) | One secondary category in breakdowns, used sparingly |
| `--cell` / `--cell-quiet` / `--cell-void` | Chart cells: a value with nothing to say / the long tail / *no data received* (outlined and hatched, so it is never mistaken for zero) |
| `--primary` | The one solid white button per view |
| `--backdrop*` | Warm grey dotted backdrop, used only for standalone pages (sign-in, invite) |

## Type

- **Geist** (variable) for UI text and **Geist Mono** for every number, delta, duration,
  timestamp, ID, URL and file path. Mono has `tabular-nums`, so live numbers never jitter.
- The scale is deliberately small and dense: `2xs 11/16`, `xs 12/18`, `sm 13/20` (body
  default), `base 14/22`. Page titles are 22–24px medium and KPI values are 22px mono.
- Section labels are small muted sentence case, not shouty caps. The one exception is the
  sidebar's UPTIME card label.
- Headings use `text-wrap: balance` and paragraphs use `text-wrap: pretty`.

## Shape

- `--radius: 6px`. Radii are concentric where surfaces nest: the menu is `xl` around
  `md` items with 4px padding, the bulk bar is `2xl` around `md` buttons with 6px padding,
  and the segmented control's outer radius is its inner radius plus padding.
- Hairline borders, not boxes inside boxes. Lists are rows divided by `--hairline`, not
  cards.
- **Charts are built from square cells.** Daily level columns, the 48-check uptime strip,
  the hourly response-time grid, the KPI micro-bars, issue sparklines and the sidebar
  uptime meter all use the same 4px-gap cell grid. The wordmark's lowercase "b" is drawn in
  the same cells. The one exception is the trace waterfall: spans need millisecond precision,
  so they are continuous bars (2px rounded, 2px minimum width) on hairlines at round time
  marks. A call that sent nothing is still hatched with `cell-void`.

## Motion

Motion says where something went or what just changed. It's quick and never decorative.

- **Timing.** State changes take 150ms and movement takes 200ms, both on `ease-smooth`.
  Exits are shorter (100–150ms, `ease-in-quart`). Transitions name their properties;
  nothing uses `transition: all`.
- **Press.** Buttons and small controls settle to `0.96` while held (`Button`, or the
  `press` utility on a plain button). Links and buttons fade between colours by default,
  and underlines fade in (`underline-fade`) instead of popping.
- **Pages.** A new page fades in and rises 4px (`animate-page-in`). Each block on it
  fades in as it mounts, so data that arrives after a skeleton settles in. The frame,
  the sidebar and a project's header stay put; another tab of the same project doesn't
  rise in again.
- **Where you are.** The current nav item, pill tab, segmented option and project tab
  sit on a highlight that slides between them (`Indicator` in `ui/motion.tsx`). It
  lands without moving on first paint.
- **Opening and closing.** Groups, stack frames and the like open by height
  (`Collapse`). Menus and tooltips grow from the edge they're attached to; dialogs zoom
  in from 0.97; the mobile drawer slides. Every one of them animates out as well as in.
- **What changed.** A number that changes rises into place (`Tick`); the first value just
  shows. A triaged row folds away before it leaves. New rows from the live banner arrive
  with a raised wash that fades (`animate-arrive`). Toasts slide up, stack three deep,
  pause while hovered and slide out. A copy confirms with a check that pops in.
- **Charts.** Chart cells grow in once (`cell-in`, 420ms) on first paint. The live dot
  pulses.
- **Fill modes.** Custom animations fill `backwards`, never `forwards`. A held end state
  would override the classes that hide things (a held `opacity: 1` showed the bulk bar),
  and a held `translate` turns a page into the containing block for fixed bars.
- **Reduced motion.** `prefers-reduced-motion` collapses all of it; script-driven motion
  checks `motionOk()`.

## Imagery

There are no illustrations and no photos. Empty and error states draw a small cell motif
(`cells="void"` for "nothing matched", a quiet grid for "nothing yet"). The only image-like
thing is the wordmark.

## Voice

Short and declarative, written as one developer talking to themselves.
- **State the fact, then the next step:** "Down for 25m", "That link doesn't match an
  invitation.", "Only the owner can change access. Nothing was changed."
- **Readouts read like an instrument:** `new 31m`, `back 2h`, `fired 3d ago`,
  `never fired`.
- **Sentence case everywhere.** "bertha" is always lowercase.
- **Failures say what happened and what is still true:** "…The list has been refreshed.",
  "Ownership can't be given away here yet, so the owner stays."
