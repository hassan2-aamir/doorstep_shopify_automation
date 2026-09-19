# Doorstep build tracker

Tracks [plan.md](plan.md). Updated as work lands.

Legend: ✅ done · 🔄 in progress · ⬜ not started · 👤 needs a human (browser, account, approval, recording) · ⛔ blocked

> **DECISION TAKEN 14:58 (Shopify fulfillment write-back):** the PRD fallback. Three attempts (entries 05, 07, 08) left the connection on OAuth with 9 scopes and a 403 on fulfillment orders, and the plan's 30-minute A4 decision gate expired at entry 08. Flow B therefore emails the buyer and sets the sheet status, with **no Shopify write-back**. It is built behind a config boolean `shopifyWriteBack` (default false), so entering the custom-app token under the API Key method later flips it on with no code change. Kickoff rewritten as **P2-R** in evidence/prompts.md.
>
> **STATUS 17:55, read back from the live platform (evidence entry 13).** Both flows are live: the cron has fired
> unattended every 5 min since 16:00 with 0 failures, `orders/paid` has fired for real 3 times (subscription
> `ACTIVE`), and callbacks reach the host app deployed on AWS Elastic Beanstalk. **Deadline moved: submission is now due Sun 20 Sep, 18:00 PKT** (extended by
> the organisers, so the earlier 3:30/4:30 PM worry is void). See **Phase 2** below. Open: payment-to-row latency
> measured 162–343 s against a PRD target of 60 s; both regression suites are stale; three live "no buyer email"
> issues; buyer-data mappings unverified. See **State at 17:55** at the bottom.

## Step 0. Prerequisites

| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 0.1 | `evidence/` folder (prompts log, ids, screenshots, report) | B | ✅ | Prompts P0–P6 staged; ids, test-results, report templates |
| 0.2 | Google Sheet "Doorstep Fulfillment" / tab `Fulfillment` with 12 headers | B | ✅ | Sheet `16AtFOhw…6liQI`: 12 headers verified exact and in order, 0 data rows. Tab name confirmed `Fulfillment` by user; sharing tightened off "anyone with link". Saved to the app (Open in sheet) |
| 0.3 | Shopify dev store with test products + test payment | A | ✅ | Ready per team |
| 0.4 | Fastn Billing upgrade confirmed + one customer created, UUID noted | A | ✅ | Customer `0b55acb5-45f5-4ff1-9ba9-6fa3070becb2`; API key confirmed limited to this customer; app re-seeded; real embed token minted and the Fastn widget renders in Connections ([screenshot](evidence/screenshots/app/10-connections-real-widget.png)); list is empty until A creates the "Shopify Orders" widget. Billing: free plan, 50 credits (ask mentor about the upgrade) |
| 0.5 | `gateway` skill, `whoami`, skill version check via MCP | A | ✅ | P0 logged as entry 01. Org `personal_c22c5878e2b772232955`, owner, env `test`. Skills current: gateway v12, integration_builder v21, workflow_verifier v6, connector_builder v2, unified_api v2. 📸 still to capture |
| 0.6 | Shopify, Sheets, email connections ACTIVE via `get_connect_url` | A | ✅ | All three proven with real read-only calls (entry 05): Sheets tab `Fulfillment` + 12 headers read back; Mailjet valid, sender Active; Shopify readable. **But Shopify lacks the fulfillment-order scopes (403), so Flow B cannot create a Shopify fulfillment. Decision taken 14:58: the PRD fallback (see the first banner)** |
| 0.7 | MongoDB with validators + indexes | B | ✅ | **Now Atlas** (`smartride.ik9q5`), re-seeded customer `6aae627970768d336523f41a`. Was local db `doorstep`; `npm run init-db` (validators + 6 indexes); demo customer seeded with a **placeholder** UUID, so re-seed with the real one |
| 0.8 | Public tunnel + `CALLBACK_SECRET` | B | ✅ | **Superseded by a real deployment**: the host app runs on AWS Elastic Beanstalk (`http://doorstep-prod.eba-bf4y27m3.us-east-1.elasticbeanstalk.com`, plain HTTP). Fastn env config `appBaseUrl` (env `test`) and org secret `CALLBACK_SECRET` are set; callbacks verified arriving. No tunnel needed |

## Track A: Fastn build via MCP

