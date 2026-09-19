# Design pass (B3): `/ui-ux-pro-max:ui-ux-pro-max`

Run before the frontend was written. It's constrained to the existing system in `design/` (tokens + `component-specs.md`), so no new colours or styles came out of it. `--design-system` generation was skipped on purpose because the system already exists. Everything below came from targeted `--domain` / `--stack` searches of the skill's database.

## Verified matches and how they're applied

| Query (domain) | Database guidance | Applied in Doorstep |
|---|---|---|
| `bottom nav limit tabs` (ux) | A fixed nav must not cover content; pad the body by the nav height | Mobile tab bar is `h-tabbar`; `<main>` gets matching bottom padding plus the safe-area inset |
| same | Full keyboard navigation, tab order follows visual order | Rail/tab bar are real `<a>` links in DOM order; skip link to main content |
| `data table mobile stacked` (ux) | Tables overflow on mobile: use horizontal scroll **or a card layout** | Card/stacked rows below 768 px. The spec forbids horizontal scroll, so the card option is the only one taken |
| `live region status update` (ux) | Announce a meaningful contextual message (`role="status"`), never a bare number | Counts region announces "2 synced, 1 skipped, 1 failed"; the header pill is `role="status"` with full words |
| `skeleton loading state` (ux) | Stable skeleton plus `aria-busy`; no flicker for near-instant work | Skeletons reserve the final layout; `aria-busy` on the loading region |
| `empty state guidance` (ux) | Helpful message plus an action, never blank space | "No activity yet", "Waiting for your first order" + Open in Shopify |
| `error recovery retry` (ux) | Clear next step (Try again) and `role="alert"` | Token-mint failure: "Couldn't load your connections" + Retry in `role="alert"` |
| `deep link state url` (ux) | URL reflects state; active nav visibly marked | `?filter=`, `?event=`, `?focus=`, `?returnTo=` all live in the URL; active nav is a solid block, not colour alone |
| `status badge icon label` (icons) | Phosphor icons; decorative next to visible text means `aria-hidden` | `@phosphor-icons/react`; pill icons are `aria-hidden` because the label carries the meaning |
| `dashboard kpi stat` (chart) | Bullet/gauge charts only when a **target** exists | Today's stats have no targets, so they stay plain numbers. A chart here would be decoration |
| `reduced motion` (ux) | Honour `prefers-reduced-motion` | All motion is behind Tailwind `motion-safe:` |
| `polling list rerender` (react stack) | Stable unique keys, never the array index | Rows keyed by `eventId` / `orderId`, so polling every 5 s doesn't remount rows or lose an expanded one |

## Fallback (no database match)

`expandable row disclosure` and the retry `accordion expand collapse` both returned **0 results**. The disclosure pattern therefore uses general WAI-ARIA defaults rather than a database match: the row summary is a `<button aria-expanded aria-controls>`, and the panel is a labelled region. Raw error text sits behind a native `<details>` element.

## Anti-patterns guarded against

- Icon-only buttons without labels: every icon button has visible text or an `aria-label`.
- Colour-only status: word + icon + dot in every pill; the active nav changes lightness and shape as well as hue.
- Removed focus rings: the global `:focus-visible` outline uses `--focus-*`.
- Toasts for background events: toasts only confirm Sara's own actions; syncs use the banner and the pill.
- Horizontal scroll at 360 px: stacked rows, and tested at 360 px (N6).
