# Platform Agent prompt library

Contents: the four-part formula, starter templates per hackathon track, iteration and debugging prompts, prompts for the widget and alerts.

The agent's own example cards show the shape of a good first message: a system, a trigger, and the specific thing that moves. Examples it ships: "Sync deals into billing" (closed-won Salesforce opportunities, custom fields included), "Alert before an SLA breaches" (Slack post when a Zendesk ticket nears its deadline), "Keep a sheet current" (append new HubSpot contacts to a Google Sheet), "Give an agent scoped access" (read-only Jira for one customer).

## The formula

| Say | Example |
| --- | --- |
| **The systems** | "Shopify" and "Google Sheets", not "our store" and "a spreadsheet" |
| **What starts it** | "when an order is paid", "every 5 minutes", "when tracking is added" |
| **What moves** | the exact fields: order id, buyer name, email, phone, ship-to address, SKUs, quantities |
| **The rules** | "skip test orders", "one row per order", "never send twice", "log failures" |

Also state tenancy up front ("multi-tenant: each merchant connects their own Shopify and sheet") and sync scope ("ongoing only, no backfill") so the clarifying questions go faster. Attach a real sample payload when you have one.

## Track 02, ecommerce inventory and order sync ("store to doorstep")

Build as small workflows, one per concern, so failures are readable (three workflows means three execution records and three retry policies).

**A. Order to fulfillment sheet (webhook or app event)**
> When a new order is paid in Shopify, append one row to a Google Sheet called Fulfillment with: order number, created time, buyer name, email, phone, full shipping address, and each line item as SKU, size and quantity. Set a Status column to "New". This is multi-tenant: every merchant connects their own Shopify store and their own sheet. Ongoing only, no backfill. Make it idempotent: if the same order event arrives twice or is replayed, only one row is created (use the order id as the key). If the order is edited later, update the existing row instead of adding one.

Trigger notes: prefer an app event trigger if the Shopify connector supports order events, otherwise a webhook trigger. On a webhook set a **deduplication key** (the order id field) and consider **Sequential** execution mode. After creating an app event trigger, check the `Subscription` column is Subscribed.

**B. Tracking back to the buyer (schedule)**
> Every 5 minutes, find rows in the Fulfillment sheet where a Tracking Number is filled in and Status is not "Notified". For each, add the tracking number and carrier to the Shopify order as a fulfillment, then send the buyer a message with the order number and tracking link by email (or WhatsApp via Twilio), then set Status to "Notified". Never notify the same order twice, even if the run is retried.

If Google Sheets offers no app event for row changes (unverified), the schedule poll is the safe pattern. Because the destination is a spreadsheet, keep the status write as the last step and guard with state so a partial failure retries only what is left.

**C. Failure visibility**
> For the two workflows above: turn on the retry policy with 3 attempts and exponential backoff. If a step still fails, write a row to a Failures table with customer id, order id, step name, error message and time, and notify by email. Add a diff report so each run shows what changed record by record.

Then in Activity, Alerts: **Turn on failure alerts**, plus "Broken connectors above 0" and "Total runs below 1 over 24 hours" on the daily/scheduled ones.

**D. Refunds and cancellations (stretch)**
> When a Shopify order is cancelled or fully refunded, set its row Status to "Cancelled", restock the inventory quantity on the matching Shopify variant, and notify the buyer. Partial refunds adjust the line quantity only.

**E. Merchant-facing status (P0 for Doorstep)**
> After every run, and for every failed record, call our app's callback URL (https://YOUR_PUBLIC_URL/api/sync-events) with fetch. Send header x-callback-secret from the Fastn secret CALLBACK_SECRET and a JSON body {customerId, orderId, workflow, outcome: success|skipped|failed, step, error}. Read the app base URL from fastn.envConfig. A failed callback must not fail the run.

This feeds the Sync health panel. The workflow sandbox has `fetch` (30 s timeout) but no `URL` or `Buffer`. Host app: `assets/embed-starter/` (dependency-free Node reference; the TRD stack is React, Tailwind, Node, Express and MongoDB, so port it). See `workflows-and-patterns.md` for the sketch.

## Track 01, CRM sync between two CRMs

> When a contact or deal is created or updated in HubSpot, create or update the matching record in Pipedrive. Match on email for contacts. Multi-tenant: each customer connects their own HubSpot and Pipedrive. Use a hash of the synced fields stored in state so an update that changes nothing is skipped, and so a change made by our own sync does not bounce back and trigger the reverse direction (loop guard). Log every conflict.

Pitfalls: sync loops in two-way sync, duplicate creation without a match key, rate limits on backfills. Use the two-stage or hash patterns in `workflows-and-patterns.md`. Consider the Unified CRM API (`fastn.unified`) if both providers are among its 12.

