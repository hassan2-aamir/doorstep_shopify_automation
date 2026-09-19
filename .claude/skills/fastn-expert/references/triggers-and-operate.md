# Triggers, operations, errors

Contents: choosing a trigger, per-type settings, when Fastn disables things, debugging order, Activity pages, alerts, error vocabulary, known product defects.

## Triggers

A workflow with no trigger only runs when something calls it. Integrations, Triggers has three sub-tabs (Webhooks, Schedulers, App events) and a status select. A trigger you just created may be on a later page (30 total, paginated), not missing. "Schedule", "Schedulers", "Scheduled triggers" and "Scheduler" are all the same thing.

| Type | Reach for it when |
| --- | --- |
| **Webhook** | The sender can push and you want it immediate |
| **Schedule** | Nightly reconciliation, hourly pulls, anything time-based |
| **App event** | A change in a connected system and the connector supports events (cleanest: no URL to hand out, no polling, Fastn manages the upstream subscription) |

Clicking a row opens a side panel with **Details**, **Retry policy**, **Status history** (last 20 changes, automatic ones marked) and **Trigger Now**, **Edit**. Disabling a trigger stops firing without losing configuration, better than deleting while you fix a workflow.

### Webhook

- Fields: Name, Description, Routes (required; each route names a Workflow, an Environment, optional Headers), delivery attempts (**Max attempts** 1-10 default 3, counting the first try; **Backoff** Exponential default, Linear, Fixed).
- Advanced: Webhook ID (part of the public URL), **Authentication** (`API Key (x-fastn-access-key)` default, or `None (public)`), **Execution mode** Parallel (default) or **Sequential** (one at a time, in arrival order), **Deduplication key** (payload field identifying each event).
- Row menu: Copy URL, **Copy as cURL** (fastest way to fire one by hand), Disable, Edit, Delete.
- After attempts are exhausted the event is recorded as failed; replay it from Activity, Events. Events has no status filter, only source (All, Webhook, Scheduled, Manual): search by trigger name and look for a status other than Delivered.
- Public webhooks: only when the sender cannot set a header, and pair with a dedup key and payload validation. **Sequential mode plus a dedup key is what makes a webhook-driven sync idempotent.** Set them up front.
- Fan-out: several routes on one trigger run independently.

### Schedule

- Modes: Interval (default; every n minutes/hours/days), Daily (default 09:00), Weekly, Monthly (one day 1-31), Custom (5-field cron). Whatever the mode, Fastn stores a cron expression (`0 6 * * *`).
- **Timezone** is required and defaults to your browser's (not the org's, not your profile's). Every time on the form is interpreted in the timezone you pick.
- Route field **Payload (JSON)** becomes `ctx.input`. Other options: Starts at, **Run immediately on create**, Scheduler ID, **Delay (minutes)**, **Keep failed deliveries**, **Trigger Now**.
- **Auto-disable**: a schedule trigger that keeps failing is disabled by the platform. **Failures** counts consecutive failures and resets on success. A **Re-enable Cooldown** applies; the reason is in Status history. The threshold is not documented, so do not design around a guessed number. If a nightly job silently stopped, read Status history before assuming a teammate turned it off.

### App event

- Form is progressive: Name, Connector (**immutable after creation**), connection gate ("No active connection found for this connector. Connect first to use it as a trigger source."), Connection, Event (with Payload Schema expander, `Registered` or `Not Subscribed`), Routes.
- **Check the Subscription column after creating** (`Subscribed` or `Failed`), separate from Status. `Active` plus `Subscription: Failed` will never fire. Recover with **Retry Subscription**; if it fails again the problem is upstream (connection live? scopes?).
- Connector-level **Webhook config** is what makes app events work for every customer ("until one exists, customers of this connector can be polled but cannot be notified").
- Row menu: Copy ingest URL, Edit, Disable, Retry Subscription, Delete.

## Debugging order

When someone says "it stopped working", walk down, not around:

| Step | Look at | Answers |
| --- | --- | --- |
| 1 | **Events** | Did the event arrive at all? If not: upstream or trigger problem |
| 2 | **Executions** | Did a run start and how did it end? Failed, Timeout, Cancelled each point elsewhere |
| 3 | **Traces** | Which external call failed or hung? (Pending = upstream accepted and never answered) |
| 4 | **Sync reports** | Run succeeded but data is wrong: what did it actually write? |
| 5 | **Connections** | Calls rejected: is the credential alive? Search by customer, not the status chips |

Symptom shortcuts: nothing happened (Events); ran but ended badly (Executions, Error tab); succeeded but data wrong (Sync reports); slow (Traces); worked yesterday not today (Connections, then Pending updates); one customer affected (Connections for that customer, also check version pins).

### Nothing ran

- No event in log: webhook, wrong URL or missing `x-fastn-access-key`; schedule, trigger Disabled or timezone assumed wrongly (filter Events by Scheduled; zero is the answer); app event, no Webhook config or no active connection.
- Event Delivered but no execution: workflow never published (likeliest), workflow disabled, or the route points at an environment with nothing deployed (point at `test` or deploy).
- Event never Delivered: attempts exhausted; fix cause then Replay.

## Activity pages

