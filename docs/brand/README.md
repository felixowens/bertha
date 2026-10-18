# Brand

bertha is brand new. Only its name is fixed. The moodboard is one product's dashboard,
and the owner wants bertha to feel **very close to it**: the owner has agreed that its
layout may be followed closely. Its identity may not.

## Fixed

| Item | Rule |
| --- | --- |
| Name | **bertha**, always lowercase, including at the start of a sentence and in the page title. |
| Wordmark | None exists. Set the name in the UI typeface (or a close sibling) with a small, simple mark if one helps. Keep it modest; it shouldn't look like the reference's logo. |

## Open

Everything else is yours to define, within the direction in the references below: the
exact palette values, typefaces, icon set, the wordmark, spacing scale and motion.

## References

All three files show the **same screen of one product**: a dark review dashboard for a
fraud team. They are the visual direction, and following them closely is wanted:

| File | What it shows |
| --- | --- |
| `references/ref-dashboard-full.webp` | The whole screen: sidebar, top bar, headline numbers, queue list, two chart cards on the right. |
| `references/ref-filter-open.webp` | The same screen with a checkbox filter dropdown open. |
| `references/ref-detail-crop.webp` | A close crop: type sizes, row rhythm, monospace numerals, pill controls. |

**Qualities to take, closely:**

- **Colour logic.** Near-black, slightly layered surfaces: the nav column a step darker
  than the content, cards a step lighter, hairline borders instead of shadows. Colour is
  reserved for meaning:
  - red: urgent or late (here: fatal, down, regressed);
  - amber: at risk or due soon (here: error or warning, degraded, snoozed and waking);
  - dim grey: fine or quiet (the long tail);
  - green: only small positive deltas and the "live" dot;
  - blue: rarely, for one secondary category.
  Everything else is greyscale, and text runs from white through two or three greys.
- **Type treatment.** A neutral grotesk at small sizes for labels and body. **Monospace
  for every number, delta, duration, count and timestamp** (`38h 5m late`, `+2.4 pt`,
  `€3,682.24`). Muted small headings ("Saved views", "Workspace"), and headline numbers
  large and light with a coloured mono delta beside them.
- **Chart style.** Everything is built from **square pixel cells** on a dark grid:
  - tiny cell bar charts beside each headline number;
  - a segmented progress bar of squares coloured by state, with a legend of coloured
    squares and counts;
  - a waffle grid for proportions;
  - a stacked daily column chart made of cells, with a dotted line for last period's
    average and a small dark tooltip card.
  Square legend chips sit everywhere a colour needs a key.
- **Density and rhythm.** Generous row height with two lines per row (a name, then a
  muted reason). Right-aligned mono figures. Thin row dividers. Lots of black space
  around a few strong numbers.
- **Controls.** Small bordered pills for range tabs (Today / 7 days / 30 days). One solid
  white primary button per view. Checkbox dropdowns that show counts per option and
  Reset/Apply buttons. A status pill with a coloured dot ("Live"). Coloured square
  bullets before suggested actions.
- **Layout (may be followed closely).** Collapsible left sidebar: wordmark, main nav with
  counts, "saved views" with coloured square markers and counts, a settings group, a
  usage card near the bottom, and a user chip at the foot. A top bar with a context
  switcher and breadcrumb, range tabs and a filter dropdown. A strip of four headline
  numbers. A main list on the left two-thirds and a column of chart cards on the right.
- **Presentation backdrop.** A light warm-grey dotted background behind the app frame.
  Useful for sign-in, empty and marketing moments.

**Do not take:** the product's name, logo or wordmark; its sample company, people and
figures; its fraud and payments wording; its AI "ask" prompt bar, because bertha has no
assistant. bertha's content (projects, issues, releases, monitors) should shape the screens;
don't pour it into the reference's slots one for one where the content doesn't fit.