| # | Task | Status | Evidence |
|---|---|---|---|
| A1 | Kickoff prompt + PLAN answers | ✅ | Ran as P2-R (rewritten to bake in entries 05–08). Probes: 163 Shopify fields, 12 sheet columns |
| A2 | MAP: `propose_configuration` → approve → `configId` | ✅ | **`cfg_910772de96ce`** approved (draft `cdr_5aa939576171`). 📸 still to capture |
| A3 | GATE: `submit_test_cases` → approve (15–25, covers T1–T9) | ✅ | **25 cases approved unedited** (`tcr_0cb01316d8f7`). 📸 still to capture |
| A4 | BUILD: envConfig/secret, Flow A, Flow B, MULTI_TENANT, triggers, widget, alerts | ✅* | **Flow A `wf_9406750cbc34`** (v3) and **Flow B `wf_a51624da9db1`** (v1) both published, both MULTI_TENANT. Both triggers bound. Widget **`wgt_d1f67a4d76b3`** carries both flows, both triggers, config linked. `appBaseUrl`, `CALLBACK_SECRET` and `defaultCustomerId` provisioned 16:23–16:26 (entry 12, reconstructed). Flow A is now dev version 6, Flow B dev version 4. *Fastn's own Activity alerts still not verified as configured |
| A5 | Live test T1–T5 + deliberate failure debug loop T6–T7 | ✅* | **T2, T4, T5, T9 ✅; T1, T3, T6, T7, T8 partial.** *Three* real defects found and fixed live: boolean-vs-string conditions, `USER_ENTERED` writing `#ERROR!` into phone numbers, and Flow A erasing supplier data (entries 10, 11) |
| A6 | VERIFY: workflow_verifier report saved | ✅ | [evidence/verification-report.md](evidence/verification-report.md) — verdict, parity audit, T1–T9, the three defects, and a blocker checklist |

## Track B: host app

| # | Task | Status | Notes |
|---|---|---|---|
| B1 | Scaffold `app/server` + `app/web`, tokens wired, embed-starter ported | ✅ | Vite + React 18 + Tailwind 3 on `design/tailwind-theme.cjs`; token minting ported to `app/server/src/fastn.js`; React Router 7.18 (avoids the v6 open-redirect advisory) |
| B2 | Backend: 5 Tier 1 endpoints + loadCustomer + seed + validators | ✅ | Receiver (7 steps), feed, workspace, fastn-token, health, plus Tier 2 orders API |
| B2t | Backend tests: receiver steps, duplicate, tenant isolation, derived views | ⚠️ | **Re-confirmed 26/26 against a local MongoDB at 17:58 on current main (includes the COOP change), so the code is fine.** Against **Atlas** a parent hook fails and all 24 child tests report `cancelledByParent`. **New hypothesis (untested, needs the Atlas URI):** the tests create their own database `doorstep_test_<pid>`, and `initCollections` was only ever checked against `doorstep`; an Atlas user scoped to one database would pass the second and fail the first. Check by running `npm test` with the hook error visible |
| B3 | Design pass with `/ui-ux-pro-max:ui-ux-pro-max` | ✅ | [evidence/design-pass.md](evidence/design-pass.md): 12 verified matches + 1 labelled fallback |
| B4.1 | AppShell + StatusPill (rail / tab bar) | ✅ | Rail from 768 px, bottom tabs below, pill priority, issue badge, skip link |
| B4.2 | Sync health (+ empty / error / paused, deep link, Fix) | ✅ | Expandable rows, Fix by errorKind, stacked at 360 px |
| B4.3 | Connections (widget iframe, token refresh, focus, returnTo toast) | ✅ | Error state with Retry; `returnTo` allow-listed |
| B4.4 | Today (verdict, banner, stats, last 5, checklist + Confirm) | ✅ | |
| B4.5 | Polling (5 s / 15 s, pause when hidden, paused banner) | ✅ | Backs off on errors, keeps last data |
| B5 | Wire to Track A (tunnel URL + secret handed over) | ✅ | Wired through the Elastic Beanstalk deployment instead of a tunnel. Proven: Flow A's #1004 run reported `success` to `/api/sync-events` and it shows in Sync health |
| B6 | Tier 2: Orders + drawer | ✅ | Stage filter, timeline drawer, focus trap, Escape returns focus |
| B7 | Demo-events script (UI walkthrough without Fastn) | ✅ | `npm run demo-events -- --scenario happy` (also `failure`, `recover`, `reset`) |

## Verification

| Check | Status | Result |
|---|---|---|
| T1–T9 (live Fastn) | 🔄 | **T2, T4, T5, T9 ✅** (T9 fully proven 17:50: both triggers fired for real). T1, T3, T6, T7, T8 partial. **PRD latency target (60 s) NOT met: 162–343 s measured.** See [evidence/test-results.md](evidence/test-results.md) |
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
| Submission document draft | 🔄 | [SUBMISSION.md](SUBMISSION.md): sections 3–6 corrected 17:55 to match the live platform. Human-only ⟦TODO⟧s remain (team names, video link, workflow links) |
| App screenshots | ✅ | 9 in [evidence/screenshots/app/](evidence/screenshots/app/) |
| MCP evidence screenshots | 👤 | During Track A, per the 📸 markers |
| Demo video (2 min, Drive, logged-out check) | 👤 | Script in plan.md |
| Workflow links + repo link | 🔄 | Workflow ids in [evidence/ids.md](evidence/ids.md); repo: https://github.com/hassan2-aamir/doorstep_shopify_automation. Fastn workflow links still to paste from the dashboard |
| Feedback form, both members | 👤 | |

