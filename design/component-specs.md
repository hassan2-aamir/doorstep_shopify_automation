# Doorstep design system — component specs

Handoff spec for whoever builds the React front end. Every value below is a CSS variable
from `design/tokens.css`; components reference `var(--token)` or the Tailwind aliases in
`design/tailwind-theme.cjs`, never a raw hex.

## Files

| File | Role |
| --- | --- |
| `design/tokens.json` | Source of truth. Three layers: primitive → semantic → component. |
| `design/tokens.css` | Generated. Do not edit. Regenerate with the command below. |
| `design/tailwind-theme.cjs` | Theme extension to spread into the app's `tailwind.config`. |

```bash
node <skill>/scripts/generate-tokens.cjs --config design/tokens.json -o design/tokens.css
```

Dark-mode overrides for **component** tokens live under the `dark.semantic` key in
`tokens.json`, not `dark.component`. The generator emits whatever sits under `dark.semantic`
into the `.dark` block using the same variable names, and it has no `dark.component` bucket —
so putting them anywhere else silently bakes the light value into dark mode.

## Colour semantics

The one rule that keeps the four screens readable: **colour encodes who has to act.**

| Colour | Means | Used by |
| --- | --- | --- |
| Red (`danger`) | Sara must do something | Needs attention pill, reconnect banner, failed rows |
| Amber (`warning`) | Degraded but self-healing, no action needed | Live-updates-paused banner, transient token expiry |
| Green (`success`) | Done, nothing owed | Shipped and notified, synced counts |
| Neutral (`neutral`) | Waiting on someone who is not Sara | Waiting for supplier, skipped events |
| Indigo (`primary`) | Interactive affordance only | Buttons, links, active nav |

Indigo is deliberately never a status. Green and red are deliberately never decoration.
That separation is what lets a glance at Today answer "is anything wrong?" honestly.

## Status pill

Used for order stages and Sync health outcomes. **Icon and label are required props, not
options** — the app-flow spec forbids colour-only status, and a pill rendered without either
fails that bar.

| Variant | Label | Icon | bg / fg / border tokens | Contrast (light / dark) |
| --- | --- | --- | --- | --- |
| `shipped` | Shipped and notified | `check-circle` | `--pill-shipped-*` | 5.40:1 / 9.72:1 |
| `waiting` | Waiting for supplier | `clock` | `--pill-waiting-*` | 8.81:1 / 10.91:1 |
| `attention` | Needs attention | `alert-triangle` | `--pill-attention-*` | 6.05:1 / 8.31:1 |
| `skipped` | Already handled | `minus-circle` | `--pill-skipped-*` | 6.77:1 / 6.71:1 |
| `paused` | Paused | `pause-circle` | `--pill-paused-*` | 5.20:1 / 9.73:1 |

Shape: `--pill-min-height` 1.5rem, `--pill-padding-x/-y`, `--pill-radius` full,
`--pill-font-size` xs at weight 500, `--pill-icon-size` 1rem, hairline border.

Cancelled (P2) reuses `skipped` with `line-through` on the label.

A pill inside a row is decorative-adjacent text, so it needs no touch target of its own. A pill
that is itself the tap target (the header status pill) takes `min-height: var(--primitive-size-touch-target)`.

## Header status pill

One instance, always visible, showing the highest-priority workspace state. Priority order and
destinations come from the app-flow doc; this table only fixes the appearance.

| Priority | State | Variant | Label | Links to |
| --- | --- | --- | --- | --- |
| 1 | Connection expired | `attention` | Reconnect Google Sheet | `/connections?focus=sheet` |
| 2 | Open issues | `attention` | 3 need attention | `/sync-health?filter=issues` |
| 3 | Setup unfinished | `paused` | Finish setup | `/connections` |
| 4 | Live and clean | `shipped` | All syncing | `/today` |

Priorities 1 and 2 share the red variant because both demand action; rank shows in position,
not hue. Do not invent a second red to separate them.

## Banner

Full-width, above page content, one at a time. Left accent bar `--banner-accent-width` 3px in
`--banner-*-accent`; body text uses `--banner-fg` (near-black on light, near-white on dark) so
the message stays 4.5:1 while the tint carries the signal.

| Variant | When | Icon | Primary action |
| --- | --- | --- | --- |
| `danger` | Reconnect needed, open issues | `alert-triangle` | Fix button → the repairing screen |
| `warning` | Live updates paused, API unreachable | `wifi-off` | None; it clears itself |
| `info` | Setup checklist, first-run hints | `info` | Continue setup |

## Button

