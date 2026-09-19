# Doorstep — verification report

Produced at the end of PHASE 4 on 19 Sep 2026, against org `personal_c22c5878e2b772232955`, env `test`.
Every claim below is backed by a returned value or a connector trace from a live run. Nothing is estimated.

> **Updated 19 Sep, 17:50.** This report was written at the end of the build. Re-verified since (read-only,
> see the Addendum at the end): the callback target **is now provisioned** and the app event **has fired
> for real**, so two of the blockers below are closed. It also records two new findings: order-to-row latency
> is **2.7 to 5.7 minutes**, not under 60 seconds, and both flows' regression suites are **stale**.

## Verdict

**Both flows are built, published and proven to move real data end to end.** A paid Shopify order becomes
one row in the supplier's Fulfillment sheet; a tracking number typed into that sheet produces exactly one
buyer email and flips the row to Notified. Idempotency holds in both directions: a replayed order does not
duplicate a row, and a second pass does not email the buyer twice.

**The 5-minute schedule is genuinely armed and running unattended** — a cron tick fired on its own and
completed, with no prompting from us.

**Two things are not finished** and are listed as blockers: the callback target is unprovisioned, so the
host app's Sync health receives nothing; and the buyer-field mappings are written but unverified, because
the dev store's only order is a draft with no customer attached.

Three genuine defects were found and fixed during the build. They are described under Failures.

## What's running

| Surface | Id | Evidence |
|---|---|---|
| Config | `cfg_910772de96ce` | Approved at the review page. Read live on every run: each trace shows `config.get` returning the 3 mappings and 2 conditions |
| Widget | `wgt_d1f67a4d76b3` "Shopify Orders" | `active`, SINGLE_ACTIVATION. Readback shows both workflows, both triggers, all three connectors. **Config linked** (`widgetId` set on `cfg_910772de96ce`) |
| Flow A | `wf_9406750cbc34` `orders-to-fulfillment` | Published, code version 3. Retry 3 attempts, exponential backoff |
| Flow B | `wf_a51624da9db1` `tracking-to-shopify-and-buyer` | Published, code version 1. Retry 3 attempts, exponential backoff |
| Flow A trigger | `99102bca-8259-461c-b0bb-b3c32c5d3f50` | Shopify app event `orders/paid`, webhook URL issued |
| Flow B trigger | `72d331d9-26c3-49d0-962c-e33564b0892c` | Schedule, cron `*/5 * * * *`, Asia/Karachi |
| Tenancy | Path B | `shopify` and `googleSheets` are `MULTI_TENANT` on both flows, connection pins cleared. `mailjet` stays `SAAS` by design: the merchant connects their store and sheet, Doorstep sends mail on their behalf |

## Data parity

One order is eligible in the dev store. It reconciles exactly:

| | |
|---|---|
| Eligible under the approved filters | 1 (order `7340851429664`, `financial_status: paid`, `test: false`) |
| Created | 1 |
| Explained skips on later runs | 3 (unchanged record, dedupe_check) |
| Unexplained residue | 0 |
| Sheet data rows | 1 |

Field-exact sample audit, source record to approved mapping to the cell read back:

| Column | Expected | Read back | |
|---|---|---|---|
| A order_id | `String(order.id)` | `7340851429664` | pass |
| B order_number | `String(order.order_number)` | `1001` | pass |
| C created_at | `order.created_at` | `2026-09-19T02:06:43-04:00` | pass |
| H items | line-items reshape | `1 x Selling Plans Ski Wax` | pass |
| I status | fixed value | `New`, then `Notified` after Flow B | pass |
| J/K/L | supplier + Flow B owned | `1Z999AA10123456784`, `UPS`, `2026-09-19T10:31:27.699Z` | pass |

A and B are not swapped, which was the highest-risk silent defect here since both are numeric.

## Acceptance tests

