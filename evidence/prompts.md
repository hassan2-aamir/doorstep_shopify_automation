# Fastn MCP prompt log

Evidence for the "Use of the Fastn MCP tool" rubric line (20 points, tiebreaker 2). Every prompt sent to
Claude with the Fastn connector gets logged here **verbatim**, along with the MCP tools it triggered, what
came back, and the screenshot that proves it.

**How to log:** copy the entry template, fill it in right after each exchange, and save the screenshot as
`screenshots/NN-short-name.png` with the next free number. Don't tidy prompts after the fact. The raw
wording is the evidence.

```md
### NN · HH:MM · <who> · <phase>
**Prompt**
> exact text sent

**MCP tools invoked:** `tool_a`, `tool_b`
**Result:** one or two lines, plus any id produced (configId, workflow id, exec id)
**Screenshot:** screenshots/NN-short-name.png
```

---

## Staged prompts (paste in order, then log each as an entry below)

### P0 · Session gate (step 0.5)
> Load the fastn gateway skill, then run whoami, then check the published versions of integration_builder, workflow_verifier and connector_builder against my local copies.

Expected tools: `skill {"slug":"gateway"}`, `whoami`, `skill {"slugs":[...]}` 📸

### P1 · Connections (step 0.6)
> List the Shopify, Google Sheets and Gmail (or SendGrid) connectors, then give me a connect link for each one that has no ACTIVE connection. After I connect them, confirm all three are ACTIVE.

Expected tools: `list_connectors`, `get_connect_url` ×3, `list_connections` 📸

### P2 · Kickoff (A1)
> Use the fastn integration_builder skill. Build "Doorstep" for my customers (multi-tenant, they connect their own accounts).
> Entities: Shopify Orders and the Google Sheet tab "Fulfillment". Flow 1 `orders-to-fulfillment`: when a paid, non-test Shopify order arrives, upsert one sheet row keyed on order id, idempotent (replays and edits must not duplicate). Flow 2 `tracking-to-shopify-and-buyer` (every 5 minutes): rows with a tracking number and status not Notified get a Shopify fulfillment with that tracking number and carrier, one buyer email, then status Notified and notified_at; never email twice.
> Ongoing only, no backfill. One config for the whole use case, one widget named "Shopify Orders". Sheet columns: order_id, order_number, created_at, buyer_name, buyer_email, buyer_phone, ship_address, items, status, tracking_number, carrier, notified_at.
> Every flow returns {created, updated, skipped, errors, errorDetails}, uses a retry policy of 3 attempts with exponential backoff, and for each record reports {customerId, eventId, orderId, orderNumber, workflow, outcome, step, errorKind, error, runAt} to `${appBaseUrl}/api/sync-events` (appBaseUrl from fastn.envConfig) with header x-callback-secret from fastn.secrets callbackSecret. A failed callback must not fail the run. step is one of read_order, apply_conditions, dedupe_check, upsert_row, read_rows, create_fulfillment, send_buyer_email, update_status, send_alert. errorKind is connection for auth/expired-token errors, data for a missing buyer email or address, other otherwise. On a failure, email the merchant (alertEmail from config) once per failing record, guarded by state key alert:{customerId}:{orderId}:{workflow}, with a "Fix it" link to `${appBaseUrl}/sync-health?event=<eventId>`.
> Keep the test-case set in the small band (about 15 to 25). Check list_unified_categories for an ecommerce entity first. If a Shopify order event or fulfillment action is missing, tell me before building around it. Finish with the verification report.

**PLAN answers:** Orders → Fulfillment rows, tracking back to Shopify and the buyer · ongoing only ·
paid, not test · **my customers (multi-tenant)** · every 5 minutes · match on order id · missing phone:
sync anyway · missing buyer email: write the row, Flow B fails it as `data`.

📸 PLAN summary · 📸 `get_connector_events` result for Shopify

### P2-R · Kickoff, revised after entries 05–08 (A1) — **use this one, not P2**
P2 was written before we knew the Shopify connection has only 9 scopes and 403s on fulfillment orders
(entries 05, 07, 08). Pasting P2 unchanged makes the agent rediscover that at MAP and burn the clock.
P2-R states the finding up front and puts the write-back behind a config switch, which is the plan's
A4 decision gate taken in advance (the 30-minute time-box expired at entry 08).