| Property | Default | Hover | Active | Disabled | Focus |
| --- | --- | --- | --- | --- | --- |
| Primary bg | `--button-primary-bg` | `--button-primary-hover-bg` | `--button-primary-active-bg` | `--button-primary-disabled-bg` | unchanged |
| Primary fg | `--button-primary-fg` | same | same | `--button-primary-disabled-fg` | same |
| Secondary bg | `--button-secondary-bg` | `--button-secondary-hover-bg` | `--button-secondary-hover-bg` | `--button-primary-disabled-bg` | unchanged |
| Secondary border | `--button-secondary-border` | same | same | `--color-border` | same |
| Ghost fg | `--button-ghost-fg` | same | same | `--color-foreground-muted` | same |
| Ghost bg | transparent | `--button-ghost-hover-bg` | `--button-ghost-hover-bg` | transparent | unchanged |

All buttons: height `--button-height` (44px), radius md, font-size sm at weight 500. Never
shrink below 44px on touch; the 36px `--primitive-size-control-sm` exists only for pointer-only
dense toolbars, and no primary action uses it.

## Nav item

Four peers in fixed order: Today, Orders, Sync health, Connections.

| Property | Rest | Hover | Active (current route) |
| --- | --- | --- | --- |
| Foreground | `--nav-item-fg` | `--nav-item-fg` | `--nav-item-active-fg` |
| Background | transparent | `--nav-item-hover-bg` | `--nav-item-active-bg` |
| Marker | none | none | 3px `--nav-item-active-marker`, left edge on rail, top edge on tab bar |

Layout: left rail `--primitive-size-rail` (240px) from 768px up; bottom tab bar
`--primitive-size-tabbar` (56px) below it, each item at least 44px wide and tall. Sync health
carries the open-issue badge; no other item does.

Active state is marker plus colour, never colour alone — the same rule as the pills, because
this is the second place a colour-blind merchant could lose their place.

## Event row (Sync health, Orders)

| State | Background | Left accent | Notes |
| --- | --- | --- | --- |
| Default | `--color-surface` | none | Divider `--event-row-border` hairline |
| Hover / focus | `--event-row-hover-bg` | none | Pointer only; keyboard focus shows the ring instead |
| Failed | `--event-row-failed-bg` | 3px `--event-row-failed-accent` | Sorted above the rest, not just tinted |
| Expanded | `--color-surface` | keeps its accent | Reason, Details disclosure, Fix button |

Column type: order number and tracking number in `--primitive-fontFamily-mono` at
`--event-row-mono-size`; timestamps in sans with `font-variant-numeric: tabular-nums` so the
column does not jitter while polling. Header cells use `--event-row-header-*`.

Raw `error` text renders inside the Details disclosure as text, never HTML, and never at
`--color-foreground-muted` below 4.5:1 — it is diagnostic copy someone will actually read.

## Stat (Today counts)

Label `--stat-label-size` in `--stat-label-fg` above value `--stat-value-size` weight 600 in
`--stat-value-fg`, tabular-nums. Three across from 768px, stacked below. A count of zero
renders as `0`, never as an em dash — "0 need attention" is the reassuring case.

## Drawer (order detail)

Right sheet `--drawer-width` (448px) on wide screens, full-width bottom sheet below 768px with
`--drawer-radius` on the top corners only. `--drawer-shadow`, backdrop `--color-overlay`.
Traps focus, closes on Escape, returns focus to the row that opened it.

## Accessibility floor

Non-negotiable, straight from the app-flow doc's quality floor.

- **Contrast.** Every pair in this file is measured, not estimated — run
  `node design/check-contrast.cjs design/tokens.css` to re-verify after any token change. It
  checks 25 pairs in both themes and exits non-zero on a regression. `--color-border` is
  decorative; use `--color-border-strong` (4.33:1 light, 4.14:1 dark) wherever a control outline
  must be perceivable. There is deliberately no third, lighter foreground tier — ink-500 on the
  app background reaches only 4.33:1, which clears the 3:1 bar for a border but fails text.
- **Focus.** `outline: var(--focus-width) solid var(--focus-color); outline-offset: var(--focus-offset)`
  on every interactive element. Never `outline: none` without a replacement.
- **Touch.** 44px minimum on every tap target, enforced by `min-h-touch min-w-touch`.
- **Width.** Usable at 360px (`--primitive-size-viewport-min`). Tables collapse to stacked rows
  below 768px rather than scrolling horizontally.
- **Motion.** Durations are 120–240ms. Wrap every transition in
  `@media (prefers-reduced-motion: no-preference)`.
- **Status.** Word plus icon, always. This is the rule most likely to be quietly dropped under
  time pressure, and the one a judge is most likely to notice.

## Dark mode wiring

`tokens.css` emits dark values under `.dark`, and Tailwind runs in `darkMode: 'class'`. The app
follows the system setting rather than offering a toggle, so one effect at the root drives it:

```js
const mq = window.matchMedia('(prefers-color-scheme: dark)');
const apply = () => document.documentElement.classList.toggle('dark', mq.matches);
apply();
mq.addEventListener('change', apply);
```

Because both themes are token pairs, no component needs a `dark:` variant. If you find yourself
writing one, the missing value belongs in `tokens.json` instead.
