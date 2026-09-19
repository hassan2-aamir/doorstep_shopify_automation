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

## Second pass (19 Sep, evening): landing page and onboarding

Invoked `/ui-ux-pro-max:ui-ux-pro-max` for the public landing page (`/welcome`) and the three-step setup (`/setup`),
constrained to the existing tokens and `design/component-specs.md`. Searches run and what was applied:

| Search | Result | Applied |
|---|---|---|
| `landing`: "minimal direct demo hero micro saas" | Matched *Minimal Single Column* (Minimal and Direct: hero, short description, 3 benefit bullets, CTA, footer; single CTA focus, large type, whitespace) and *Product Demo + Features* (product mockup, then feature breakdown; a non-video fallback; nothing autoplays under reduced motion) | Section order: hero, three benefit blocks, a demo panel, how it works, closing CTA, footer. One primary CTA repeated, a quiet secondary link. The demo is a static panel built from the real components, so it needs no video and has no motion to suppress |
| `ux`: "onboarding stepper progressive disclosure" | *Onboarding, User Freedom*: provide Skip and Back, do not force a linear unskippable tour. Also *Heading Line Balance*: bound the measure and use `text-wrap: balance` | Setup has **Skip for now** in the header, **Back** on every step, and completed steps are clickable. Headings use `text-balance` with a bounded width |
| `ux`: "scroll reveal reduced motion" | *Reduced Motion* and *Motion Sensitivity*: honour `prefers-reduced-motion`, no scroll-jacking or parallax | Only the hero fades in once (`motion-safe:animate-pop-in`); nothing is tied to scroll; the global reduced-motion rule already applies |

Constraints kept from the earlier pass: flat blocks with no shadows, exactly **one** feature block per screen (the
landing demo panel; the setup screens have none), word + icon + dot for every status, 44 px targets, 360 px
minimum, indigo only for interactive elements.

Two decisions that depart from the generic recommendation, on purpose:

- The primary button is the indigo-700 fill from the design system, not the palette's green: green means *shipped* in this product.
- The landing page makes **no numeric promises**. The PRD target was under 60 s; the measured figure is minutes
  (`evidence/test-results.md`), so the copy says "within a few minutes".

Verification: e2e checks L1 to L6 (`app/e2e/run.mjs`, 18/18 passing), including no horizontal scroll at 360 px on
`/welcome` and every setup step, exactly one `h1`, exactly one `main`, no unnamed links or buttons. Screenshots:
`evidence/screenshots/app/11-landing.png` through `16-setup-mobile.png` (the setup shots show the mock Fastn widget
the test server uses; retake them with the real widget for the submission).