## Track 03, subscribing to notifications

> Customers choose which events they want (for example order shipped, low stock) and a destination (email, Slack, or WhatsApp/SMS via Twilio). Store each customer's preferences in our database keyed by customer id. When an event arrives, look up the preferences and send one message per chosen destination. If a destination is disconnected, stop sending to it and record it. Never send the same event twice to the same destination.

Pitfall: per-customer rules belong in `fastn.db` with a customer column (not in configs, which vary by environment, not by customer). Preference edits and disconnects must work without support.

## Track 04, business intelligence export

> Every day at 06:00 in the merchant's timezone, gather yesterday's orders (count, revenue, top products) and append a summary row to a Google Sheet (or Airtable / Notion database) the customer connected. Write the run's status and row count somewhere the customer can see.

Pitfalls: timezone (a schedule trigger's timezone defaults to the browser's, not the org's), duplicates on rerun (key on date), sheet schema drift.

## Iteration prompts (use after the first build)

- "Add error handling for when the API is down."
- "Make this idempotent: if the same event comes in twice, only create it once."
- "Only write records whose fields actually changed since the last run."
- "Retry this three times with backoff if the destination is down."
- "Skip anything under $500 / only the EU warehouse."
- "Change the schedule to hourly."
- "Put first and last name in separate columns." (at the field-mapping approval step)
- "Notify Slack on failure."
- "Add diff reporting so each run produces a sync report."
- "A one-off backfill for the last two years, safe to run alongside the hourly sync."
- "Fan this webhook out to three workflows."
- "A nightly check that both systems have the same number of open orders, and tell me when they don't."

## Debugging prompts

Paste the `exec_...` and `wf_...` ids and the Error tab's "What happened / Why / How to fix" text:
> This run failed: [exec id]. The Error tab says [headline]. Failed at [connector.slug.action] step [n of m]. Diagnose and fix the workflow. If it is a connection problem tell me what the customer has to do.

## Widget and embed prompts

> Expose this integration as a widget with User-level scope so each merchant connects their own Shopify store and Google Sheet. Show only these two integrations. Title "Connect your store".

Widget scope defaults to Org level: check it, and verify in the builder preview by switching the tenant selector to a real customer.

## Rules of thumb

- One sentence of detail per field that matters saves a rebuild.
- Answer the clarifying cards deliberately; do not click through.
- Approve or correct the mapping table before the workflow is built, not after.
- After each build, open Test cases, run in Live mode against test data, then Publish, then attach the trigger, then check the trigger's own health column.

## Kickoff prompt for the gateway (Claude with `integration_builder`)

Use after the plugin or skills are installed and the gateway is connected (`gateway-and-skills.md`). It front-loads the business answers so PLAN collapses to confirmations.

> Use the fastn integration_builder skill. Build "Doorstep" for my customers (multi-tenant, they connect their own accounts; I will confirm tenancy when asked).
> Entities: Shopify Orders and a Google Sheet tab "Fulfillment". Flow 1: when a paid, non-test Shopify order arrives, upsert one sheet row keyed on order id, idempotent (replays and edits must not duplicate). Flow 2 (every 5 minutes): rows with a tracking number and status not Notified get a Shopify fulfillment with that tracking number, one buyer email, then status Notified; never email twice.
> Ongoing only, no backfill. One config for the whole use case, one widget named "Shopify Orders". Sheet columns: order_id, order_number, created_at, buyer_name, buyer_email, buyer_phone, ship_address, items, status, tracking_number, carrier, notified_at.
> Every flow returns {created, updated, skipped, errors, errorDetails}, uses a retry policy, and after each run reports {customerId, orderId, workflow, outcome, step, error} to https://YOUR_PUBLIC_URL/api/sync-events with the secret CALLBACK_SECRET.
> Keep the test-case set in the small band (about 15 to 25). Check list_unified_categories for an ecommerce entity first. If a Shopify order event or fulfillment action is missing, tell me before building around it. Finish with the verification report.

**Answers to the PLAN and MAP questions**

| Question | Answer |
| --- | --- |
| Entities | Orders (Shopify) to Fulfillment rows (Sheet); tracking back to Shopify |
| Direction | Shopify to sheet for orders; sheet to Shopify and buyer for tracking |
| Initial vs ongoing | Ongoing only |
| Scope | Paid orders; exclude test orders |
| Who is it for | My customers (multi-tenant) |
| Schedule cadence | Every 5 minutes |
| Empty required fields (for example no phone) | Sync anyway; phone is not required; skip only if buyer email is empty and flag it |
| Matching key | Order id |

**At the gates**: open the mapping `reviewUrl` and the test-case `reviewUrl`, approve deliberately, screenshot both, and note the `configId`. Do not let the agent build a second widget or extra entities.
