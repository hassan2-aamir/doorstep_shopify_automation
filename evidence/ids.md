# Doorstep ids

Fill these in as Track A produces them. Everything downstream (README, submission doc, host app `.env`)
reads from here, so keep it current.

| What | Value | Where it came from |
|---|---|---|
| Fastn org id | `personal_c22c5878e2b772232955` (verify: team org?) | `whoami` |
| Fastn customer (end-org) UUID | `0b55acb5-45f5-4ff1-9ba9-6fa3070becb2` ("Sara's Threads") | Settings → Customers |
| Host app customer `_id` | `6aae627970768d336523f41a` (re-seeded 19 Sep against Atlas) | `npm run seed` output |
| Google Sheet URL | https://docs.google.com/spreadsheets/d/16AtFOhwfUdv435lIZoGhPKGJpJOOPf54oqqUGH6liQI (id `16AtFOhwfUdv435lIZoGhPKGJpJOOPf54oqqUGH6liQI`) | Browser |
| Shopify dev store domain | `apparelstore-fp2czfal.myshopify.com` | Shopify admin |
| Shopify connector id / slug | `5b763533-552a-4be9-8aea-69dbd2d9bc2b` / `shopify` (status: test) | `listConnectors` |
| Shopify connection id | `ucl:personal_c22c5878e2b772232955:default:5b763533-552a-4be9-8aea-69dbd2d9bc2b:fb090b4e-f1f1-42bb-94b0-acf887541af2` (ACTIVE, personal org, verifyStatus null) | `listConnections` |
| Google Sheets connector id / slug | `38d254e2-b92e-44f4-81cd-8251fd9373d9` / `googleSheets` | `listConnectors` |
| Google Sheets connection id | `ucl:personal_c22c5878e2b772232955:default:38d254e2-b92e-44f4-81cd-8251fd9373d9:fb090b4e-f1f1-42bb-94b0-acf887541af2` (ACTIVE, personal org, verifyStatus null) | `listConnections` |
| Gmail connector id / slug | `ec3c1b4a-e281-4c5e-9a6b-90eb4a59882f` / `googleGmail` | `listConnectors` |
| Gmail connection id | none: Gmail sign-in failed, switching email connector | `listConnections` |
| Email connector (replacement) | Outlook Mail `8ad1274d-7474-47e9-98bf-b88fe66d348f` first; Mailjet `14a50f94-a154-46ca-abd1-faac4db7fbb9` fallback | `listConnectors` |
| Config draft id | `cdr_5aa939576171` (pending approval) | `proposeConfiguration` |
| Config id (`configId`) | **`cfg_910772de96ce`** (approved 15:30) | `getConfigDraft` |
| Widget id ("Shopify Orders") | **`wgt_d1f67a4d76b3`** (slug `shopify-orders`, active; config linked) | `createWidget` + `updateConfig` |
| Source probe id | `probe_1d70b9c2-8862-4036-97f3-bc95312dd903` (shopify / list202004OrdersJson, 163 fields) | `probeConnector` |
| Target probe id | `probe_cc3184c0-41c6-42aa-a992-b3943b4313ab` (googleSheets / getValues, 12 fields) | `probeConnector` |
| Mailjet connector id | `14a50f94-a154-46ca-abd1-faac4db7fbb9` (ACTIVE, BASIC auth) | `listConnections` |
| Callback secret | host app: `app/server/.env`; Fastn: org secret `CALLBACK_SECRET` (`sec_61b3beb3d241`, created 16:24). Values are never committed | `listSecrets` |
| Test-case set id | `tcr_0cb01316d8f7` (25 cases, approved unedited) | `createTestCaseDraft` |
| Flow A workflow id / slug | **`wf_9406750cbc34`** / `orders-to-fulfillment` (dev version 6, MULTI_TENANT; validation stale) | `createWorkflow`, `listWorkflowVersions` |
| Flow B workflow id / slug | **`wf_a51624da9db1`** / `tracking-to-shopify-and-buyer` (dev version 4, MULTI_TENANT; validation stale) | `createWorkflow`, `listWorkflows` |
| Flow A trigger id + type | **`99102bca-8259-461c-b0bb-b3c32c5d3f50`** — Shopify app event `orders/paid` | `bind_app_trigger` |
| Flow B trigger id (schedule, 5 min) | **`72d331d9-26c3-49d0-962c-e33564b0892c`** — cron `*/5 * * * *`, Asia/Karachi | `bind_schedule_trigger` |
| Host app URL (`appBaseUrl`) | `http://doorstep-prod.eba-bf4y27m3.us-east-1.elasticbeanstalk.com` (AWS Elastic Beanstalk, **plain HTTP**; env config `appBaseUrl`, env `test`, set 16:23) | `getEnvConfig` |
| Env config `defaultCustomerId` | `0b55acb5-45f5-4ff1-9ba9-6fa3070becb2` (env `test`, set 16:26) | `listEnvironmentConfigs` |
| Repo | https://github.com/hassan2-aamir/doorstep_shopify_automation | `git remote -v` |
| Orders fired by `orders/paid` | #1002 `exec_705f59d79ecd` (`evt_faf99c058aa8418f`) · #1003 `exec_00fafff60319` (`evt_263e222aa74e435c`) · #1004 `exec_0a9d69385da5` (`evt_b98426c737fa448e`) | `listWorkflowExecutions` |
| Schedule fire event ids | run-now `sched-evt_665adc8cf005` -> `exec_e356678864cd` (completed 200); unattended `sched-evt_c448218cb9cc` -> `exec_460b950abab6` (completed 200) | `triggerSchedulerNow`, `listWorkflowExecutions` |
| Mailjet sender | `haamir.bscs23seecs@seecs.edu.pk` (Active) | `listSender` |
| Workflow links for submission | | Dashboard |
