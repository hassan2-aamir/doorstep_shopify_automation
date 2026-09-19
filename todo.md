# Doorstep build tracker

Tracks [plan.md](plan.md). Updated as work lands.

Legend: ✅ done · 🔄 in progress · ⬜ not started · 👤 needs a human (browser, account, approval, recording) · ⛔ blocked

> **DECISION TAKEN 14:58 (Shopify fulfillment write-back):** the PRD fallback. Three attempts (entries 05, 07, 08) left the connection on OAuth with 9 scopes and a 403 on fulfillment orders, and the plan's 30-minute A4 decision gate expired at entry 08. Flow B therefore emails the buyer and sets the sheet status, with **no Shopify write-back**. It is built behind a config boolean `shopifyWriteBack` (default false), so entering the custom-app token under the API Key method later flips it on with no code change. Kickoff rewritten as **P2-R** in evidence/prompts.md.
>
> **Track A unblocked (12:35):** the project `.mcp.json` server (`mcp__fastn__*`) is authenticated and
> P0 passed in the VS Code session. Continue with P1 onward from [evidence/prompts.md](evidence/prompts.md).

## Step 0. Prerequisites

| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 0.1 | `evidence/` folder (prompts log, ids, screenshots, report) | B | ✅ | Prompts P0–P6 staged; ids, test-results, report templates |
| 0.2 | Google Sheet "Doorstep Fulfillment" / tab `Fulfillment` with 12 headers | B | ✅ | Sheet `16AtFOhw…6liQI`: 12 headers verified exact and in order, 0 data rows. Tab name confirmed `Fulfillment` by user; sharing tightened off "anyone with link". Saved to the app (Open in sheet) |
| 0.3 | Shopify dev store with test products + test payment | A | ✅ | Ready per team |
| 0.4 | Fastn Billing upgrade confirmed + one customer created, UUID noted | A | ✅ | Customer `0b55acb5-45f5-4ff1-9ba9-6fa3070becb2`; API key confirmed limited to this customer; app re-seeded; real embed token minted and the Fastn widget renders in Connections ([screenshot](evidence/screenshots/app/10-connections-real-widget.png)); list is empty until A creates the "Shopify Orders" widget. Billing: free plan, 50 credits (ask mentor about the upgrade) |
| 0.5 | `gateway` skill, `whoami`, skill version check via MCP | A | ✅ | P0 logged as entry 01. Org `personal_c22c5878e2b772232955`, owner, env `test`. Skills current: gateway v12, integration_builder v21, workflow_verifier v6, connector_builder v2, unified_api v2. 📸 still to capture |
| 0.6 | Shopify, Sheets, email connections ACTIVE via `get_connect_url` | A | ✅ | All three proven with real read-only calls (entry 05): Sheets tab `Fulfillment` + 12 headers read back; Mailjet valid, sender Active; Shopify readable. **But Shopify lacks the fulfillment-order scopes (403), so Flow B cannot create a Shopify fulfillment. Decision needed, see banner** |
| 0.7 | MongoDB with validators + indexes | B | ✅ | **Now Atlas** (`smartride.ik9q5`), re-seeded customer `6aae627970768d336523f41a`. Was local db `doorstep`; `npm run init-db` (validators + 6 indexes); demo customer seeded with a **placeholder** UUID, so re-seed with the real one |
| 0.8 | Public tunnel + `CALLBACK_SECRET` | B | ⛔ | Secret generated in `app/server/.env`; `npm run tunnel` ready (ngrok configured). Start it when A reaches A4.1, because free ngrok URLs change on every start |

## Track A: Fastn build via MCP