| Test | Result | Evidence |
|---|---|---|
| T1 — paid order becomes one sheet row | partial | `created=1, errors=0`, row read back field-exact. Buyer columns D–G unverified (see Blockers) |
| T2 — replay does not duplicate | **pass** | `skipped=1`, one data row, cells unchanged. Re-asserted on code version 3 |
| T3 — edit updates the same row | partial | The update branch ran and correctly chose skip when nothing differed. A real field change was never made in Shopify |
| T4 — tracking to buyer email + Notified | **pass** | `updated=1, errors=0`; Mailjet 200 `Status=success`; row `I2:L2 = [Notified, 1Z999AA10123456784, UPS, 2026-09-19T10:31:27.699Z]` |
| T5 — never email twice | **pass** | Second run `skipped=1`, **no `sendEmail` in the trace**, `notified_at` unchanged |
| T6 — failure surfaces with an alert | partial | Proven for `errorKind: data`: `errors=1`, step `send_buyer_email`, one alert email sent. The connection-outage variant was not run |
| T7 — recovery without duplicates | partial | The failed record completed with `errors=0` and no duplicate email once the buyer email was supplied. Not proven via a disconnect/reconnect |
| T8 — config change with no code change | partial | The runtime read is proven in every trace. The edit-and-rerun proof is still owed |
| T9 — each trigger fires for real | **pass** (updated 17:50) | **Schedule: pass.** Run-now `sched-evt_665adc8cf005` produced `exec_e356678864cd`, **completed 200**, 1839 ms, `{skipped:1, errors:0}`. The bound cron then fired unattended: `sched-evt_c448218cb9cc` produced `exec_460b950abab6`, **completed 200**, 2082 ms, and has kept firing every 5 minutes. **App event: pass.** When this report was first written it was unproven; `orders/paid` has since fired for real three times (`exec_705f59d79ecd`, `exec_00fafff60319`, `exec_0a9d69385da5`), each `completed 200`, `created=1, errors=0` (see the Addendum) |

## Failures found and fixed

**1. Every real order was being silently filtered out.** The first live run returned `created=0, skipped=1`
at HTTP 200 — which looks like success and is not. The config review page stores condition values as
strings (`test equals "false"`) while Shopify sends `test: false` as a boolean; `fastn.evaluator` compares
strictly, so no order ever passed. Bound to the schedule this would have no-op'd forever while reporting
healthy. **Fixed** by coercing the fields named in conditions before evaluating. Re-run: `created=1, errors=0`.

**2. `USER_ENTERED` corrupted the buyer's phone number.** Writing `+92 300 1234567` stored **`#ERROR!`** in
the sheet, because a leading `+` is parsed as a formula. This would have silently mangled the phone of
essentially every international order. **Fixed** by switching both flows to `valueInputOption: "RAW"`.
Verified: the cell now holds the literal string.

**3. Flow A would erase the supplier's data.** Flow A rebuilds the whole row, so for an order where Shopify
holds no customer the buyer columns computed to empty — and writing that would wipe whatever the merchant or
supplier had typed into the sheet. **Fixed** with a guard that never replaces a filled cell with a blank.
Verified: a re-run left Sara Khan, the email, phone and address untouched and correctly reported `skipped=1`.

All three were caught by asserting the returned value rather than the status code. Each fix re-armed the
platform's regression gate and the suite was re-run before the change was accepted.

## Blockers — a checklist you can act on

- [ ] **Provision the callback target.** `fastn.envConfig.appBaseUrl` is unset and the `callbackSecret`
      secret does not exist (`secrets.get` throws `Secret not found` on every run). Until both exist, no
      callback reaches `/api/sync-events`, so the host app's Sync health stays empty and T6's "Fix it" link
      falls back to placeholder text. The flows degrade correctly rather than failing — that is TC-14,
      proven live — but this is the single highest-value thing left to do.
- [ ] **Fire the `orders/paid` app event for real.** The schedule half of T9 is proven; the app-event half
      is not. The trigger is bound with a webhook URL issued, but `orders/paid` reported `registered: false`
      at discovery, so confirm the subscription reads `Subscribed` and place an order to see it fire.
- [ ] **Note on latency, not a defect.** Standard-tier executions sit in the queue for roughly two minutes
      before running. Both scheduled executions completed cleanly once drained, so nothing is broken — but
      if you want the demo to feel instant, move both flows to `executionTier: instant` (each run takes
      about 2 seconds, well inside the 30 s cap).
- [ ] **Place a real checkout order.** The store's only order is a draft (`customer`, `shipping_address`
      and `billing_address` all null), so the `customer.*` / `shipping_address.*` paths in Flow A are
      written but unverified. This is what turns T1 and T3 green.
- [ ] **Check the Shopify subscription state.** The `orders/paid` trigger is bound and returned a webhook
      URL, but `orders/paid` reported `registered: false` at discovery, so confirm it reads `Subscribed`
      before relying on it.
- [ ] **Optional — enable the Shopify write-back.** The connection still has only 9 scopes and 403s on
      fulfillment orders. Entering a custom-app token under the **API Key** auth method and flipping
      `shopifyWriteBack` turns that step on with no code change.

## Coverage

25 user-approved cases, 16 attached to Flow A and 9 to Flow B.