## Phase 2: extended deadline, Sun 20 Sep 18:00 PKT

Scope from the team: deployment scripts for AWS, then the demo, the document, a landing page and an onboarding
flow, then submit. Status as of Sat 19 Sep evening.

| # | Item | Status | Notes |
|---|---|---|---|
| P2.1 | AWS deployment scripts, [deploy/](deploy/) | ✅ | bundle, deploy, rollback, smoke (9 checks), set-env, provision, teardown; zero dependencies; 7 unit tests pass. Run for real against the live account: `--list`, `--dry-run`, `provision --dry-run`, `smoke` (9/9 on the live URL). Bundle passes `unzip -t`. **Not yet run:** the upload/deploy path and `provision` past its dry run (the first real `deploy.mjs` is their test) |
| P2.2 | Landing page `/welcome` | ✅ | Minimal and Direct plus a demo panel built from the real components; no invented numbers; e2e L1, L6 |
| P2.3 | Onboarding `/setup` (Store, Sheet, Confirm) and the `/` resolver | ✅ | URL-driven steps, inline validation, skippable, Back, live workspace = read-only walkthrough; e2e L2 to L5. **Tier 3 "Welcome and Setup" is no longer cut** (Rules tab still is) |
| P2.4 | Demo package, [demo/script.md](demo/script.md) and `demo/preflight.mjs` | ✅ script | 6 scenes, 166-word voice-over, reset and recovery notes. Preflight ran against the live app: smoke 9/9, but flags 3 open issues and status `live` (expected before a take) |
| P2.5 | Commit and push this work | ⬜ | Needs your go; 7 doc files plus the new code are uncommitted |
| P2.6 | Deploy the new build to AWS (`node deploy/deploy.mjs`) | ⬜ | Needs your go, and a commit first so the label is not `-dirty`. The live app already has the COOP fix (smoke check passes) |
| P2.7 | Move both flows to `instant` tier, re-run and re-save both suites | ✅ | Done 19 Sep about 19:40 PKT (evidence entry 14). Both flows `instant`, timeout 30 s, code untouched. Both suites re-run and saved (`partial`, `stale` cleared). **Latency proven on real orders: paid to row 6.2 s, 7.5 s, 7.6 s** (was 162 to 343 s); schedule ticks start in 25 ms (was 73 to 135 s). See evidence entry 16 |
| P2.8 | A real order to measure order-to-row latency | ✅ | Done by you: orders #1005, #1006, #1007 give 6.2 to 7.6 s. Still open: an order **with a customer attached and a real street address**, to see the full buyer row (name, email, phone, address) created in one go |
| P2.9 | Record, edit, upload the demo; test the link logged out | 👤 | Then set `VITE_DEMO_VIDEO_URL`, rebuild, redeploy so the landing page links it |
| P2.10 | Real-widget screenshots for the submission (all 📸 markers) | 👤 | The e2e screenshots use a mock widget |
| P2.11 | Final pass on SUBMISSION.md, team names, Fastn workflow links, both feedback forms, submit | 👤 | |

| P2.12 | **Email does not reach the inbox: sender domain is not authenticated** | ⛔ | Found 19 Sep ~19:20 PKT (evidence entry 15). Mailjet accepted all 8 messages (`sent`), but the sender is `haamir.bscs23seecs@seecs.edu.pk` and Mailjet reports **SPF: Error and DKIM: Error** for that domain. The domain publishes SPF `include:_spf.google.com -all`, DMARC `p=quarantine; pct=50`, no Mailjet DKIM key, and its mail is on Google Workspace, so messages are very likely filed as spam or quarantined (not proven: the mailbox is not visible from here). **Check Spam and the Workspace quarantine for "Doorstep" and "has shipped".** Real fixes: (a) a sender on a domain we can authenticate; (b) SEECS IT adds the DNS records; (c) send through the Outlook Mail connector from a personal Microsoft account. Needs a decision before the recording |

| P2.13 | Public URL is CloudFront; root shows the landing page | ✅ | 20 Sep ~02:25 PKT. CloudFront `E4LG4BHFVAD43` (HTTPS, CachingDisabled) fronts EB, so a deploy reaches it with no invalidation. `/` now renders the landing page instead of redirecting a live workspace to `/today` (that redirect was the "old website"). Deployed as `doorstep-3f0ac69-dirty-202609192122`; checked in a real browser through CloudFront: landing h1, new bundle `index-DobfS700.js`, dashboard loads, `/api` proxied, 0 failed requests. e2e 18/18. Public URL: https://d3nkcj9r1qd361.cloudfront.net/ |
| P2.14 | **Set Fastn `appBaseUrl` to the CloudFront HTTPS URL** | ⬜ | Needs a decision: it is still the plain-HTTP origin, which a browser cannot open, so the alert email's **Fix it** link is dead in demo scene 5. It also sends the callback secret over HTTPS instead of HTTP. It is a shared env-config change, so both suites must be re-run afterwards (about 15 minutes) |

