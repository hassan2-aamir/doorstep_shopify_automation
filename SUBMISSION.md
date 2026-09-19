# Doorstep: submission document (DRAFT)

> **Status.** Sections 3–5 are now filled from real Fastn results — every id, count and outcome below came
> back from a live run and is reproducible from [`evidence/`](evidence/). The remaining `⟦TODO⟧` items are
> ones only a human can supply (team names, demo video link, Fastn workflow links). The deadline moved to
> 20 Sep, 6 PM; the demo plan is in [`demo/script.md`](demo/script.md).

**Track:** 02, Ecommerce inventory and order sync · **Team:** ⟦TODO: names⟧ · **Links:** demo video
⟦TODO: Drive link, checked logged out⟧ · repo https://github.com/hassan2-aamir/doorstep_shopify_automation · live app https://d3nkcj9r1qd361.cloudfront.net/ · workflows ⟦TODO: Fastn workflow links⟧

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
| Doorstep host app | React + Tailwind, Express, MongoDB (`customers`, `syncEvents`) | Mints embed tokens server-side, receives outcome callbacks, shows Sync health. Includes a public landing page (`/welcome`) and a three-step setup (`/setup`: Store, Sheet, Go live) |
| AWS deployment | Elastic Beanstalk (Node 22, single instance) behind scripts in [`deploy/`](deploy/): build, ship, smoke-test, roll back, provision, tear down | Reproducible: one command ships the app, nine read-only checks verify it, and the previous version is one command away |

**Trigger actually used for Flow A:** the Shopify **app event `orders/paid`** (trigger
`99102bca-8259-461c-b0bb-b3c32c5d3f50`). It exists on the connector, so neither webhook nor poll fallback
was needed. Flow B runs on a **5-minute schedule** (`72d331d9-26c3-49d0-962c-e33564b0892c`, cron
`*/5 * * * *`, Asia/Karachi) because a Google Sheet emits no change event — a bounded poll is the safe
pattern. That schedule is armed and has fired unattended every 5 minutes since 16:00 PKT (22 runs, 0 consecutive failures at the last read). The app event has fired for real three times on live orders #1002, #1003 and #1004 (`exec_705f59d79ecd`, `exec_00fafff60319`, `exec_0a9d69385da5`), each completed 200, and its subscription reads `ACTIVE`.

**Shopify fulfillment write-back: the PRD fallback was taken.** The Shopify connection carries only 9 OAuth
scopes and returns **403** on fulfillment orders; all six `*_fulfillment_orders` scopes are missing, and
re-authorising the Fastn Shopify app does not add them (proven three times — evidence entries 05, 07, 08).
Flow B therefore emails the buyer and sets the sheet status, with the Shopify step behind a config switch
`shopifyWriteBack` (default off) that reports `create_fulfillment` as **skipped, not failed**. Entering a
custom-app token under the API Key auth method flips it on with no code change.

**Live ids:** config `cfg_910772de96ce` · Flow A `wf_9406750cbc34` · Flow B `wf_a51624da9db1` ·
widget `wgt_d1f67a4d76b3` ("Shopify Orders", both flows, both triggers, config linked).

## 4. Reliability

