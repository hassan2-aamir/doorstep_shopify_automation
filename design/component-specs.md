# Doorstep design system — component specs

Handoff spec for whoever builds the React front end. Every value is a CSS variable from
`design/tokens.css`; components use `var(--token)` or the Tailwind aliases in
`design/tailwind-theme.cjs`, never a raw hex.

## Direction

From the ui-ux-pro-max recommendation for a **Micro SaaS** product:

| Input | What we took from it |
| --- | --- |
| Flat Design (primary) | Zero shadows, solid fills, surfaces separated by colour not elevation, icon-heavy, 150–200ms transitions |
| Vibrant & Block-based (primary) | Block layout with 48px gaps, oversized type for the numbers that matter, high contrast (7:1 target) |
| Motion-Driven + Micro-interactions (secondary) | Press feedback, hover colour shifts, skeleton sheen, pop-in for new events |
| Executive Dashboard | Today leads with one giant verdict and three huge KPI numbers; detail lives one tap away |
| Micro SaaS palette | Indigo `#6366F1` brand, emerald, violet-tinted `#F5F3FF` background, deep indigo `#1E1B4B` ink |

## Where we deliberately departed from the recommendation

These are choices, not oversights. Revert one only if you accept the cost in its row.

| Recommendation | What we did instead | Why |
| --- | --- | --- |
| Emerald `#059669` as the CTA accent | Emerald means **success / shipped** only; CTAs are indigo | Doorstep's core job is legible order status. If buttons are green, "Shipped" and "Retry" look alike. |
| Vibrant's neon palette (`#39FF14`, `#BF00FF`, `#FF1493`…) | Kept the block structure, took colour from the Micro SaaS palette | Neon green collides with success and fails contrast on white; the recommendation itself lists "formal business" as a do-not-use. |
| Vibrant's continuous animated background patterns | Motion only responds to what the merchant or a sync just did | Ambient motion competes with the one thing that must move the eye — a new failure — and breaks reduced-motion. |
| Primary `#6366F1` with the palette's black "On Primary" text | Buttons fill with indigo-700 `#4338CA` + white; `#6366F1` stays as `--color-brand` for large decorative blocks | White on `#6366F1` is 4.47:1 (fails AA). Black on it passes but reads as a bug on a button. indigo-700 + white is 7.90:1. |
| Flat Design radius 0–4px | 4 / 8 / 12px plus full pill | Pure square corners read as unfinished at dashboard density; 8px keeps it flat without feeling like a wireframe. |

## Colour semantics

Unchanged by the restyle because it comes from the product, not the aesthetic: **colour says who has to act.**

| Colour | Means | Used by |
| --- | --- | --- |
| Red | Sara must do something | Needs attention, reconnect banner, failed rows |
| Amber | Degraded but self-healing, no action | Live-updates-paused banner, "Finish setup" |
| Emerald | Done, nothing owed | Shipped and notified, synced counts, "All syncing" |
| Slate | Waiting on someone who is not Sara | Waiting for supplier |
| Lilac | Nothing happened, by design | Skipped events |
| Indigo | Interactive, never a status | Buttons, links, active nav, focus ring |

Flat Design caps a palette at 4–6 solid colours. This system uses exactly four chromatic hues
(indigo, emerald, red, amber) plus the ink and slate/lilac neutrals.

## Layout: blocks, not cards

The layout unit is a **block**: `--block-bg` on the violet-tinted `--color-background`, a 2px
`--block-border`, `--block-radius` 8px, `--block-padding` 24px, **no shadow**. The tint
difference between page and block does the job a shadow would do in a non-flat system.

- Gap between blocks: `--block-gap` 48px on wide screens, `--block-gap-tight` 24px below 768px.
- Gutter: `--spacing-gutter` 16px at 360px width.
- **Feature block** (`--block-feature-*`): a solid deep-indigo block with white text. Exactly one
  per screen, reserved for the answer to that screen's main question. On Today it holds the
  verdict. Using it twice on a screen destroys the hierarchy it exists to create.

## Today (Executive Dashboard)

Top to bottom:

