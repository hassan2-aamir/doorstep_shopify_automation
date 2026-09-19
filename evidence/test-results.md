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
| T9 | Fire each trigger for real | Completed execution confirmed by its event id | 🟡 partial | **Schedule ✅**: run-now `sched-evt_665adc8cf005` → `exec_e356678864cd` **completed 200** (1839 ms); the cron then fired **unattended**, `sched-evt_c448218cb9cc` → `exec_460b950abab6` **completed 200** (2082 ms). **App event ⬜**: `orders/paid` bound but needs a real order to fire |

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
