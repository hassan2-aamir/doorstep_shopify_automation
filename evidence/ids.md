# Doorstep ids

Fill these in as Track A produces them. Everything downstream (README, submission doc, host app `.env`)
reads from here, so keep it current.

| What | Value | Where it came from |
|---|---|---|
| Fastn org id | `personal_c22c5878e2b772232955` (verify: team org?) | `whoami` |
| Fastn customer (end-org) UUID | `0b55acb5-45f5-4ff1-9ba9-6fa3070becb2` ("Sara's Threads") | Settings → Customers |
| Host app customer `_id` | `6aae2b2f46dea1226fb4d72c` (now points at the real Fastn customer above) | `npm run seed` output |
| Google Sheet URL | https://docs.google.com/spreadsheets/d/16AtFOhwfUdv435lIZoGhPKGJpJOOPf54oqqUGH6liQI (id `16AtFOhwfUdv435lIZoGhPKGJpJOOPf54oqqUGH6liQI`) | Browser |
| Shopify dev store domain | `apparelstore-fp2czfal.myshopify.com` | Shopify admin |
| Shopify connector id / slug | `5b763533-552a-4be9-8aea-69dbd2d9bc2b` / `shopify` (status: test) | `listConnectors` |
| Shopify connection id | `ucl:personal_c22c5878e2b772232955:default:5b763533-552a-4be9-8aea-69dbd2d9bc2b:fb090b4e-f1f1-42bb-94b0-acf887541af2` (ACTIVE, personal org, verifyStatus null) | `listConnections` |
| Google Sheets connector id / slug | `38d254e2-b92e-44f4-81cd-8251fd9373d9` / `googleSheets` | `listConnectors` |
| Google Sheets connection id | `ucl:personal_c22c5878e2b772232955:default:38d254e2-b92e-44f4-81cd-8251fd9373d9:fb090b4e-f1f1-42bb-94b0-acf887541af2` (ACTIVE, personal org, verifyStatus null) | `listConnections` |
| Gmail connector id / slug | `ec3c1b4a-e281-4c5e-9a6b-90eb4a59882f` / `googleGmail` | `listConnectors` |
| Gmail connection id | none: Gmail sign-in failed, switching email connector | `listConnections` |
| Email connector (replacement) | Outlook Mail `8ad1274d-7474-47e9-98bf-b88fe66d348f` first; Mailjet `14a50f94-a154-46ca-abd1-faac4db7fbb9` fallback | `listConnectors` |
| Config id (`configId`) | | `check_config_status` |
| Config template id | | `check_config_status` / widget |
| Test-case set id | | `submit_test_cases` |
| Flow A workflow id / slug | / `orders-to-fulfillment` | `create_workflow` |
| Flow B workflow id / slug | / `tracking-to-shopify-and-buyer` | `create_workflow` |
| Flow A trigger id + type | | `bind_app_event_trigger` / webhook |
| Flow B trigger id (schedule, 5 min) | | `bind_schedule_trigger` |
| Widget id ("Shopify Orders") | | `create_widget` |
| Tunnel URL (`appBaseUrl`) | | `npm run tunnel` |
| T1 execution id | | `list_executions` |
| Failed execution id (debug loop) | | Error tab |
| Workflow links for submission | | Dashboard |