> Use the fastn integration_builder skill. Build "Doorstep" for my customers (multi-tenant, they connect their own accounts).
> Entities: Shopify Orders and the Google Sheet tab "Fulfillment". Flow 1 `orders-to-fulfillment`: when a paid, non-test Shopify order arrives, upsert one sheet row keyed on order id, idempotent (replays and edits must not duplicate). Flow 2 `tracking-to-shopify-and-buyer` (every 5 minutes): rows with a tracking number and status not Notified get one buyer email, then status Notified and notified_at; never email twice.
> Known constraint, already probed, do not re-litigate: this Shopify connection is OAuth with only 9 scopes (read/write orders, products, inventory, draft_orders, read_locations). All six `*_fulfillment_orders` scopes are missing and `listFulfillmentOrdersJson` returns 403. So Flow 2 must gate the Shopify fulfillment behind a config boolean `shopifyWriteBack`, default **false**. When false, Flow 2 skips `create_fulfillment` and reports that step as `skipped`, not `failed`. Build the branch so flipping the boolean to true later needs no code change.
> Ongoing only, no backfill. One config for the whole use case, one widget named "Shopify Orders". Sheet columns: order_id, order_number, created_at, buyer_name, buyer_email, buyer_phone, ship_address, items, status, tracking_number, carrier, notified_at. The Shopify order `id` is numeric. A line item's `sku` can be null, so the mapping must tolerate it.
> Every flow returns {created, updated, skipped, errors, errorDetails}, uses a retry policy of 3 attempts with exponential backoff, and for each record reports {customerId, eventId, orderId, orderNumber, workflow, outcome, step, errorKind, error, runAt} to `${appBaseUrl}/api/sync-events` (appBaseUrl from fastn.envConfig) with header x-callback-secret from fastn.secrets callbackSecret. A failed callback must not fail the run. step is one of read_order, apply_conditions, dedupe_check, upsert_row, read_rows, create_fulfillment, send_buyer_email, update_status, send_alert. errorKind is connection for auth/expired-token errors, data for a missing buyer email or address, other otherwise. On a failure, email the merchant (alertEmail from config) once per failing record, guarded by state key alert:{customerId}:{orderId}:{workflow}, with a "Fix it" link to `${appBaseUrl}/sync-health?event=<eventId>`.
> Email sends go through the **Mailjet** connection (`sendEmail`, POST /v3.1/send) using the one Active sender. There is no Gmail or SendGrid connection in this workspace.
> Flow 1's trigger is the Shopify app event **`orders/paid`** (confirmed present, `registered: false`, so create the subscription and check `Subscription: Subscribed`). Use `orders/updated` for edits.
> Keep the test-case set in the small band (about 15 to 25). Finish with the verification report.

**PLAN answers (unchanged):** Orders → Fulfillment rows, tracking to the buyer · ongoing only ·
paid, not test · **my customers (multi-tenant)** · every 5 minutes · match on order id · missing phone:
sync anyway · missing buyer email: write the row, Flow B fails it as `data`.

**Placeholder for appBaseUrl:** no tunnel is running yet. Set `appBaseUrl` to `https://placeholder.invalid`
at A4.1 and correct it with P3 once Track B's tunnel is up; callbacks failing must not fail a run, so the
flows still pass their tests meanwhile.

### P3 · Callback wiring (A4.1, once Track B's tunnel is up)
> Set fastn.envConfig appBaseUrl to <TUNNEL_URL> and store fastn.secrets callbackSecret as <CALLBACK_SECRET>. Do not put either value in workflow code.

### P4 · Deliberate failure debug loop (A5, highest-value evidence)
> This run failed: <exec id>. The Error tab says <headline>. Failed at <step>. Diagnose and fix. If it's a connection problem, tell me what the customer has to do.

📸 Error tab · 📸 diagnosis · 📸 fix · 📸 full-suite re-run passing

### P5 · Config liveness (T8)
> Change the order status filter in the Doorstep config to also include "partially_paid", re-run Flow A on one order, and show me the run picked up the new rule without a code change. Then set it back.

### P6 · Verify (A6)
> Use the fastn workflow_verifier skill on the Doorstep use case: fire every trigger and correlate each to an execution, read back the widget and config, check config liveness, re-run the full test suite, and give me the verification report.

Save the report verbatim to `verification-report.md`. 📸

---

## Log

<!-- entries go below, newest last -->

### 01 · 12:35 · A · Session gate (P0, step 0.5)
**Prompt**
> run p0

