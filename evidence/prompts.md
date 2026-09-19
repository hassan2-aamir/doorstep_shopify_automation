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