| # | Task | Status | Evidence |
|---|---|---|---|
| A1 | Kickoff prompt + PLAN answers | ✅ | Ran as P2-R (rewritten to bake in entries 05–08). Probes: 163 Shopify fields, 12 sheet columns |
| A2 | MAP: `propose_configuration` → approve → `configId` | ✅ | **`cfg_910772de96ce`** approved (draft `cdr_5aa939576171`). 📸 still to capture |
| A3 | GATE: `submit_test_cases` → approve (15–25, covers T1–T9) | ✅ | **25 cases approved unedited** (`tcr_0cb01316d8f7`). 📸 still to capture |
| A4 | BUILD: envConfig/secret, Flow A, Flow B, MULTI_TENANT, triggers, widget, alerts | ✅* | **Flow A `wf_9406750cbc34`** (v3) and **Flow B `wf_a51624da9db1`** (v1) both published, both MULTI_TENANT. Both triggers bound. Widget **`wgt_d1f67a4d76b3`** carries both flows, both triggers, config linked. *⛔ `appBaseUrl` + `callbackSecret` still unprovisioned; Fastn's own Activity alerts not configured |
| A5 | Live test T1–T5 + deliberate failure debug loop T6–T7 | ✅* | **T2, T4, T5 ✅; T1, T3, T6, T7 partial.** *Three* real defects found and fixed live: boolean-vs-string conditions, `USER_ENTERED` writing `#ERROR!` into phone numbers, and Flow A erasing supplier data (entries 10, 11) |
| A6 | VERIFY: workflow_verifier report saved | ✅ | [evidence/verification-report.md](evidence/verification-report.md) — verdict, parity audit, T1–T9, the three defects, and a blocker checklist |

## Track B: host app

| # | Task | Status | Notes |
|---|---|---|---|
| B1 | Scaffold `app/server` + `app/web`, tokens wired, embed-starter ported | ✅ | Vite + React 18 + Tailwind 3 on `design/tailwind-theme.cjs`; token minting ported to `app/server/src/fastn.js`; React Router 7.18 (avoids the v6 open-redirect advisory) |
| B2 | Backend: 5 Tier 1 endpoints + loadCustomer + seed + validators | ✅ | Receiver (7 steps), feed, workspace, fastn-token, health, plus Tier 2 orders API |
| B2t | Backend tests: receiver steps, duplicate, tenant isolation, derived views | ⚠️ | Was 26/26 against a **local** MongoDB. Against **Atlas** the suite fails: a parent hook fails and all 24 child tests report `cancelledByParent`. `initCollections` alone succeeds against Atlas, so it is not permissions — root cause not yet isolated (latency on the shared `before` hook is the leading suspect) |
| B3 | Design pass with `/ui-ux-pro-max:ui-ux-pro-max` | ✅ | [evidence/design-pass.md](evidence/design-pass.md): 12 verified matches + 1 labelled fallback |
| B4.1 | AppShell + StatusPill (rail / tab bar) | ✅ | Rail from 768 px, bottom tabs below, pill priority, issue badge, skip link |
| B4.2 | Sync health (+ empty / error / paused, deep link, Fix) | ✅ | Expandable rows, Fix by errorKind, stacked at 360 px |
| B4.3 | Connections (widget iframe, token refresh, focus, returnTo toast) | ✅ | Error state with Retry; `returnTo` allow-listed |
| B4.4 | Today (verdict, banner, stats, last 5, checklist + Confirm) | ✅ | |
| B4.5 | Polling (5 s / 15 s, pause when hidden, paused banner) | ✅ | Backs off on errors, keeps last data |
| B5 | Wire to Track A (tunnel URL + secret handed over) | 👤 | See 0.8, then prompt P3 |
| B6 | Tier 2: Orders + drawer | ✅ | Stage filter, timeline drawer, focus trap, Escape returns focus |
| B7 | Demo-events script (UI walkthrough without Fastn) | ✅ | `npm run demo-events -- --scenario happy` (also `failure`, `recover`, `reset`) |

## Verification

| Check | Status | Result |
|---|---|---|
| T1–T9 (live Fastn) | 🔄 | **T2, T4, T5 ✅.** T1, T3, T6, T7, T8, T9 partial — see [evidence/test-results.md](evidence/test-results.md) |
| Verification report | ✅ | [evidence/verification-report.md](evidence/verification-report.md) |
| N1 pill + banner on failed event | ✅ | [evidence/nav-test-results.md](evidence/nav-test-results.md) |
| N2 cold `?event=` deep link expanded | ✅ | Also works for the first retry attempt |
| N3 Fix → Connections focus → returnTo toast | ✅ | |
| N4 later success closes issue | ✅ | No reload needed |
| N5 duplicate callback stored once | ✅ | 201 then 200 `{duplicate:true}` |
| N6 360 px + keyboard | ✅ | No horizontal scroll on 4 routes; tabs ≥ 44 px; keyboard reaches Fix |
| N7 embed token expiry reloads widget | ✅* | *Simulated with a mock Fastn endpoint; the real widget's message is still unverified |
| Contrast audit exit 0 | ✅ | 84 checks, both themes |
| Tenant isolation (unknown customer → 404) | ✅ | API tests, incl. operator-injection attempts |

