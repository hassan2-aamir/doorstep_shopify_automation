# Doorstep: step-by-step implementation plan


## Context

Doorstep is our Track 02 entry for Build with Fastn (SEECS NUST, 19 Sep 2026). A small Shopify merchant's paid orders go into a Fulfillment Google Sheet. When the supplier adds tracking, it goes back to Shopify and to the buyer, and every failure shows up in a small control-tower app. The PRD, TRD, App flow and Backend schema in `docs/` are final, and the design system in `design/` is done and contrast-audited. No application code exists yet.

The build has to do three things:
1. Move real data end to end through Fastn.
2. Leave proof that the build was driven through **Fastn MCP**. That's a 20-point rubric line and the second tiebreaker, so every prompt, approval gate and debug loop is captured in `evidence/`.
3. Be submitted before the form locks. Treat that as **3:30 PM** until a mentor confirms 4:30.

**Team:** two people working in parallel.
- **Track A (Fastn driver):** runs Claude with the Fastn MCP connector and the `integration_builder` skill.
- **Track B (App builder):** builds the React/Express/MongoDB host app using the design system, with `/ui-ux-pro-max:ui-ux-pro-max` as the designer.

**Ready:** Shopify dev store. **Not ready:** the Google test sheet, the email connector, and Fastn connections (the org shows 0).

## Facts the plan depends on

- Fastn MCP runs through the **claude.ai "Fastn" connector** (`mcp__claude_ai_Fastn__*`), not a plugin. Call `skill {"slug":"gateway"}` first in each session. Local skills: gateway v12, integration_builder v21, connector_builder v2, workflow_verifier v6.
- The org is `personal_…955`: **free plan, `test` env, 0 connections**. Check Billing shows the hackathon upgrade. Ask a mentor whether a team org is expected.
- **One build path only.** Use the gateway, never the dashboard Platform Agent on the same use case, because `create_workflow` overwrites workflows by slug.
- **The callback contract comes from the Backend schema doc, not the older kickoff prompt:** `{customerId, eventId, orderId, orderNumber, workflow, outcome, step, errorKind, error, runAt}`. Step names are the closed set `read_order … send_alert`.
- The callback URL must be publicly reachable from Fastn's runners, so Track B needs a tunnel (cloudflared or ngrok) early.

## Evidence system (set up first, fed continuously)

```
evidence/
  prompts.md        # time-stamped log of every prompt, MCP tool call, gate and result
  screenshots/      # NN-short-name.png, numbered in capture order
  verification-report.md   # pasted verbatim from workflow_verifier
  ids.md            # configId, workflow ids/slugs, trigger ids, widget id, customer id, exec ids
```

Each `prompts.md` entry records the time, who, the prompt text (verbatim), the MCP tools invoked, the result and the screenshot number. **Must-capture shots (📸)** are marked in the steps below. Together they're the "Use of the Fastn MCP tool" evidence.

---

## Step 0. Prerequisites (both people, target 30 min)

| # | Task | Owner | Done when |
|---|---|---|---|
| 0.1 | Create `evidence/` with the structure above and commit it | B | Folder exists |
| 0.2 | Create the Google Sheet "Doorstep Fulfillment", tab `Fulfillment`, with the 12 exact headers from the Backend schema doc (`order_id … notified_at`). Colour the supplier columns (`tracking_number`, `carrier`), add a status dropdown `New`/`Notified` and a carrier dropdown | B | Sheet URL noted in `ids.md` |
| 0.3 | Shopify dev store: confirm test products exist and a test payment method works | A | One paid test order can be placed |
| 0.4 | Fastn: open Billing and confirm the upgrade; open Settings → Customers and **create one customer** (the end-org the flows run as). Note its UUID | A | Customer UUID in `ids.md` 📸 |
| 0.5 | In Claude (VS Code): call `skill {"slug":"gateway"}`, `whoami`, then `skill {"slugs":["integration_builder","workflow_verifier","connector_builder"]}` to check versions | A | Logged in `prompts.md` 📸 |
| 0.6 | Connections via MCP: `list_connectors` for Shopify, Google Sheets and Gmail/SendGrid, then `get_connect_url` for each, connect in the browser, then `list_connections` shows all three ACTIVE | A | 3 connections ACTIVE 📸 |
| 0.7 | MongoDB Atlas free cluster (or local), connection string in the server `.env`; run the validator/index script from the Backend schema doc | B | `db.customers` and `db.syncEvents` exist with validators |
| 0.8 | Start the tunnel to the future Express port and send the public URL to A. Generate `CALLBACK_SECRET` | B | URL + secret shared |