| Page | Route | Notes |
| --- | --- | --- |
| Events | `/activity/events` | Inbound arrivals with Replay (re-runs for real). Auto refresh off by default. One event can yield several executions when fanned out |
| Traces | `/activity/traces` | One trace per run that calls a connected system. Filters All, Success, Error, Pending. Look here before raising a timeout |
| Alerts | `/activity/alerts` | See below |
| Executions | `/activity/executions` | Run history. Filter by date, status (Pending, Queued, Running, Completed, Failed, Timeout, Cancelled), workflow. Row expands inline: result banner, raw response, chips (Steps, Success, Error, Slowest), tabs Summary, Input, Output, Error. Footer gives `exec_...` and `wf_...` ids to quote to support. Summary keys `totalSteps`, `slowestMs`, `peakSandboxMB` |
| Sync reports | `/activity/sync-reports` | Produced only when a workflow runs `fastn.diff.compare`. Distinguishes "filtered out" from "never seen". Ask the agent to add diff reporting up front |

The per-workflow Executions tab filters by HTTP status pills (200, 201, 400, 404, 422, 500), the workspace page filters by run status.

## Alerts

- **Turn on failure alerts** creates two alerts in one click (email on failure, daily reliability check) and is the cheapest insurance in the product. Empty state names the destination (your sign-in email).
- Editor autosaves; **New alert** creates an `Untitled alert` (Paused, no recipients) immediately. Delete accidental ones from the row.
- "Alert when": a run fails (instant), or a metric crosses a threshold (default; evaluated every 15 minutes). Defaults: Error rate is above 5 (percent) over 24 hours. Metrics: Error rate, Success rate, Failed runs, Total runs, Records synced, Records failed, Avg run time, p95 run time, Broken connectors, Inactive workflows. Windows: 1 hour, 24 hours, 7 days, 30 days. **Mind the unit**: switching the metric to Failed runs makes the same 5 mean five runs, not five percent.
- Deliver to Slack (incoming webhook URL), Email, or Webhook (HTTPS). No recipients means nobody is notified. Firing history shows real signal vs a threshold set too tight.
- Starter set: a run fails to email+Slack; error rate above 5% over 1 hour; total runs below 1 over 24 hours on a daily sync; broken connectors above 0.

## Errors and failure vocabulary

Click the failed row: the **Error tab** leads with Category chip, Severity chip, plain-language headline, **Failed at** (`connector.<slug>.<action>`, step n of m), **AI Diagnosis** (WHAT HAPPENED, WHY, HOW TO FIX) and **Error Details** (raw message). Read diagnosis first, raw second; rate the diagnosis.

- **Dependency Error**: the workflow ran but something it called (nearly always a connector action) refused. Runs die fast. Causes in order: connection Expired or Failed; connection pinned and no longer usable or belongs to another org; customer never connected; missing scope; upstream API changed (Pending updates). It does not retry and does not fix itself.
- **Failed vs Timeout**: Failed means something was wrong, Timeout means the clock ran out. Do not raise the timeout on a Failed run.
- **Out of memory**: reads as Failed with no obvious error; never retries.
- API error envelope: `{"error": {"code", "message", "details", "retryAfter"}}`. Branch on `code`, never on `message`. `retryAfter` (seconds, also `Retry-After` header) on throttles.
- Codes: shared `AUTH_INVALID` 401, `AUTH_EXPIRED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `VALIDATION_ERROR` 400, `CONFLICT` 409, `RATE_LIMITED` 429 (honour retryAfter), `QUOTA_EXCEEDED` 429 (waiting will not clear it), `PAYMENT_REQUIRED` 402, `PAYLOAD_TOO_LARGE` 413, `INTERNAL_ERROR` 500 (retry once, then report), `SERVICE_UNAVAILABLE` 503, `UPSTREAM_ERROR` 502, `TIMEOUT` 504. Connector `CONN-AUTH-FAILED`, `CONN-REFRESH-FAILED` (reconnect; will not recover alone), `CONN-EXEC-FAILED`. Workflow `WF-EXEC-FAILED`, `WF-TIMEOUT`. Agent `AGT-LLM-ERROR`, `AGT-TIMEOUT`. Unified `API-UNIFIED-*` (NO-PROVIDER 404, MULTIPLE-PROVIDERS 409, PROVIDER-RATE-LIMITED 429 and so on). Events `EVT-WEBHOOK-AUTH-FAILED`, `EVT-WEBHOOK-DELIVERY-FAILED`. Older flat names (`CONNECTOR_AUTH_FAILED`, `WORKFLOW_TIMEOUT`, `UNIFIED_*`) are still returned by some paths and mean the same. Fastn publishes no complete error-code catalogue.
- `WORKFLOW_NOT_PUBLISHED`: no snapshot ever published; the most common cause of "the API did nothing". A workflow that runs and throws is a **Failed execution, not a transport error**: the HTTP call may succeed, so look in Executions.
- Embed: `fastn:session-expired` posted to the parent window = 7-day refresh cap hit, mint a fresh token. Blank widget = usually expired or hard-coded token.

## Do once and save yourself later

Turn on failure alerts. Add "Broken connectors above 0". Add "Total runs below 1 over 24 hours" on every scheduled sync. Set a dedup key on every webhook. Add `fastn.diff.compare` to every sync. Set a per-customer rate limit and IP allowlist on keys used by embeds.

## Known product defects (route around them)

Connections status chips (Active, Inactive, Expired, Failed) return nothing for every state. A connector shows Connected in the list but 0 connections on its detail page. `Created: Invalid Date` on a connector Overview. Trash, Actions tab hangs on "Loading deleted actions". The catalogue count (for example 354) counts entries, not distinct systems: Asana, HubSpot, Salesforce, Slack, Notion and Cin7 Core each appear twice (managed and Custom), so check the badge before authorising the copy you meant. Provenance strings are worded three ways.