| Concern | How it's handled | Evidence |
|---|---|---|
| Duplicate rows | Upsert keyed on the Shopify order id; an unchanged record skips | **T2 pass** — replay returned `skipped=1`, one data row, cells unchanged |
| Duplicate buyer emails | State key `notify:{customerId}:{orderId}` written **after the send, before the sheet update**, so a failed sheet write can never cause a second email | **T5 pass** — second run `skipped=1` with **no `sendEmail` in the trace**, `notified_at` unchanged |
| Retries | 3 attempts, exponential backoff (2 s initial, ×2, 30 s cap) on both flows | Set at `createWorkflow`, visible in each workflow readback |
| Silent failures | Every record reports to `/api/sync-events`; failures carry step + `errorKind`; one alert email per failing record | **Proven for the data-failure path** — a real failure classified `errorKind: data` at step `send_buyer_email` sent exactly one alert, and callbacks now reach the deployed host app: Sync health shows the three live failures (#1002 to #1004, no buyer email) as open issues. The connection-outage variant was not run |
| Duplicate callbacks | Unique `eventId`: a redelivered callback returns 200 and changes nothing | API tests + N5 ✅ |
| Retry noise | Failed counts distinct (order, workflow) pairs, so 3 attempts read as 1 broken order | API tests ✅ |
| Recovery | Issues close themselves when a later run succeeds | N4 ✅; the failed record completed with `errors=0` and **no duplicate email** once the buyer email was supplied |
| Tenant isolation | Multi-tenant connectors; every host-app query filters by the resolved customer | API tests ✅ |

One more guard, proven live: **an ongoing outage cannot spam the merchant.** A second run against the same
failing record found the state key `alert:{customerId}:{orderId}:{workflow}` and sent no second alert.

Host app checks: 12/12 browser checks (N1–N7 plus extras) and a WCAG contrast audit passing in both themes
(exit 0, 26 pairs). The 26 API tests passed against a local MongoDB but currently fail against Atlas — a
parent hook fails and the children cancel. Not yet root-caused, and flagged rather than claimed green.

**Verification report:** [`evidence/verification-report.md`](evidence/verification-report.md) — verdict,
parity audit, T1–T9, the three defects found and fixed, and a blocker checklist.

## 5. How Fastn MCP built it

Built by Claude driving the Fastn gateway with the `integration_builder` skill (v21). Every prompt is
logged verbatim in [`evidence/prompts.md`](evidence/prompts.md), with screenshots in
[`evidence/screenshots/`](evidence/screenshots/).

| Phase | MCP tools | Result | Evidence |
|---|---|---|---|
| Connections | `createConnectLink`, `listConnections`, `runWorkflowCode` | 3 ACTIVE (Shopify, Sheets, Mailjet), each proven by a real read rather than an ACTIVE flag | entries 03–08 |
| PLAN | `listConnectors`, `listConnectorEvents`, `getConnectorMethods` | `orders/paid` confirmed; Gmail dead-ended, switched to Mailjet; the 403 scope gap found here, not at build time | entries 03–08 |
| MAP | `probeConnector` ×2, `proposeConfiguration` | 163 Shopify fields, 12 sheet columns → **`cfg_910772de96ce`**, approved in the browser | entry 09 |
| GATE | `createTestCaseDraft`, `getTestCaseDraft` | **25 cases approved unedited** (`tcr_0cb01316d8f7`) | entry 10 |
| BUILD | `runWorkflowCode`, `createWorkflow`, `setWorkflowConnectorScope`, `testSavedWorkflow`, `editWorkflowCode` | Both flows published; every write path probed live before any code was saved | entries 10–11 |
| Triggers + widget | `bind_app_trigger`, `bind_schedule_trigger`, `createWidget`, `updateConfig` | Both bound; widget **`wgt_d1f67a4d76b3`** with the config linked | entry 11 |
| Debug loop | returned value → diagnosis → `editWorkflowCode` → regression gate → re-run | **Three real defects found and fixed** | entries 10–11 |
| VERIFY | `triggerSchedulerNow`, `listWorkflowExecutions`, `saveWorkflowValidation` | Fire-and-correlate proven; the cron then fired **unattended** and completed | entry 11 |

**The three defects the MCP loop caught.** Every one of these runs returned HTTP 200, so a status-code check
would have passed all three:

1. **Every real order was silently filtered out.** The review page saves conditions as strings
   (`test equals "false"`); Shopify sends `test: false` as a boolean. Strict comparison meant nothing ever
   synced while the run reported healthy. Bound to a schedule, it would have no-opped forever.
2. **`USER_ENTERED` wrote `#ERROR!` into phone numbers.** A leading `+` is parsed as a formula, so
   `+92 300 1234567` was corrupted — silently, in the supplier own sheet, for essentially every
   international order. Both flows now write `RAW`.
3. **Flow A erased supplier data.** Rebuilding the row wrote empty buyer cells over filled ones whenever
   Shopify had no customer attached. Guarded: a blank never replaces a filled cell.

Each fix re-armed the platform `regressionGate` and the suite was re-run and re-persisted before the change
was accepted. Validations are recorded honestly: **12 pass, 3 partial, 9 skipped each with a stated
reason** across both flows. No case was marked pass on a 2xx.

**What we corrected by hand:** the kickoff was rewritten as P2-R to carry the already-known 403 scope gap so
the agent would not rediscover it at MAP; the config was linked to the widget with `updateConfig` after
`createWidget` left it unattached (the skill calls an unlinked config a build failure); and the
`appBaseUrl`/`callbackSecret` gap was surfaced as a blocker rather than papered over with a placeholder,
per BUILD step 3.

## 6. Limitations and next steps

- The demo identifies the merchant by URL (no sign-in) and the deployment is plain HTTP, so the callback secret
  travels unencrypted; real sign-in and TLS (CloudFront or a domain with a certificate) are the first
  post-hackathon work. `/setup` guides the one demo workspace and does not create new merchants; on a live
  workspace it is a read-only walkthrough. The Rules tab was cut.
- Connection cards show only what callbacks prove until we confirm whether the widget reports connection status.
- **Order-to-row latency is seconds, after moving both flows to Fastn's `instant` tier.** On the standard tier, three
  real `orders/paid` deliveries took **162 s, 181 s and 343 s** from payment to sheet row, almost all of it queue wait
  (73 to 135 s on scheduled ticks too). After the switch, three real orders took **6.2 s, 7.5 s and 7.6 s** (Shopify's
  webhook timestamp to the run completing; executions `exec_84dd8ae33fd1`, `exec_99c3d6c1d8e6`, `exec_b6d39a070440`), so
  the PRD target of under 60 s is met. Fastn caps the instant tier at 30 s per run; ours take about 5 s.
- **Buyer data depends on the connection type.** Fastn's stock Shopify login (OAuth) requests no customer scope, and
  Shopify also gates customer names, emails, phones and addresses behind protected-customer-data access, so through it
  the `orders/paid` data arrived with those fields blank. We replaced it with an **API Key** connection using a token
  from an app we own on the store (`read_customers` plus protected customer data). With it, the API returns name, email
  and phone, and a Flow A run filled rows #1004 and #1005 with Shopify's values. Two limits remain: orders with no
  customer attached (draft orders often have none) have nothing to read, and the sample orders' street address fields
  are empty in Shopify, so address parsing is unproven. The token is short-lived if issued by the client-credentials
  grant, and needs re-issuing.
- **Email deliverability is unproven.** Mailjet accepts every message (all 8 sent show status `sent`), but the sender
  address is on `seecs.edu.pk`, a domain we do not control, and Mailjet reports SPF and DKIM as failing for it. The
  domain's DMARC policy is `quarantine` and its mail is hosted on Google Workspace, so messages sent through Mailjet are
  likely to be filed as spam. Fixing it needs a sender on an authenticated domain, DNS records added by the domain owner,
  or a different sending route (a mailbox provider's own connector). Until then, check spam when testing.
- **No Shopify write-back**, per the scope gap in section 3.
- Next: restock inventory and notify the buyer on cancel or full refund; a second buyer channel (WhatsApp).