**Fallback:** if a connection won't go ACTIVE within 15 min, A carries on in `mockMode` (the skill allows this after the blocker is surfaced), and the live probe waits.

---

## Track A: Fastn build via MCP (Claude + integration_builder)

### A1. Kickoff and PLAN (~30 min)

Paste this kickoff prompt. It's the playbook's version with the callback contract corrected. Log it verbatim.

> Use the fastn integration_builder skill. Build "Doorstep" for my customers (multi-tenant, they connect their own accounts).
> Entities: Shopify Orders and the Google Sheet tab "Fulfillment". Flow 1 `orders-to-fulfillment`: when a paid, non-test Shopify order arrives, upsert one sheet row keyed on order id, idempotent (replays and edits must not duplicate). Flow 2 `tracking-to-shopify-and-buyer` (every 5 minutes): rows with a tracking number and status not Notified get a Shopify fulfillment with that tracking number and carrier, one buyer email, then status Notified and notified_at; never email twice.
> Ongoing only, no backfill. One config for the whole use case, one widget named "Shopify Orders". Sheet columns: order_id, order_number, created_at, buyer_name, buyer_email, buyer_phone, ship_address, items, status, tracking_number, carrier, notified_at.
> Every flow returns {created, updated, skipped, errors, errorDetails}, uses a retry policy of 3 attempts with exponential backoff, and for each record reports {customerId, eventId, orderId, orderNumber, workflow, outcome, step, errorKind, error, runAt} to `${appBaseUrl}/api/sync-events` (appBaseUrl from fastn.envConfig) with header x-callback-secret from fastn.secrets callbackSecret. A failed callback must not fail the run. step is one of read_order, apply_conditions, dedupe_check, upsert_row, read_rows, create_fulfillment, send_buyer_email, update_status, send_alert. errorKind is connection for auth/expired-token errors, data for a missing buyer email or address, other otherwise. On a failure, email the merchant (alertEmail from config) once per failing record, guarded by state key alert:{customerId}:{orderId}:{workflow}, with a "Fix it" link to `${appBaseUrl}/sync-health?event=<eventId>`.
> Keep the test-case set in the small band (about 15 to 25). Check list_unified_categories for an ecommerce entity first. If a Shopify order event or fulfillment action is missing, tell me before building around it. Finish with the verification report.

**PLAN answers:** Orders → Fulfillment rows; tracking back to Shopify and the buyer. Ongoing only. Scope: paid, not test. **Tenancy: my customers (multi-tenant, Path B).** Cadence: every 5 min. Matching key: order id. Missing phone: sync anyway. Missing buyer email: write the row, and Flow B fails it as `data`.

📸 The PLAN summary and the AskUserQuestion answers. 📸 The result of `get_connector_events` (does Shopify expose an order event? This settles the trigger type and an open question).

### A2. MAP: config approval (~20 min)

- The agent probes fields and calls `propose_configuration` → `reviewUrl`.
- In the browser, check the mappings and conditions (`financial_status in [paid]`, exclude test orders). Add `alertEmail`, the sheet tab and the status names as config values. Approve.
- The agent polls `check_config_status` → **`configId`**.
- 📸 The mapping review page before and after approval, and the `configId`. Log the id in `ids.md`.

### A3. GATE: test cases (~15 min)

- The agent calls `submit_test_cases` → `reviewUrl`. Check that the set covers T1–T9 from the PRD (T1 one row, T2 replay skipped, T3 edit updates, T4 fulfillment + 1 email, T5 no second email, T6 break the sheet → failure + alert, T7 reconnect → no duplicate, T8 config rule change, T9 each trigger fires). Keep it to the 15–25 band. Approve.
- 📸 The test-case review page and the approved count.

### A4. BUILD: flows, scope, triggers, widget (~60 min)