## Submission

| Item | Status | Notes |
|---|---|---|
| README.md | ✅ | Setup, env, contract, tests, limits |
| Submission document draft | 🔄 | [SUBMISSION.md](SUBMISSION.md): fill every ⟦TODO⟧ from Track A |
| App screenshots | ✅ | 9 in [evidence/screenshots/app/](evidence/screenshots/app/) |
| MCP evidence screenshots | 👤 | During Track A, per the 📸 markers |
| Demo video (2 min, Drive, logged-out check) | 👤 | Script in plan.md |
| Workflow links + repo link | 🔄 | Workflow ids in [evidence/ids.md](evidence/ids.md); repo link still needed (this folder is not a git repo) |
| Feedback form, both members | 👤 | |

## Next actions for the team

1. **Person A:** open a Claude session with the claude.ai **Fastn** connector connected. Run prompts
   P0 → P6 from [evidence/prompts.md](evidence/prompts.md), logging each one verbatim.
2. **Person A:** create the Fastn customer, then point the host app at its real UUID:
   in `app/server`, run `npm run demo-events -- --scenario reset`, then
   `npm run seed -- --fastn <uuid> --shop <store>.myshopify.com --sheet <sheet-url>`.
3. **Person B:** create the Google Sheet per [sheet/README.md](sheet/README.md). In `app/server` run
   `npm start` and `npm run tunnel`, then hand A the tunnel URL and `CALLBACK_SECRET` for prompt P3.
4. **Both:** run T1–T9 live, fill [evidence/test-results.md](evidence/test-results.md) and
   [SUBMISSION.md](SUBMISSION.md), record the video, submit before 3:30 PM.

## State at 16:10

**Both flows live and proven.** A paid order becomes one sheet row; a tracking number produces exactly one
buyer email and flips the row to Notified. Replays duplicate nothing; the buyer is never emailed twice.

| | |
|---|---|
| Config | `cfg_910772de96ce`, approved, linked to the widget |
| Flow A | `wf_9406750cbc34` published v3, MULTI_TENANT |
| Flow B | `wf_a51624da9db1` published v1, MULTI_TENANT |
| Triggers | `orders/paid` app event + `*/5 * * * *` schedule, both bound |
| Widget | `wgt_d1f67a4d76b3` "Shopify Orders", both flows, both triggers, config linked |
| Green | T2, T4, T5 |
| Partial | T1, T3, T6, T7, T8, T9 |

**Three real defects found and fixed live** (all caught by asserting the returned value, never a status code):
boolean-vs-string conditions silently filtering out every order; `USER_ENTERED` storing `#ERROR!` for any
phone starting with `+`; and Flow A overwriting the supplier's buyer columns with blanks.

**Still open, in priority order:**

1. **Provision `appBaseUrl` + `callbackSecret`** in the Fastn dashboard (Configurations tab, env `test`).
   Nothing reaches the host app until then, so Sync health stays empty. The secret is in `app/server/.env`.
2. **Fire the `orders/paid` app event.** The schedule half of T9 is green (the cron fired unattended and
   completed); the app-event half needs a real order. Standard-tier runs queue for ~2 min before executing
   — not a defect, but `instant` tier would make the demo feel live.
3. **A real checkout order.** The store's only order is a draft with no customer, so the buyer-field
   mappings are written but unverified. This is what turns T1 and T3 green.
4. **The API test suite** still fails against Atlas (parent hook fails, 24 children cancelled).
5. **Screenshots** — every 📸 marker in [evidence/prompts.md](evidence/prompts.md) is still unfilled.