| | Flow A | Flow B |
|---|---|---|
| Pass | 7 | 6 |
| Partial | 2 | 1 |
| Skipped, with a stated reason | 7 | 2 |

Skips are honest: no mock stubs were authored, and the dev store lacks the data shapes several cases need
(a second line item, a pending order, a test-gateway order). No case was marked pass on a status code.

## Cleanup

No orphan test data. The write probe's row was cleared in the same run that created it. Row 2 of the
Fulfillment sheet is the live demo record, deliberately left in its Notified end state. Every probe email
went to the verified Mailjet sender and never to a third party.

## Next steps

1. Provision `appBaseUrl` + `callbackSecret`, start the tunnel, and re-run Flow A to close TC-13 and light
   up Sync health.
2. Place an order so the `orders/paid` app event fires, closing the other half of T9.
3. Place a real checkout order to close T1, T3 and the buyer-field mappings.
4. Run the disconnect/reconnect beat to close T6 and T7 — the alert machinery underneath it is already proven.

---

## Addendum: re-verified 19 Sep, 17:50 PKT (read-only)

Everything above stands as written at the end of the build. This addendum records what changed since and
what a fresh read of the live platform shows. Evidence: [prompts.md](prompts.md) entries 12 and 13. Nothing
was written to Fastn, the sheet, Shopify or the deployed app.

### Blockers from the checklist above

| Blocker | Now | Evidence |
|---|---|---|
| Provision the callback target | **Closed.** `appBaseUrl` (env `test`) points at the Elastic Beanstalk deployment, org secret `CALLBACK_SECRET` exists, and `defaultCustomerId` is set | `getEnvConfig`, `listSecrets`; `/api/health` 200 |
| Callbacks reach Sync health | **Closed.** The deployed app's 24 h counts read synced 1 · skipped 49 · failed 3; the one success is #1004's `upsert_row` at 17:30:51 | live `/api/sync-events` |
| Fire `orders/paid` for real | **Closed.** Fired three times (#1002, #1003, #1004), each `completed 200`, `created=1, errors=0` | `exec_705f59d79ecd`, `exec_00fafff60319`, `exec_0a9d69385da5` |
| Check the Shopify subscription state | **Closed.** `subscriptionStatus: ACTIVE`, `subscriptionResponse.success: true` | `listAppEventTriggers` |
| Place a real checkout order | **Still open.** All three new orders are draft orders with no buyer details, so the buyer-field mappings remain unverified | test-results.md |
| Standard-tier latency | **Promoted from a note to a finding**, see below | test-results.md |
| Enable the Shopify write-back | Still optional and untouched; 9 scopes, 403 on fulfillment orders | entries 05, 07, 08 |

### New findings

1. **Order-to-row latency misses the PRD target.** Payment to sheet row measured **162 s, 181 s and 343 s**
   on the three real orders (target: under 60 s). Event delivery is 12–44 s and each run takes 2–5 s; the rest
   is the standard tier's queue. `executionTier: instant` is the untried fix.
2. **The regression suites are stale on both flows.** `lastValidation.stale` is `true` on Flow A (dev
   version 6) and Flow B (dev version 4), reason "the workflow code just changed". The version 4–6 edits
   (secret name, UUID guard, per-step `eventId`) ran correctly in production but the full attached suite was
   not re-run and re-saved after them. Per the build skill, an edit is not done until it is.
3. **Three live open issues, all the designed `data` failure.** #1002, #1003, #1004 fail at
   `send_buyer_email` on every 5-minute run because the draft orders carry no buyer email. The behaviour is
   correct (one alert per order, retried each run, never marked Notified) but it means the live Sync health
   is red until an email is supplied.
4. **Flow A's event path re-scans instead of using the payload.** On `orders/paid` it lists the 10 most
   recent orders rather than processing the order in `ctx.input`. Correct today; wasteful, and it can miss an
   order if 10 newer ones arrive before the run starts.
5. **Flow B floods Sync health.** It reports `create_fulfillment` *skipped* for every pending row on every
   run: 23 of the latest 50 events, alongside 23 repeats of the same three failures.
6. **Exposure.** The deployment is plain HTTP, readable without sign-in, and the callback secret crosses the
   internet unencrypted on every callback.

### What is proven now

Both triggers fire for real and complete; the schedule ran 22 times unattended (16:00 → 17:45, 0 consecutive
failures); the app event ran 3 times on real orders; callbacks arrive at the deployed host app and appear in
Sync health; a data failure surfaces once and keeps retrying without duplicate email.