1. Env config and secret: `appBaseUrl` = the tunnel URL, `callbackSecret` = the secret from B. Neither is ever written into code.
2. Flow A `orders-to-fulfillment` (event): `run_code` probes → `create_workflow` → `test_workflow` → `publish_workflow`.
3. Flow B `tracking-to-shopify-and-buyer` (schedule): same sequence.
4. `set_connector_scope` MULTI_TENANT for Shopify and Sheets; self-install test with our customer UUID.
5. Triggers: `bind_app_event_trigger` for the Shopify order event, checking `Subscription: Subscribed`. **Fallback order:** retry once, then a webhook with order id as the dedup key and Sequential mode, then a 5-min schedule poll. Then `bind_schedule_trigger` every 5 min for Flow B.
6. `create_widget` "Shopify Orders" with `configId`, both workflows, both triggers, **User-level scope**. Then `get_widget` readback.
7. Turn on Activity → Alerts: failure alerts, "Broken connectors > 0", "No runs in 24h".

📸 `create_workflow` and `test_workflow` results, the trigger `Subscribed` state, the widget builder and the `get_widget` readback, and the alerts config.

**Decision gate:** if the Shopify fulfillment action is missing or blocks for 30 min, take the PRD fallback. Flow B then updates the sheet status and emails the buyer with no Shopify write-back. Log the decision.

### A5. Live test + deliberate debug loop (~30 min, needs B's callback receiver live)

- Place a real paid test order → row in the sheet within 60 s (T1). Replay → skipped (T2). Edit → same row (T3).
- Type a tracking number in the sheet → `trigger_scheduler_now` → Shopify fulfillment + 1 email + Notified (T4, T5).
- **Deliberate failure (T6/T7, also the demo beat):** disconnect the Sheets connection → run Flow B → failure lands in Sync health + alert email → paste the debugging prompt:
  > This run failed: [exec id]. The Error tab says [headline]. Failed at [step]. Diagnose and fix. If it's a connection problem, tell me what the customer has to do.
  Reconnect → replay → no duplicate.
- 📸 The failed execution Error tab, the agent's diagnosis, the fix, and the passing re-run. **This is the single most valuable MCP evidence.**

### A6. VERIFY (~20 min)

- Run the `workflow_verifier` skill: fire every trigger and correlate each to its execution, widget/config readback, config liveness (T8: change the status filter and re-run), and the full suite re-run.
- Save the **verification report** verbatim to `evidence/verification-report.md`. 📸 the report.

---

## Track B: host app (React + Tailwind + Express + MongoDB)

Routes, screens and states: App flow doc. Endpoints and validation: Backend schema doc. Tokens: `design/`. **Tier 1 only** until A's T1–T9 pass.

### B1. Scaffold (~20 min)

```
app/
  server/   Express: index.js, db.js, middleware/loadCustomer.js, routes/{syncEvents,workspace,fastnToken,health}.js, lib/{views.js,sanitize.js,vocab.js}
  web/      Vite React: tailwind.config.js, src/{main.jsx,App.jsx,theme.js,api.js}, src/components/, src/screens/
```

- `web/tailwind.config.js` spreads `design/tailwind-theme.cjs` (`theme: {...overrides, extend}`). Import `design/tokens.css` in `main.jsx`. Load Plus Jakarta Sans. Add the dark-mode `matchMedia` effect from `design/component-specs.md`.
- Port the token-minting and iframe logic from `.claude/skills/fastn-expert/assets/embed-starter/server.js` into Express. Don't rewrite it from scratch.

### B2. Backend (~45 min), all from the Backend schema doc

- `POST /api/sync-events` runs the 7-step receiver in order: constant-time secret check, strict validation plus the failed-event rule, sanitize, customer lookup, `at` window, insert with duplicate → 200, flip to live on the first Flow A success. Add a 100 KB limit and a route rate limit.
- `GET /api/sync-events`: feed + counts, `filter=issues`, `event=`, `limit`, `sinceHours`. Use the `latestPerOrderWorkflow`/`openIssues`/`counts` pipelines copied from the doc.
- `GET/POST /api/workspace`: state, `openIssueCount`, today counts, `confirm_setup`.
- `GET /api/fastn-token` (flips new → connecting) and `GET /api/health`.
- `loadCustomer` middleware: in the demo, a validated `?customer=` ObjectId. `customerId` is never read from the request body.
- Seed one customer with A's Fastn customer UUID, `status: connecting`.
- **Quick test:** curl-post the example callback twice → one document, then 200 `{duplicate:true}` (N5).

### B3. Design pass with the designer skill (~15 min)