1. **Verdict** in a feature block: `text-verdict` (36px, weight 800, −0.03em). "All orders are
   moving" in `--verdict-ok-fg`, or "3 orders need attention" in `--verdict-issue-fg`. This is
   the Vibrant "large type 32px+" rule applied to the only sentence that matters.
2. **Banner** if any, directly under the verdict.
3. **Three stats** in blocks: label `--stat-label-*` (12px, bold, +0.06em tracking, uppercase)
   over value `text-stat` (48px, weight 800, tabular-nums). Three across from 768px, stacked below.
   Zero renders as `0`, never a dash — "0 need attention" is the good news.
4. **Last 5 events** as event rows.

## Status pill

Icon, label and dot are all **required**. The app-flow doc forbids colour-only status.

| Variant | Label | Icon | Tokens | Light / dark contrast |
| --- | --- | --- | --- | --- |
| `shipped` | Shipped | `check-circle` | `--pill-shipped-*` | 7.29 / 10.27 |
| `waiting` | Waiting on supplier | `clock` | `--pill-waiting-*` | 9.45 / 8.60 |
| `attention` | Needs attention | `alert-triangle` | `--pill-attention-*` | 7.60 / 8.86 |
| `skipped` | Already handled | `minus-circle` | `--pill-skipped-*` | 6.58 / 6.64 |
| `paused` | Paused | `pause-circle` | `--pill-paused-*` | 6.84 / 10.14 |

Shape: min-height 28px, pill radius, 12px bold label with +0.06em tracking, 16px icon, 1px
border, and an 8px solid dot in `--pill-*-solid` before the icon. The dot is the flat-design
colour block. It survives greyscale printing and small sizes where the tinted background doesn't.

Skipped and paused sit just under the 7:1 target. That's on purpose: they're the quietest
states. Making "Already handled" as loud as "Needs attention" would break the hierarchy the
target is supposed to serve. Both clear AA with room to spare.

## Banner

Flat treatment: a 3px `--banner-*-border` on all sides, a tinted `--banner-*-bg`, and the icon
inside a **solid coloured square** (`--banner-icon-box` 40px, `--banner-*-icon-bg`). A glyph in
a solid block is the Flat Design Mobile pattern, and it reads at a glance where an outlined
icon doesn't. Body text uses `--banner-fg` so it stays 12:1+ while the colour carries the signal.

| Variant | When | Icon | Action |
| --- | --- | --- | --- |
| `danger` | Reconnect needed, open issues | `alert-triangle` | Fix → the repairing screen |
| `warning` | Live updates paused | `wifi-off` | None; clears itself |
| `info` | Setup checklist | `list-checks` | Continue setup |

The warning icon box uses a near-black glyph on amber-500 (9.13:1). White on amber fails.

## Button

48px tall (`--button-height`), 24px horizontal padding, 8px radius, 14px bold, 2px border.

| Variant | Rest | Hover | Pressed | Disabled |
| --- | --- | --- | --- | --- |
| Primary | indigo-700 fill, white | indigo-800 | indigo-900 + scale 0.97 | slate-200 fill, slate-600 text |
| Secondary | white fill, 2px ink border | indigo-50 fill | scale 0.97 | border `--color-border` |
| Ghost | indigo-700 text, no fill | indigo-50 fill | scale 0.97 | `--color-foreground-muted` |

The secondary button's heavy 2px ink border is the block-based signature. It's how a flat UI
shows a control without a shadow.

## Navigation

Four peers in fixed order: Today, Orders, Sync health, Connections.

- **Active**: solid `--nav-item-active-bg` (indigo-700) with white text. A full colour block, not
  a subtle tint, so it follows the block-based style and survives colour-blindness because the
  change is in lightness as well as hue.
- **Hover**: `--nav-item-hover-bg` indigo-50.
- **Rest**: `--nav-item-fg` slate-600.
- Left rail 240px from 768px up. Below that, a bottom tab bar (64px) with solid fill and no
  floating pill, per Flat Design Mobile. Each tab is at least 44×44px.
- Sync health carries the open-issue count badge. No other item does.

## Event row

