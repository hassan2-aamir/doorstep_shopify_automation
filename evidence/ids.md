# Doorstep ids

Fill these in as Track A produces them. Everything downstream (README, submission doc, host app `.env`)
reads from here, so keep it current.

| What | Value | Where it came from |
|---|---|---|
| Fastn org id | `personal_c22c5878e2b772232955` (verify: team org?) | `whoami` |
| Fastn customer (end-org) UUID | `0b55acb5-45f5-4ff1-9ba9-6fa3070becb2` ("Sara's Threads") | Settings → Customers |
| Host app customer `_id` | `6aae2b2f46dea1226fb4d72c` (now points at the real Fastn customer above) | `npm run seed` output |
| Google Sheet URL | | Browser |
| Shopify dev store domain | | Shopify admin |
| Shopify connection id | | `list_connections` |
| Google Sheets connection id | | `list_connections` |
| Email connection id | | `list_connections` |
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