- Invoke `/ui-ux-pro-max:ui-ux-pro-max` with the screen specs (Today, Sync health, Connections, shell + status pill) and tell it to **use only the tokens in `design/`** and the rules in `design/component-specs.md` (flat, no shadows, block layout, word + icon + dot status). Save its layout guidance, and 📸 it as design-process evidence.

### B4. Frontend, Tier 1 in the App flow build order (~90 min)

1. **AppShell + StatusPill:** left rail at 768 px and up, bottom tab bar below; pill priority reconnect > issues > setup > all syncing.
2. **Sync health** (hardest first): counts, 50-event table with issues first, `?event=` opens expanded, plain-language reason from `errorKind` + step, Details disclosure, Fix → `/connections?focus=sheet&returnTo=…`. Then its empty, error and paused states.
3. **Connections:** widget iframe from `/api/fastn-token`, reload on `fastn:session-expired`, `focus` highlight, return toast.
4. **Today:** feature-block verdict, banner, 3 stats, last 5 events, setup checklist + Confirm.
5. Polling: 5 s on Sync health, 15 s on Today, paused while the tab is hidden.

### B5. Wire to A (as soon as B2 is live)

Send A the tunnel URL + secret (step A4.1). Watch real callbacks arrive during A5.

### B6. Tier 2 (only if T1–T9 pass before ~2:15)

Orders list + drawer (`/api/orders`, `/api/orders/:orderId`). Tier 3 (Welcome/Setup/Rules) is cut.

---

## Verification (both, ~1:30–2:15)

| Check | How | Pass |
|---|---|---|
| T1–T9 | Real order, replay, edit, tracking, forced retry, sheet disconnect, reconnect, config edit, trigger fires | All pass; results table in `evidence/` |
| Verification report | `workflow_verifier` output | Saved verbatim |
| N1–N7 | App flow doc nav tests: pill → issues, cold `?event=` deep link, Fix → Connections, auto-close on success, duplicate callback, 360 px + keyboard, token expiry | All pass |
| Contrast | `node design/check-contrast.cjs design/tokens.css` | Exit 0 |
| Callback idempotency | Post the same `eventId` twice | 1 doc, counts unchanged |
| Tenant isolation | Query with an unknown `?customer=` | 404, no data |

---

## Submission (by ~3:00, lock 3:30)

1. **Demo video, 2 min** (the App flow demo path): the problem → connect → order arrives → tracking goes out → break the sheet and fix it → a 10 s montage of the MCP build, taken from the evidence screenshots. Use `trigger_scheduler_now` for the Flow B beats and say so in the voiceover. Upload to Drive as anyone-with-link, **test it logged out**, and keep a backup take.
2. **README.md:** what it is, prerequisites, env vars (`MONGODB_URI`, `FASTN_API_KEY`, `FASTN_ORG_ID`, `CALLBACK_SECRET`), setup, how to run the demo, workflow links, known limits.
3. **Submission doc:** problem/persona, solution, architecture, reliability (dedup, retries, failure log, alerts, replay), **how Fastn MCP built each part** (linking `evidence/prompts.md` and the screenshots, plus what we corrected by hand), limitations, team and links. Paste the verification report.
4. **3+ screenshots:** sheet row, Shopify fulfillment, buyer email, Sync health failure → recovery, MCP approval pages.
5. Workflow link(s), repo link. **Both members fill in the feedback form.**

## Timeline (today)

| When | Track A (Fastn MCP) | Track B (app) |
|---|---|---|
| now → +30 min | Step 0: billing, customer, gateway, 3 connections | Step 0: evidence/, sheet, Mongo, tunnel |
| +30 → 12:45 | A1 PLAN, A2 MAP, A3 GATE | B1 scaffold, B2 backend, B3 design pass |
| 12:45 → 1:30 | A4 BUILD (flows, triggers, widget) | B4 Sync health, Connections |
| 1:30 → 2:15 | A5 live test + debug loop, A6 verify | B4 Today, B5 wiring, N1–N7 |
| 2:15 → 3:00 | Record the video, submission doc | README, screenshots, Tier 2 if green |
| 3:00 → 3:30 | Submit, check the Drive link logged out | Feedback forms |

**Cut order if behind:** Tier 2 first → alert email Fix-it link (keep Fastn's own alerts) → Today polish. Never cut: Flow A, Flow B (or its fallback), the Sync health failure path, the evidence log, or the verification report.
