# Doorstep: submission document (DRAFT)

> **Draft status.** Sections 1–4 and 6 describe what exists in the repo and was tested locally. Every
> `⟦TODO⟧` must be filled from Track A's real results (Fastn build, T1–T9, verification report) before
> submitting. Nothing in a `⟦TODO⟧` may be estimated.

**Track:** 02, Ecommerce inventory and order sync · **Team:** ⟦TODO: names⟧ · **Links:** demo video
⟦TODO: Drive link, checked logged out⟧ · repo ⟦TODO⟧ · workflows ⟦TODO: Fastn workflow links⟧

## 1. Problem and persona

Sara runs one Shopify store and ships through a supplier who works from a Google Sheet. Every paid
order gets copied into the sheet by hand, every tracking number gets pasted back, and every buyer gets
emailed one at a time. She finds out an automation broke when a buyer complains. The Shopify job posts
we reviewed describe this exact loop, plus the same second ask: *"tell me when an automation silently
stops."* ⟦TODO: one real seller quote, if you got one⟧

**Who it's for:** solo and small merchants who ship through a supplier, workshop or packing table.
**Not for:** Shopify Plus stores with an ERP or warehouse API.

## 2. Solution

- **Sara** connects her store and her sheet once, inside Doorstep, through the embedded Fastn widget. Her
  credentials go to Fastn, never to us. After that she only looks when something needs her.
- **Her supplier** keeps working in the same sheet: new rows appear, and they type the tracking number.
- **Her buyer** gets exactly one email with the order number, carrier and tracking link. Never two.

Doorstep is a control tower, not a workspace. Its first screen answers one question, *"is anything
wrong?"*, and every problem links to the screen that fixes it.

## 3. Architecture

| Layer | What | Why |
|---|---|---|
| Fastn Flow A `orders-to-fulfillment` | Shopify order-paid event → upsert one sheet row keyed on order id | Real-time intake; idempotent by design |
| Fastn Flow B `tracking-to-shopify-and-buyer` | Every 5 min: rows with tracking and not Notified → Shopify fulfillment → one buyer email → Notified | The sheet has no change event, so a bounded poll is the safe pattern |
| Fastn config + widget | One config (paid only, exclude test orders, sheet tab, status names), one widget "Shopify Orders", User-level scope | Merchants retune rules without a redeploy |
| Doorstep host app | React + Tailwind, Express, MongoDB (`customers`, `syncEvents`) | Mints embed tokens server-side, receives outcome callbacks, shows Sync health |

Trigger actually used for Flow A: ⟦TODO: app event / webhook / schedule, and why⟧. Shopify fulfillment
write-back: ⟦TODO: used, or PRD fallback taken⟧.

## 4. Reliability

| Concern | How it's handled | Evidence |
|---|---|---|
| Duplicate rows | Upsert by `order_id` + `fastn.state` hash; replays skip | ⟦TODO: T2/T3 results⟧ |
| Duplicate buyer emails | `tracking-notify` state key written after the send, before the sheet update | ⟦TODO: T5⟧ |
| Retries | 3 attempts, exponential backoff | ⟦TODO: screenshot⟧ |
| Silent failures | Every record reports to `/api/sync-events`; failures appear in Sync health with step and plain-language reason; one alert email per failing record | ⟦TODO: T6⟧, [nav tests](evidence/nav-test-results.md) |
| Duplicate callbacks | Unique `eventId`: a redelivered callback returns 200 and changes nothing | API tests + N5 ✅ |
| Retry noise | Failed counts distinct (order, workflow) pairs, so 3 attempts read as 1 broken order | API tests ✅ |
| Recovery | Issues close themselves when a later run succeeds; no manual clearing | N4 ✅, ⟦TODO: T7⟧ |
| Tenant isolation | Multi-tenant connectors; every host-app query filters by the resolved customer | API tests ✅ |

Host app checks run locally: 26/26 API tests, 12/12 browser checks (N1–N7 plus extras), and a WCAG
contrast audit passing in both themes. Verification report: ⟦TODO: paste
`evidence/verification-report.md` verbatim⟧.

## 5. How Fastn MCP built it

Built by Claude driving the Fastn gateway with the `integration_builder` skill (v21). Every prompt is
logged verbatim in [`evidence/prompts.md`](evidence/prompts.md), with screenshots in
[`evidence/screenshots/`](evidence/screenshots/).

| Phase | MCP tools | Result | Evidence |
|---|---|---|---|
| Connections | `get_connect_url`, `list_connections` | ⟦TODO⟧ | ⟦TODO⟧ |
| PLAN | `list_connectors`, `analyze_entities`, `get_connector_events` | ⟦TODO⟧ | ⟦TODO⟧ |
| MAP | `probe_connector`, `propose_configuration`, `check_config_status` | configId ⟦TODO⟧ | ⟦TODO⟧ |
| GATE | `submit_test_cases` | ⟦TODO⟧ cases approved | ⟦TODO⟧ |
| BUILD | `run_code`, `create_workflow`, `set_connector_scope`, `test_workflow`, `publish_workflow` | ⟦TODO⟧ | ⟦TODO⟧ |
| Triggers + widget | `bind_*_trigger`, `create_widget`, `get_widget` | ⟦TODO⟧ | ⟦TODO⟧ |
| Debug loop | failed exec → diagnosis → `edit_workflow_code` → full-suite re-run | ⟦TODO⟧ | ⟦TODO⟧ |
| VERIFY | `trigger_scheduler_now`, `list_executions` | ⟦TODO⟧ | ⟦TODO⟧ |

What we corrected by hand: ⟦TODO⟧

## 6. Limitations and next steps

- The demo identifies the merchant by URL; real sign-in, onboarding and a Rules tab were cut for time.
- Connection cards show only what callbacks prove until we confirm whether the widget reports connection status.
- Next: restock inventory and notify the buyer on cancel or full refund; a second buyer channel (WhatsApp).
