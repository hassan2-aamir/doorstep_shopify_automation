# Acceptance test results

| # | Test | Pass condition | Result | Evidence |
|---|---|---|---|---|
| T1 | Place 1 paid test order | Exactly 1 sheet row with right buyer, address, items within 60 s | 🟡 **partial** | Flow A run returned `created=1, updated=0, skipped=0, errors=0`; row at `Fulfillment!A2:L2` with col A=`7340851429664`, B=`1001`, C=created_at, H=`1 x Selling Plans Ski Wax`, I=`New`. **Buyer/address columns empty** because the store's only order is a draft with `customer: null` — needs a real checkout order |
| T2 | Replay the same order event | Still 1 row; run returns skipped 1, errors 0 | ✅ | Re-ran the same input: `created=0, updated=0, skipped=1, errors=0`; sheet still exactly one data row, cells unchanged |
| T3 | Edit the order | Same row updates; no second row | ⬜ | Update path built (merge preserves supplier columns J–L) but not exercised — needs an order edit in Shopify |
| T4 | Add a tracking number | Shopify fulfillment with that number + 1 buyer email within 5 min; row Notified | ✅ | `updated=1, errors=0`; Mailjet 200 `Status=success`, subject 'Your order #1001 has shipped' carrying UPS + `1Z999AA10123456784` + tracking link; row `I2:L2 = [Notified, 1Z999AA10123456784, UPS, 2026-09-19T10:31:27.699Z]`. **Shopify fulfillment intentionally skipped** (`shopifyWriteBack=false`) |
| T5 | Re-run Flow B, force a retry | No second email | ✅ | `skipped=1`; **no `sendEmail` in the trace**; `notified_at` unchanged. Guard `notify:self:7340851429664` short-circuits before the send |
| T6 | Disconnect the sheet on purpose | Failure in Sync health with step + reason; alert email arrives | 🟡 partial | Proven for `errorKind: data` instead: `errors=1`, step `send_buyer_email`, **one** alert email sent, and a re-run sent **no second alert** (guard `alert:self:...`). The connection-outage variant was not run — it would have broken the working demo state |
| T7 | Reconnect and replay | Failed order completes, no duplicate | 🟡 partial | Substance proven: the failed record completed with `errors=0` and no duplicate row or email once the buyer email was supplied. Not via a disconnect/reconnect |
| T8 | Change a config rule | Next run reflects it, no code change | ⬜ | Flow reads `fastn.config.get(cfg_910772de96ce)` every run; trace confirms the live read. The edit-and-rerun proof is still owed |
| T9 | Fire each trigger for real | Completed execution confirmed by its event id | ✅ | **Schedule ✅**: run-now `sched-evt_665adc8cf005` → `exec_e356678864cd` **completed 200** (1839 ms); the cron then fired **unattended**, `sched-evt_c448218cb9cc` → `exec_460b950abab6` **completed 200** (2082 ms), and has kept firing every 5 min (22 runs, 16:00 → 17:45 PKT, all carrying the schedule trigger id, 0 consecutive failures). **App event ✅** (proven 19 Sep 17:50): `orders/paid` fired for real three times, subscription `ACTIVE`: #1002 → `exec_705f59d79ecd` (`evt_faf99c058aa8418f`), #1003 → `exec_00fafff60319` (`evt_263e222aa74e435c`), #1004 → `exec_0a9d69385da5` (`evt_b98426c737fa448e`); each **completed 200**, `created=1, errors=0`, carrying `x-shopify-topic: orders/paid` and `x-fastn-trigger-id: 99102bca-…` |

## Order-to-row latency (PRD metric, target under 60 s): not met

Measured on the three real `orders/paid` deliveries, from Shopify's own `x-shopify-triggered-at` header to the execution's `completedAt`:

| Order | Event reached Fastn | Waited in the queue | Run took | **Payment to row** |
|---|---|---|---|---|
| #1002 | 42.6 s | 117 s | 2.1 s | **161.6 s** |
| #1004 | 12.2 s | 164 s | 4.6 s | **181.0 s** |
| #1003 | 43.6 s | 298 s | 2.1 s | **343.4 s** |

The event delivery is fast and the run itself is 2–5 s. The delay is the **standard execution tier's queue**. Both flows are `executionTier: standard`; moving them to `instant` (well inside its 30 s cap at these run times) is the untried fix. Until then the honest figure is 2.7 to 5.7 minutes, not "within a minute". Three samples only.

### After moving both flows to `instant` (19 Sep, 13:40 to 13:45 UTC)

| Measurement | Standard tier (before) | Instant tier (after) |
|---|---|---|
| Flow B scheduled ticks, created to started | 105 s, 73 s, 135 s (the 13:25, 13:30 and 13:35 UTC ticks) | run-now `exec_cc5a34c7fe86`: created 13:41:16.151, started 13:41:16.176, so **25 ms** |
| Flow B run duration | 4.6 to 5.1 s | 4.4 s |
| Flow A (`orders/paid`) payment to row | 161.6, 181.0, 343.4 s | **6.2 s (#1005), about 7.5 s (#1006), 7.6 s (#1007)**: Shopify `x-shopify-triggered-at` to the execution's `completedAt` (`exec_84dd8ae33fd1`, `exec_99c3d6c1d8e6`, `exec_b6d39a070440`). Target under 60 s: **met** |

Both paths are proven fast. The order path went from minutes to about 7 seconds.

## Live buyer-data check (T1 and T3 stay partial)

Orders #1002–#1004 are all Shopify **draft orders** (`source_name: shopify_draft_order`, gateway `manual`) created without buyer details: #1002 and #1003 have `customer: null`; #1004 has a customer stub (`state: disabled`) with no email, name or phone and a shipping address holding only the country. So the buyer-field mappings are **still unverified**, and this does not show whether Shopify withholds buyer data from this app. An order created with a customer email and a full address is the only test that answers it.

## Flow B

Built: `wf_a51624da9db1`, published, MULTI_TENANT, 9 approved cases attached, schedule bound at `*/5 * * * *`.

## What the build proved beyond the table

| Finding | How |
|---|---|
| The Sheets write path works end to end | Live write probe: real order → approved mappings → `appendValues` 200 → read-back field-exact → `clearValues` cleanup |
| `id` and `order_number` are not swapped | TC-07 read-back: col A === `String(order.id)`, col B === `String(order.order_number)` |
| A null `sku` is tolerated | The store's only line item has `sku: null`; the items cell rendered via the title fallback, never `null`/`undefined` |
| A missing callback target degrades safely | `envConfig.get("appBaseUrl")` → null and `secrets.get("callbackSecret")` → "Secret not found", yet the run returned `errors=0` with the row written |
| Sheets trims trailing empty cells | `getValues` returned 9 elements for a 12-column row — Flow B pads before indexing, or `status`/`tracking_number` read `undefined` |
| `USER_ENTERED` corrupts phone numbers | Writing `+92 300 1234567` stored **`#ERROR!`** — a leading `+` is parsed as a formula. Both flows now use `RAW` |
| Flow A would erase supplier data | Rebuilding the row wrote empty buyer cells over filled ones when Shopify has no customer. Guarded: a blank never replaces a filled cell |