| State | Treatment |
| --- | --- |
| Default | `--color-surface`, 1px `--event-row-border` divider |
| Hover | `--event-row-hover-bg` (pointer only) |
| Failed | `--event-row-failed-bg` plus a 3px `--event-row-failed-accent` left edge, sorted to the top |
| Expanded | Reason in plain words, Details disclosure with raw error, Fix button |
| New arrival | `animate-pop-in` once, then static |

Order number and tracking number in mono at 14px. Timestamps in sans with
`font-variant-numeric: tabular-nums` so the column doesn't jitter while polling every 5 seconds.
Header cells: 12px bold uppercase, +0.06em tracking, `--event-row-header-fg`.

## Drawer (order detail)

Right sheet 480px from 768px up; full-width bottom sheet below with 12px top corners. **No
shadow**: a 3px `--drawer-border` edge separates it from the page, with `--color-overlay` behind.
Traps focus, closes on Escape, returns focus to the row that opened it.

## Motion

Every animation answers something the merchant did or something a sync just did. Nothing
moves on its own.

| Interaction | Duration | Easing | Detail |
| --- | --- | --- | --- |
| Press (buttons, rows, tabs) | `--primitive-duration-press` 100ms | `out-1` | `scale(0.97)`, no delay |
| Hover colour shift | 150ms | `out-1` | Colour and background only, never layout props |
| New event arrives | 300ms | `out-2` | `pop-in`: fade + 4px rise, once |
| Drawer open | 300ms | `out-2` | Slide from edge |
| Skeleton loading | 1200ms loop | `in-out` | One synced sheen per group, never for waits under 300ms |

Rules from the motion data: keep hover displacement under 2px; always pair a hover-in with its
reverse; don't animate width, height or margin. **Wrap all of it in
`@media (prefers-reduced-motion: no-preference)`.** With reduced motion, state changes are
instant and the skeleton is static.

## Typography

**Plus Jakarta Sans** (the "Friendly SaaS" pairing: approachable, SaaS-native, weights to 800
for the flat display type), with a system mono stack for order and tracking numbers. Load one
variable file:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400..800&display=swap" rel="stylesheet" />
```

| Role | Size | Weight | Tracking |
| --- | --- | --- | --- |
| Stat value | 48px | 800 | −0.03em |
| Verdict | 36px | 800 | −0.03em |
| Page heading | 28px | 700 | −0.01em |
| Body | 16px | 400 | 0 |
| Label / table header | 12px | 700 | +0.06em, uppercase |

## Accessibility floor

- **Contrast.** Run `node design/check-contrast.cjs design/tokens.css` after any token change. It
  checks 42 pairs in both themes, fails on anything under 4.5:1 for text or 3:1 for UI, and
  reports which text pairs reach the 7:1 target (currently 23/26 light, 21/26 dark).
- **Focus.** 3px `--focus-color` outline with 2px offset on every interactive element.
- **Touch.** 44px minimum; buttons are 48px.
- **Width.** Usable at 360px. Tables collapse to stacked rows below 768px, with no horizontal scroll.
- **Status.** Word + icon + dot, always.

## Dark mode

Deep indigo (`#13102E` page, `#1E1B4B` blocks), not neutral black, so the brand carries into
dark. Flat Design Mobile warns against dark-*first* products; this is system-following dark,
which the product docs require.

`tokens.css` emits dark values under `.dark`. Tailwind runs `darkMode: 'class'`, and one root
effect follows the system:

```js
const mq = window.matchMedia('(prefers-color-scheme: dark)');
const apply = () => document.documentElement.classList.toggle('dark', mq.matches);
apply();
mq.addEventListener('change', apply);
```

No component needs a `dark:` variant. If you're writing one, the value belongs in `tokens.json`.

## Regenerating

```bash
node <ui-ux-pro-max>/skills/design-system/scripts/generate-tokens.cjs \
  --config design/tokens.json -o design/tokens.css
node design/check-contrast.cjs design/tokens.css
```

Dark overrides for **component** tokens go under `dark.semantic` in `tokens.json`. The generator
has no `dark.component` bucket, and it emits everything under `dark.semantic` into `.dark` with
matching variable names. Put them anywhere else and the light value silently ships in dark mode.
