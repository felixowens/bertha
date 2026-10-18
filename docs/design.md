# The design language: "Instrument"

## Mood

bertha should read like a bench instrument: dark, quiet and precise. It stays grey until
something is wrong. The owner should be able to take in all ten projects at once and only
notice the ones that need them. There is no gloss, no cheer and no emoji. It has a bit of
terminal edge: numbers, durations and timestamps are set in mono, the way a readout would
show them.

## Colour roles

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
  the same cells.

## Motion

- Fades of 120–150ms with `ease-smooth` / `ease-out-quart`. Transitions name their
  properties; nothing uses `transition: all`.
- Buttons scale to `0.96` on press. Small icon buttons get a 40px hit area through an
  `::after` overlay.
- Chart cells grow in once (`cell-in`, 420ms) on first paint. The live dot pulses. That is
  all the motion there is.
- `prefers-reduced-motion` collapses all of it.

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
