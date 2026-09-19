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

## Third pass (20 Sep): the landing page as the demo story

The second-pass landing page told what Doorstep does but could not carry a live pitch. `/` is now a ten-slide story
(cover, problem, silence, insight, how it works, the one screen, proof, audience, how it was built, get started) that can be
presented by scrolling or with the keyboard (`Space`, arrows, `PageDown`, `Home`, `End`) and still works for a cold visitor.
Invoked `/ui-ux-pro-max:ui-ux-pro-max` again, constrained to the same tokens and `design/component-specs.md`:

| Search | Result | Applied |
|---|---|---|
| `landing`: "storytelling problem solution pitch micro saas" | *Scroll-Triggered Storytelling*: intro hook, problem, journey, solution, climax CTA; a progress indicator; keep the narrative understandable without scroll effects; render each chapter in its final readable state under reduced motion | Slide order follows it. A progress bar under the header (all widths) and a dot rail (from 1280 px). Reveals are fade + 4 px rise, play once when a slide is first seen, and exist only inside `prefers-reduced-motion: no-preference`, so without motion or JS every slide is simply visible |
| `ux`: "scroll snap progress indicator reduced motion" | *Reduced Motion*, *Motion Sensitivity* (no parallax or scroll-jacking), *Progress Indicators* | Snap is `proximity`, never `mandatory`, and slides use `min-height`, so a slide taller than the window (a phone) still scrolls freely. No scroll-scrubbing |
| `ux`: "keyboard shortcuts navigation focus" | *Keyboard Navigation*, *Focus States* | Keys are ignored with a modifier held, in form fields, and for `Space` when a button or link has focus. In a slide clearly taller than the window the browser scrolls natively until the slide's edge. Every rail dot is a real link with an `aria-label` ("3 of 10: The insight") and `aria-current` |

Departures, on purpose:

- The recommendation gives each chapter its own colour. Colour here means who has to act, so chapters differ only by a
  tonal step (`background` and `surface-sunken`), and the single dark feature block is the Today mock on slide 6.
- Slide 6 has a "Something broke" toggle so the presenter can show the verdict flip live. The failure text replaces the
  verdict sub-line and the first row instead of adding a banner, so the block does not change height.
- The second pass made no numeric promises. Now that latency was measured, slide 7 shows **about 7 s** payment to row
  (6.2, 7.5 and 7.6 s on three real orders, both flows on Fastn's instant tier), **1** row per replayed order (T2) and
  **1** email per re-run shipment (T5), each with its source in `evidence/test-results.md`. No seller quote and no other
  figures appear, and Sara is labelled a persona.
- The header is sticky on `/` and `/welcome` only, so brand and links stay in view while presenting.

Verification: a throwaway Playwright run against `vite preview` at 1440x900, 1024x768 and 360x740, light and dark, passed
22 of 22 (no horizontal scroll; one `h1`, one `main`, ten headed slides, no unnamed controls; `Space`, arrows, `PageDown`,
`Home` and `End` move between slides and update the progress bar; the toggle flips the verdict; `Space` on a focused button
activates it; reduced motion shows all 62 reveal elements with no animation; with motion, an unseen slide starts hidden and
is revealed on arrival). e2e check L7 in `app/e2e/run.mjs` covers the same ground, but it needs a local MongoDB and **has not
been run**. Screenshots: `11-landing.png`, `12-landing-mobile.png`, `17-landing-problem.png` to `21-landing-today-dark.png`.