(Shorthand for staged prompt P0: "Load the fastn gateway skill, then run whoami, then check the published
versions of integration_builder, workflow_verifier and connector_builder against my local copies.")

**MCP tools invoked:** `skill {"slug":"gateway"}`, `whoami`, `skill {"slugs":["gateway","integration_builder","workflow_verifier","connector_builder","unified_api"]}`
**Result:** Gate cleared (gateway v12). `whoami`: actor `user`, surface `dashboard`, org
`personal_c22c5878e2b772232955` ("Haamir.bscs23seecs's Organization", personal), role `owner`, environment
`test`, not acting as a tenant. Published versions: gateway v12, integration_builder v21, workflow_verifier v6,
connector_builder v2, unified_api v2. All five match the stamps in `.claude/skills`, so nothing was reinstalled.
Transport: project `.mcp.json` → `https://mcp.fastn.dev` (tools `mcp__fastn__*`).
**Screenshot:** screenshots/01-session-gate.png (to capture)

### 02 · session 2 · A · Session gate, re-cleared in this session (P0 repeat)
**Prompt**
> yes do from this session. (after `/mcp` → fastn → Authenticate) "now connected"

**MCP tools invoked:** `mcp__fastn__skill {"slug":"gateway"}`, `whoami`, `skill {"slugs":["gateway","integration_builder","workflow_verifier","connector_builder","unified_api"]}`
**Result:** Gate cleared again (it is per connection). `whoami` unchanged from entry 01: org `personal_c22c5878e2b772232955`, role `owner`, env `test`, not a tenant. Published versions still gateway 12, integration_builder 21, workflow_verifier 6, connector_builder 2, unified_api 2, matching the local stamps, so nothing reinstalled.
**Screenshot:** screenshots/02-gate-session-2.png (to capture)

### 03 · session 2 · A · Connections, part 1: find connectors and issue connect links (P1, step 0.6)
**Prompt** (staged P1, run on the instruction "Continue" then "yes do from this session")
> List the Shopify, Google Sheets and Gmail (or SendGrid) connectors, then give me a connect link for each one that has no ACTIVE connection. After I connect them, confirm all three are ACTIVE.

**MCP tools invoked:** `listConnectors` ×3 (search: shopify / google sheets / gmail), `listConnections`, `createConnectLink` ×3
**Result:** `listConnections` returned 0, so all three needed connecting. Connectors found:

| Connector | slug | id | status | Auth |
|---|---|---|---|---|
| Shopify | `shopify` | `5b763533-552a-4be9-8aea-69dbd2d9bc2b` | **test** (not live) | OAuth (default, needs the shop subdomain) or INPUT API key (`shop` + `shpat_` token) |
| Google Sheets | `googleSheets` | `38d254e2-b92e-44f4-81cd-8251fd9373d9` | live | OAuth 2.0 (spreadsheets scope) |
| Google Gmail | `googleGmail` | `ec3c1b4a-e281-4c5e-9a6b-90eb4a59882f` | live | OAuth 2.0 (includes `gmail.send`) |

Shopify's OAuth scopes include `write_orders` and the fulfillment-order read/write scopes, so the fulfillment write-back looks possible; the exact action names are still to be confirmed at PLAN. Three connect links issued and handed to the user (they carry short-lived tokens, so they are deliberately **not** stored here).
**Screenshot:** screenshots/03-connectors-and-links.png (to capture)

### 04 · session 2 · A · Connections, part 2: Shopify and Sheets ACTIVE, Gmail failed, switch email connector
**Prompt**
> gmail connector not working. Set me up with another gmail connector.

**MCP tools invoked:** `listConnections`, `listConnectors` (search: sendgrid, outlook, smtp, mail, mailjet), `listActions` (Mailjet, Outlook Mail), `createConnectLink` ×2
**Result:**
- `listConnections` shows **Shopify ACTIVE** and **Google Sheets ACTIVE** (both `endOrgId: null`, i.e. in the personal org, which is what the self-install test uses). **Gmail has no connection**, so the Google sign-in for it never completed. I did not see the error text, so the cause is unconfirmed. Likely candidates: the Gmail connector asks for several Google *restricted* scopes (`mail.google.com`, `gmail.readonly`, `gmail.compose`), which Google blocks for unverified apps or for Workspace accounts whose admin restricts third-party apps; the login was an `@seecs.edu.pk` address, which may be a Workspace account.
- Only one Gmail connector exists (Streak is a CRM), so a second "Gmail connector" would use the same Google login. Alternatives found: **Outlook Mail** (`microsoftOutlookMail`, status test, OAuth, action `sendMail`), **Mailjet** (`mailjet`, live, API key + secret, action `sendEmail` = `POST /v3.1/send`), plus Mailgun, Brevo and Elastic Email. There is **no SendGrid** connector in this workspace.
- Both `verifyStatus` fields are `null` on the two ACTIVE connections: ACTIVE only means credentials were stored, so "usable" still has to be proven by a real read (done at MAP/probe).
- Two new connect links issued (tokens not stored here). Recommendation: try Outlook Mail first (a Microsoft sign-in, sends from the user's own mailbox so it lands in the inbox); Mailjet as the fallback.
**Screenshot:** screenshots/04-connections-status.png (to capture)

### 05 · session 2 · A · Prove the connections with real read-only calls (closes step 0.6)
**Prompt**
> mailjet used and connected. All other also connected

**MCP tools invoked:** `listConnections`, `getConnectorMethods` (shopify, googleSheets), `runWorkflowCode` ×2 (read-only probes; nothing written or sent)
**Result:** `listConnections`: exactly one connection each for **Shopify, Google Sheets, Mailjet**, all ACTIVE (Mailjet `verifyStatus` was `skipped`, Shopify and Sheets `null`, so ACTIVE alone proved nothing). The real calls:

| Connection | Call | Result |
|---|---|---|
| Google Sheets | `getValues` `Fulfillment!A1:L2` | **200.** Tab name `Fulfillment` confirmed; the 12 headers read back exact and in order; no data rows |
| Mailjet | `listSender` | **200.** Credentials valid; 1 sender, status `Active`, so `sendEmail` (`POST /v3.1/send`) can use it |
| Shopify | `listShopJson`, `listOrderCountJson1`, `list202004OrdersJson` | **200.** Store `ApparelStore`, domain matches, plan `basic` (development store), currency USD, timezone America/New_York, connector API version `2024-01`, 1 existing order |
| Shopify | `listAccessScopesJson` | **Only 9 scopes granted:** `read/write_orders`, `read/write_products`, `read/write_inventory`, `read/write_draft_orders`, `read_locations`. **Not granted** even though the connector requests them: all six `*_fulfillment_orders` scopes (assigned / merchant_managed / third_party, read + write), `read/write_order_edits`, `read/write_product_listings` |
| Shopify | `listFulfillmentOrdersJson` (order 7340851429664) | **403** `The api_client does not have the required permission(s).` |

**Consequence:** creating a Shopify fulfillment on API 2024-01 needs the fulfillment-order scopes, so **Flow B's Shopify write-back cannot work with this connection**. This is the PRD's named risk; its documented fallback is that Flow B updates the sheet status and emails the buyer without writing to Shopify.

**Also learned:**
- **Resolves an open question:** the Shopify order `id` is **numeric** (`7340851429664`), alongside `admin_graphql_api_id` and `order_number`.
- The only existing order (#1001) is paid, came from a draft order (`source_name: shopify_draft_order`), and has **no customer, email, phone, or shipping/billing address**, and its line item has **`sku: null`** (it does have `variant_title`). That says nothing about whether Shopify hides buyer data from this app: it probably just had no customer attached. A real checkout order with a customer and address (T1) is the only way to find out. The mapping must also cope with a null SKU.
- The store's owner is not the signed-in user, so store-side changes (a custom app / token) need the owner.
**Screenshot:** screenshots/05-connections-proof.png (to capture)

### 06 · session 2 · A · Shopify permissions needed, and Flow A trigger check
**Prompt**
> tell me the shopify permissions you need and i will enable them.

**MCP tools invoked:** `listConnectorEvents` (Shopify), `createConnectLink` (Shopify, fresh link; token not stored)
**Result:**
- **Permissions needed on top of what is granted** (already granted and kept: `read_orders`, `write_orders`, `read_locations`): `read_merchant_managed_fulfillment_orders` and `write_merchant_managed_fulfillment_orders`. The store's line items use the `manual` fulfillment service, i.e. a merchant-managed location. Only if a 403 persists after enabling those two: also `read/write_assigned_fulfillment_orders` and `read/write_third_party_fulfillment_orders`.
- **Why the current connection can't get them:** Fastn's own Shopify app only ends up with 9 scopes and re-authorising is unlikely to add more. The route is a custom app in the store, whose `shpat_` token is entered on Fastn's Shopify connect page under the **API Key** auth method (`shop` + `accessToken`). The token is entered by the user in the browser, never in chat.
- **Flow A trigger question answered:** the Shopify connector exposes app events **`orders/paid`** (Order Paid), `orders/create`, `orders/updated` and `orders/cancelled`. Flow A can be event-driven as planned: `orders/paid` for intake, `orders/updated` for edits (T3). `orders/create` and `orders/updated` show `registered: true`; `orders/paid` is `registered: false`, so its subscription must be created and checked (`Subscription: Subscribed`) when the trigger is bound.
- Plan: build Flow B with the Shopify write-back behind a switch, so falling back to the PRD's sheet-status + buyer-email path is a config change, not a rewrite.
**Screenshot:** screenshots/06-shopify-events.png (to capture)

### 07 · session 2 · A · Re-test Shopify fulfillment permissions
**Prompt**
> i think i have added, test

**MCP tools invoked:** `listConnections`, `runWorkflowCode` (read-only: shop, access scopes, orders, fulfillment orders)
**Result:** **Not fixed.** Still the same 9 scopes and `listFulfillmentOrdersJson` still returns **403**. The Shopify connection is still `authType: OAUTH` (not the API-key type), and its `updatedAt` moved to 08:50:13Z, so the sign-in was re-run but nothing new was granted. That matches the earlier reading: re-authorising Fastn's own Shopify app does not add the fulfillment scopes, and the custom-app token has not been entered on Fastn's connect page under the **API Key** method. Store and orders are still readable (order #1001 only).
**Screenshot:** screenshots/07-shopify-retest.png (to capture)

### 08 · session 2 · A · Second re-test of Shopify fulfillment permissions
**Prompt**
> now check.

**MCP tools invoked:** `listConnections`, `runWorkflowCode` (read-only, same probe as entry 07)
**Result:** **Still not fixed.** Same 9 scopes; `listFulfillmentOrdersJson` still **403**. The Shopify connection was deleted and re-created (`createdAt` moved from 08:24:37Z to 09:04:05Z) but it is still `authType: OAUTH` with `authMethodId: null`. The API-key method would show `authMethodId: 03bce64a-fa88-42ec-b902-7f43156dffe3` and an `INPUT`-type auth. So the token method was not the one used, both times. Nothing else changed: shop and order reads work, and the Sheets and Mailjet connections are unchanged and still ACTIVE.
**Elapsed:** about 20 minutes since the first 403 was found (about 14:05 PKT, roughly 85 minutes before a 3:30 PM lock), so the 15-minute time-box set in entry 06 has passed.
**Screenshot:** screenshots/08-shopify-retest-2.png (to capture)

### 09 · 15:22 · A · MAP: probes + propose_configuration (A2)
**Prompt**
> read the todo and plan. Then proceed with whatever needs completion.

(then, on the blocked-decision question: "Try the Fastn build now", deadline confirmed 16:30)

**MCP tools invoked:** `skill {"slug":"gateway"}`, `whoami`, `skill {"slugs":[...]}`, `listWorkflows`, `listConnections`, `getConnectorMethods` (googleSheets), `probeConnector` ×2, `proposeConfiguration`
**Result:**
- Gate cleared (gateway v12). All five local skills match published versions, so nothing reinstalled.
- `whoami`: actor `user`, `actingAsTenant: false`, role `owner`, env `test` → partner staff, full four-phase flow; tenancy already answered by plan.md as Path B.
- `listWorkflows`: **0 workflows**. Clean slate, so the `create_workflow` slug-upsert hazard does not apply.
- `listConnections`: exactly one ACTIVE connection each for Shopify, Google Sheets, Mailjet → no connection-choice ambiguity.
- Google Sheets target CREATE action is **`appendValues`**; read action `getValues`.
- **Source probe** `probe_1d70b9c2-8862-4036-97f3-bc95312dd903` — shopify / `list202004OrdersJson`, **163 fields**. `financial_status: "paid"`, `test: false`, numeric `id`, `line_items.sku` empty. `customer`, `shipping_address`, `billing_address` came back **empty** (order #1001 is a draft order with no customer), so their leaf fields were never discovered.
- **Target probe** `probe_cc3184c0-41c6-42aa-a992-b3943b4313ab` — googleSheets / `getValues` on `Fulfillment!A1:L2`, **12 fields**. The Sheets API is positional: fields come back as `0..11` with the 12 headers as sample values, re-confirming the headers exact and in order. Target fields are therefore indices carrying the header as `targetLabel`.
- `proposeConfiguration` → draft **`cdr_5aa939576171`**, status `pending`, reviewUrl issued (its token is short-lived and deliberately not stored here).

**Three mappings proposed** (id→0 order_id high, order_number→1 high, created_at→2 high) and **two conditions** grounded in real probed values (`financial_status in paid`, `test equals false`). Matching: natural key on Shopify `id` ↔ column 0.

**Deliberately NOT in `mappings[]`, per the skill's rules:**

| Column | Why omitted | Where it gets built |
|---|---|---|
| H `items` | line_items array → one cell is a **reshape**; a placeholder mapping would lock that review row and block approval of the whole config | Workflow code, Flow A |
| D–G buyer_name / buyer_email / buyer_phone / ship_address | `customer.*` and `shipping_address.*` leaves absent from the probe, so `proposeConfiguration` would drop them as hallucinated | Workflow code, confirmed against a real checkout order at T1 |
| I `status` | A chosen constant, not a source field | User sets it as a **fixed value** `New` at the reviewUrl |
| J–L tracking_number / carrier / notified_at | Supplier-owned and Flow-B-owned; nothing in a Shopify order maps to them | Flow B |

**Empty-required handling surfaced rather than silently skipped (the skill requires this):** `buyer_email` empty → the PRD rule stands, Flow A writes the row anyway and Flow B fails that record as `errorKind: data`, so it surfaces in Sync health instead of being dropped.
**Screenshot:** screenshots/09-config-review.png (to capture, before + after approval)

### 10 · 15:45–16:10 · A · GATE, BUILD and the debug loop (A3, A4)
**Prompt**
> ive approved the test cases and added the ip

**MCP tools invoked:** `getConfigDraft`, `createTestCaseDraft`, `getTestCaseDraft`, `listEnvironmentConfigs`, `listSecrets`, `runWorkflowCode` (live write probe), `createWorkflow`, `testSavedWorkflow` ×3, `editWorkflowCode`, `saveWorkflowValidation`, `setWorkflowConnectorScope` ×2, `createWidget`, `listConfigs`, `updateConfig`

**Result:**
- **MAP approved** → `configId` **`cfg_910772de96ce`**, all three mappings and both conditions intact.
- **GATE approved** → `tcr_0cb01316d8f7`, **25 test cases, accepted unedited**, covering T1–T9.
- **Env-config gap surfaced, not worked around:** `listEnvironmentConfigs` and `listSecrets` both returned empty. BUILD step 3 forbids writing a placeholder to unblock, so the gap was reported to the user: `appBaseUrl` (env config) and `callbackSecret` (secret) are still unprovisioned.
- **Write probe (BUILD step 4) passed live:** real order → approved mappings → `appendValues` **200** (`Fulfillment!A2:L2`, 12 cells) → read-back field-exact → `clearValues` cleanup. Also learned that **Sheets trims trailing empty cells on read** (9 elements returned for a 12-column row), which Flow B must pad for.
- Flow A created: **`wf_9406750cbc34`**, `orders-to-fulfillment`, tier `standard`, retry 3 attempts exponential backoff, bound to `cfg_910772de96ce`, 16 approved cases attached.

**THE DEBUG LOOP (the highest-value MCP evidence — a real bug, found and fixed):**

1. First `testSavedWorkflow` returned **`created=0, updated=0, skipped=1, errors=0`**. The skill is explicit that all-skipped on a happy path is a FAILURE, not a pass — an HTTP 200 proves nothing.
2. **Diagnosis from the trace:** the config review page saves every condition value as a **string** (`test equals "false"`), while Shopify sends `test: false` as a **boolean**. `fastn.evaluator` compares strictly, so `false === "false"` is false and **every genuine order was being filtered out**. A bound schedule would have silently no-op'd forever — exactly the silent-failure class Doorstep exists to surface.
3. **Fix** via `editWorkflowCode`: build a `condView` of the record with the fields named in conditions coerced to strings, then evaluate. The saved condition keeps working as the user wrote it. The patch auto-published as version 1 and returned a **`regressionGate`** instruction (`STOP - REGRESSION GATE`, 16 cases stale).
4. **Re-run:** **`created=1, updated=0, skipped=0, errors=0`** — row at `Fulfillment!A2:L2`, col A `7340851429664`, col B `1001`, col H `1 x Selling Plans Ski Wax`, col I `New`. **T1 passes.**
5. **Replay:** **`created=0, updated=0, skipped=1, errors=0`**, sheet still exactly one data row. **T2 passes.**
6. `saveWorkflowValidation` recorded **5 pass, 10 skipped with reasons, 1 partial**, overall **`partial`** — scored honestly rather than claimed green. Blockers named per case: no real checkout order, a single-line-item store, no mock stubs, and the unprovisioned callback target.

- **Path B manifest:** `setWorkflowConnectorScope` flipped **shopify** and **googleSheets** to `MULTI_TENANT` (connection pins cleared, so a connection resolves per tenant).
- **Widget:** **`wgt_d1f67a4d76b3`** ("Shopify Orders", slug `shopify-orders`, active, SINGLE_ACTIVATION), exposing all three connectors and Flow A. `listConfigs(widget_id)` came back **empty**, i.e. the config was NOT auto-linked — the skill calls an unlinked config a build failure — so `updateConfig` set `widget_id`, and the readback confirms `widgetId: wgt_d1f67a4d76b3`.

**Not done at the lock:** Flow B, both triggers, and PHASE 4's verification report.
**Screenshot:** screenshots/10-flow-a-build.png, 11-debug-loop.png, 12-widget.png (to capture)

### 11 · 15:27–16:10 · A · Flow B, triggers, widget and VERIFY (A4–A6)
**Prompt**
> do whatever is left

**MCP tools invoked:** `runWorkflowCode` ×4 (Mailjet probe, sheet seeding, cell repair), `createWorkflow`, `testSavedWorkflow` ×6, `editWorkflowCode` ×3, `saveWorkflowValidation` ×2, `setWorkflowConnectorScope` ×2, `bind_schedule_trigger`, `bind_app_trigger`, `triggerSchedulerNow`, `listWorkflowExecutions`, `updateWidget`

**Result:** Flow B **`wf_a51624da9db1`** built, published, MULTI_TENANT, 9 approved cases attached.
Both triggers bound. Widget updated to carry both flows and both triggers.

**Mailjet send path probed first:** `listSender` → one Active sender; `sendEmail` → **200 `Status: success`**.
The probe was addressed to the verified sender itself, so nothing reached a third party.

**A three-step live sequence, run in order, each asserting its own outcome:**

| Step | Returned | Verdict |
|---|---|---|
| Tracking typed in, no buyer email | `errors=1`, `errorKind: data`, step `send_buyer_email`, row NOT Notified, **one** alert email | TC-19 pass |
| Immediate re-run | `state.get` hit the guard, **no `sendEmail` in the trace** | TC-22 pass |
| Buyer email filled in | `updated=1, errors=0`, one buyer email (UPS + `1Z999AA10123456784` + tracking link), row → `Notified` + `notified_at` | **T4 pass** |
| Run again | `skipped=1`, **no `sendEmail`**, `notified_at` unchanged | **T5 pass** |

`create_fulfillment` was reported **skipped, not failed**, throughout (`shopifyWriteBack: false`) — TC-20 pass.

**TWO MORE REAL DEFECTS FOUND AND FIXED** (on top of the boolean-condition bug in entry 10):

1. **`USER_ENTERED` corrupted the buyer phone.** Writing `+92 300 1234567` stored **`#ERROR!`** — Sheets
   parses a leading `+` as a formula. This would have silently mangled the phone on essentially every
   international order, in the supplier's own sheet. **Fixed:** both flows now use `valueInputOption: "RAW"`.
   Verified by re-writing the cell with RAW and reading back the literal string.
2. **Flow A would erase the supplier's data.** Flow A rebuilds the whole row; for an order where Shopify has
   no customer, the buyer columns compute to empty, and writing that would wipe whatever the merchant or
   supplier had typed. **Fixed:** a guard that never replaces a filled cell with a blank. Verified — the
   re-run returned `skipped=1` and left Sara Khan, the email, phone and address untouched.

Each fix re-armed the platform's `regressionGate` (`STOP - REGRESSION GATE`) and the suite was re-run and
re-persisted before the change was accepted.

**Trigger fire-and-correlate:** `triggerSchedulerNow` → `eventId sched-evt_665adc8cf005`;
`listWorkflowExecutions` → `exec_e356678864cd` carrying `x-fastn-event-id: sched-evt_665adc8cf005` and
`x-fastn-trigger-id: 72d331d9-...`. **Delivery proven.** The execution stayed `status: queued` for over two
minutes and never completed — recorded as a blocker rather than shrugged off; both flows are
`executionTier: standard` on a free-plan org, so the `instant` tier is the first thing to try.

**Validations persisted honestly:** Flow A 7 pass / 2 partial / 7 skipped-with-reason; Flow B 5 pass /
2 partial / 2 skipped-with-reason. Overall `partial` on both. No case was marked pass on a status code.

**Verification report** written to [verification-report.md](verification-report.md).
**Screenshot:** screenshots/13-flow-b-email.png, 14-sheet-notified.png, 15-triggers.png (to capture)

### 12 · 16:10–17:45 · other computer · Deployment and callback wiring (RECONSTRUCTED, prompt text not preserved)
**Prompt**
> Not logged at the time. Reconstructed on 19 Sep at 17:50 by reading the platform back, so the wording that produced these changes is unknown. Treat this entry as a description of platform state, not as a transcript.

**Changes found on the platform** (all by the org owner `fb090b4e-…`), times in PKT:

| When | What | Read back with |
|---|---|---|
| 16:23 | Env config `appBaseUrl` (env `test`) set to `http://doorstep-prod.eba-bf4y27m3.us-east-1.elasticbeanstalk.com`, so the host app is now deployed on **AWS Elastic Beanstalk** instead of behind a tunnel | `getEnvConfig`, `listEnvironmentConfigs` |
| 16:23–16:26 | Flow A published as versions 4, 5, 6 (`wv_38906739af07` +190 bytes, `wv_60c13ad42df0` −78, `wv_1e526dc20f08` +693) | `listWorkflowVersions` |
| 16:24 | Org secret `CALLBACK_SECRET` created (`sec_61b3beb3d241`) | `listSecrets` |
| 16:26 | Env config `defaultCustomerId` (env `test`) = `0b55acb5-45f5-4ff1-9ba9-6fa3070becb2` | `listEnvironmentConfigs` |
| 16:28 | Flow B dev version 4 published | `listWorkflows` |
| 16:44 | Commit `36dac6d`: `crossOriginOpenerPolicy: false` in `app.js`, so the Fastn widget's OAuth popup keeps `window.opener` (helmet's default severed it) | `git show` |

What the code now live in Fastn does differently (from the workflow source, which carries its own comments): the secret is read as `CALLBACK_SECRET` (UPPER_SNAKE; the earlier camelCase name could never resolve); `customerId` is accepted only if it is a real UUID and otherwise falls back to `defaultCustomerId` (a triggered run carries the org id, which the receiver rejects); and each callback `eventId` is unique per step (a shared id made the receiver drop the second event of a run as a duplicate, which lost a FAILURE).

**Not evidenced:** the prompts and tool calls behind these edits, and whether the regression suite was re-run after them. Both flows still show `lastValidation.stale: true` with the reason "the workflow code just changed".
**Screenshot:** none captured.

### 13 · 17:45–17:55 · session 3 · Re-verify the whole system after the other computer's work (read-only)
**Prompt**
> continue. I did a lot of work from another computer, so see where we are, then lets continue.

**MCP tools invoked:** `skill {"slug":"gateway"}`, `listWorkflows`, `listWorkflowExecutions`, `listSecrets`, `getEnvConfig`, `listEnvironmentConfigs`, `listAppEventTriggers`, `listSchedulers`, `getWidget`, `listWorkflowVersions`, `runWorkflowCode` (one read-only sheet read). Nothing was written to Fastn, the sheet, Shopify or the deployed app.

**Result (all read back, not assumed):**
- **Both flows published and enabled:** Flow A `wf_9406750cbc34` dev version 6, Flow B `wf_a51624da9db1` dev version 4, config `cfg_910772de96ce` linked, widget `wgt_d1f67a4d76b3` active with both flows and both triggers.
- **Schedule trigger:** `ACTIVE`, cron `*/5 * * * *`, `consecutiveFailures: 0`, `lastRunAt` 17:45:00 PKT, next 17:50. The newest page of executions holds 22 Flow B runs, **all carrying the schedule trigger id**, 16:00:01 → 17:45:00, 21 completed and 1 queued.
- **App-event trigger `orders/paid`: `subscriptionStatus: ACTIVE`** (`subscriptionResponse.success: true`). The earlier `registered: false` concern is resolved.
- **T9's app-event half is now proven.** `orders/paid` fired for real three times, each `completed 200` with `created: 1, errors: 0` and Shopify's own headers on the run (`x-shopify-topic: orders/paid`, `x-fastn-trigger-id: 99102bca-…`):

| Order | Execution | Fastn event id | Shopify triggered (UTC) | Flow A version |
|---|---|---|---|---|
| #1002 `7341202768160` | `exec_705f59d79ecd` | `evt_faf99c058aa8418f` | 10:56:56 | 3 |
| #1003 `7341206176032` | `exec_00fafff60319` | `evt_263e222aa74e435c` | 10:59:19 | 3 |
| #1004 `7341330694432` | `exec_0a9d69385da5` | `evt_b98426c737fa448e` | 12:27:54 | 6 |

- **Measured order-to-row latency (PRD target: under 60 s): NOT MET.** The event reaches Fastn in 12–44 s, then the run waits in the standard-tier queue (started 2.0, 2.7 and 5.0 min after creation). Trigger to completed: **162 s (#1002), 181 s (#1004), 343 s (#1003)**. Each run itself takes only 2.1–4.6 s, so `executionTier: instant` is the fix; it has not been applied.
- **The callback path works end to end.** The deployed app answers `/api/health` 200 and `/api/workspace` with `status: live`; its 24 h counts read **synced 1 · skipped 43 · failed 3** at 17:44, and skipped had grown to 49 by 17:55 (it rises with every 5-minute run). The single synced event is #1004's `orders-to-fulfillment upsert_row` at 17:30:51 PKT, confirmed from the event feed; #1002 and #1003 ran on version 3, before the callback target existed, so they never reported.
- **3 open issues in Sync health, all the designed `data` failure:** #1002, #1003, #1004, step `send_buyer_email`, "This order has no buyer email". Each Flow B run retries them and re-reports; the state-key guard keeps it to one alert email per order. They stay open until a buyer email exists in column E.
- **Why there is no buyer email:** all three orders are `source_name: shopify_draft_order`, gateway `manual`. #1002 and #1003 have `customer: null`. #1004 has a customer stub (`state: disabled`) with no email, name or phone, and a shipping address holding only the country. The sheet shows the same: rows 3–5 have tracking + carrier typed but no buyer name, email or phone, and #1004's address cell reads only "United States". **This does not show that Shopify hides buyer data from this app**; the orders were created without any. It stays untested until an order is created with a customer email and address.
- **Noise:** Flow B reports a `create_fulfillment` *skipped* event for every pending row on every run. In the latest 50 events that is 23 skipped `create_fulfillment` plus 23 repeated failures for the same 3 orders, so it inflates the Skipped counter and buries real events.
- **Flow A's event path is not single-record.** On `orders/paid` the run gets the order as `ctx.input`, but the code only honours `input.order` / `input.orderId`, so it falls through to the "recent scan" branch and re-lists the store's 10 most recent orders. That is why #1004's run returned `created: 1, skipped: 3`. The result is correct today, but each event pays for a full scan, and it would miss an order if 10 newer ones arrived before the run started.
- **Regression gate:** both flows report `lastValidation.stale: true`, so the suite has not been re-run since the version 4–6 edits.
- **Exposure:** the deployment is plain HTTP. Sync health is readable without sign-in (the server falls back to the demo customer), and the callback secret crosses the internet unencrypted on every callback.
**Screenshot:** screenshots/16-fastn-triggers-and-executions.png (to capture)