| P2.15 | Latest activity: newest run first, then larger order number first | ✅ | 20 Sep ~03:00 PKT, reported by you. Events from one flow run share the run's timestamp, so ties fell to insertion order and Flow A (which lists newest-first) put the oldest order on top. Ties now break by numeric order number, descending, in the query itself so the 5-item cut keeps the newest orders. Applies to Today, Sync health, open issues and the Orders list. New API test (fails on the old query, passes on the new; 27/27), e2e 18/18, deployed as `doorstep-3f0ac69-dirty-202609192159`, live feed checked: run 21:58:16 lists #1008 down to #1001 |
| P2.16 | e2e suite can no longer run against a remote database | ✅ | `app/server/.env` now points at Atlas. The e2e suite wipes events, so it now uses local MongoDB (or `E2E_MONGODB_URI`) and refuses a non-local URI without `E2E_ALLOW_REMOTE=1`. The first attempt after the `.env` change failed on DNS before connecting, so nothing was touched |

**Suggested timeline (PKT).** Sat evening: P2.5 to P2.8. Sun 09:00 to 12:00: record (P2.9), screenshots (P2.10).
**Freeze at 12:00.** Sun 12:00 to 16:00: edit, upload, final document pass. **Submit by 16:00**, two hours
early, then only fix what is broken.

## State at 17:55

**Verified live, read-only (evidence entry 13).** Nothing was written to Fastn, the sheet, Shopify or the app.

| | |
|---|---|
| Flow A | `wf_9406750cbc34` dev version 6, `orders/paid` subscription **ACTIVE**, fired for real on #1002, #1003, #1004 (all completed 200, `created=1`) |
| Flow B | `wf_a51624da9db1` dev version 4, cron **ACTIVE**, 22 unattended runs 16:00 to 17:45, 0 consecutive failures |
| Host app | Elastic Beanstalk, `/api/health` 200, `status: live`. 24 h counts: synced 1, skipped 49 (rising), failed 3 |
| Sheet | 4 data rows: #1001 Notified (the demo record); #1002 to #1004 New, tracking typed, no buyer name/email/phone |
| Live issues | 3 open in Sync health, all the designed `data` failure (`send_buyer_email`, no buyer email) |
| Green | T2, T4, T5, T9 |
| Partial | T1, T3, T6, T7, T8 |
| **Not met** | **Payment to row: 162, 181, 343 s (PRD target under 60 s).** Standard-tier queue; each run is only 2 to 5 s |

## Open items, in priority order

1. ~~Confirm the submission status.~~ Superseded: the deadline moved to Sun 20 Sep 18:00 PKT.
2. ~~Move both flows to `executionTier: instant`.~~ Done (P2.7). Order-path latency still to be measured on a real order.
3. ~~Re-run and re-save both validation suites.~~ Done (P2.7); the skipped cases carry their reasons and are still owed.
4. ~~Buyer data is withheld by Shopify.~~ **Resolved 20 Sep about 03:00 PKT (evidence entry 16).** The Shopify connection was replaced by an **API Key** connection (a token from the store's own Doorstep app), and the API now returns customer name, email and phone. Proven: a Flow A run on order #1007 updated rows #1004 and #1005 with Shopify's exact values. Two limits remain: an order with **no customer attached** (#1001 to #1003, #1006, #1007) still has nothing to read, and the sample orders' **street address fields are empty** in Shopify, so the address cell is not yet proven. The token may expire (a client-credentials token lasts about 24 h): if Shopify calls start failing on Monday, re-issue it.
5. **Close or explain the 3 live issues.** Typing an email into column E of rows 3 to 5 makes the next Flow B run
   email that address and flip the rows to Notified (a live recovery demo, T7). It sends real mail, so use
   your own address.
6. **Flow A event path.** Use the webhook payload in `ctx.input` instead of re-scanning the 10 most recent orders.
7. **Flow B noise.** Report `create_fulfillment` skipped once per order, not on every run (23 of the latest 50
   events today).
8. **API tests vs Atlas.** See the B2t hypothesis above.
9. **Screenshots.** Every 📸 marker in [evidence/prompts.md](evidence/prompts.md) is still unfilled, including entry 13's.
10. **Human-only:** demo video and Drive link (logged-out check), team names, Fastn workflow links, both feedback forms.
11. **Hardening (post-demo):** TLS on the deployment, and sign-in instead of the demo-customer fallback.
