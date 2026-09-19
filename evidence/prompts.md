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
