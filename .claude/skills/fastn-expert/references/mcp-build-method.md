# The gateway build method: PLAN, MAP, GATE, BUILD, VERIFY

Contents: the router and the tenancy axis, prerequisites, each phase, dynamic config, sync design rules, triggers, widget, safety, and how to steer the agent under time pressure.

Distilled from `integration_builder` v16 and its 8 references (`plan`, `mapping`, `test-cases`, `build`, `dynamic-config`, `sandbox`, `workflow-patterns`, `multi-tenancy`). This is an operator's summary. When the official skill is installed, follow it, not this file, and open its reference for the phase you are in. Install steps: `gateway-and-skills.md`.

Workflows here are JavaScript in an isolated V8 sandbox against real third-party APIs. Treat every live call as writing to a customer's production system.

## Pipeline

```
PLAN            MAP                  GATE               BUILD                   VERIFY
discover,       probe real fields,   test cases         workflows that read     fire every trigger,
analyze, ask    propose mappings,    approved in the    the saved config,       read back widget and
business Qs     approve -> configId  browser            test, trigger, widget   config, report
```

Each phase ends at an approval gate: the agent stops and asks. It should never build through one.

## Router: two questions decide the path

- **Q1: does it move data from a source into a target?** Yes means PLAN, MAP, BUILD (2 or 3 connectors; also aggregations and reshapes).
- **Q2: does it carry business rules the user will want to change later** (a filter, a threshold, a routing target, a status or warehouse it selects)? Yes means the values belong in an approved **config**, not in code. Connector count is not the test: "if the user changed their mind tomorrow, would they need an engineer?"
- Single-system with editable rules: a **scoped MAP** (probe once, filter as `conditions`, chosen value set by the user at the review page), then GATE, then BUILD.
- Single-system, no editable rules: GATE, then BUILD, no config.
- A unified entity covers the data: follow the unified skill (`unified-api.md`); prefer `fastn.unified.*` in code.
- "Single-system" must be a confirmed fact (the user named the system or exactly one is connected), never the agent's inference.

## Second axis: whose accounts? (always asked, never inferred)

| | Path A: single-tenant | Path B: multi-tenant |
| --- | --- | --- |
| For | Your own data, internal automation ("sync MY X to MY Y") | A product shipped to your customers ("let MY CUSTOMERS sync THEIR X to THEIR Y", embed, widget) |
| Flow | probe, create_workflow, test, bind trigger, create_widget | probe, create_workflow, `set_connector_scope MULTI_TENANT`, self-install test, propose_configuration, create_widget(configId), publish |
| Manifest | All `SAAS` (do not call `set_connector_scope`) | Per-customer connectors flipped to `MULTI_TENANT`; shared systems stay `SAAS` (mixed scope is normal) |
| Config read | `fastn.config.get(configId)` | `fastn.config.getByTemplate(templateId)` (resolves the customer's clone; `.get` would make every customer read your template) |

The agent pre-selects a recommendation ("customers / embed / widget" means B, no shipping signal means A) but always shows the question. **The widget is created on both paths**; only manifest tuning is Path-B-only. A hackathon "customer-facing solution" is **Path B**.

Multi-tenancy facts: a **connector manifest** (per workflow, auto-built on save by scanning `fastn.connector.<slug>.<action>(` calls) records each connector's scope and connection. An **installation** (`inst_*`) is the per-customer runtime row (target, connections, config). Installations need an existing tenant (end_org): the agent cannot create end_orgs; they arrive via embed onboarding or org management, and the widget's publish auto-creates a default installation for each customer that already has a matching active connection. Connection resolution order: code pin, installation connections, end-org default (`is_default`), manifest SAAS connection, caller org default. `MULTI_TENANT` with no customer context fails on purpose ("must pass x-end-org-id"). More than one connection for a connector: the platform silently uses `is_default`, so the agent must ask; pin on the manifest (`set_connector_scope {scope:"SAAS", connectionId}`), never in saved code. Same logic across several connections: one tenant-agnostic workflow plus one installation per connection with `activationMode: MULTI_CONNECTION`. Test multi-tenant flows with a **self-install**: `create_installation {endOrgId: <your org>, connections}`, `test_workflow {installationId}`, `delete_installation`.

## Prerequisites gate

Workflow tools only USE connectors. If a connector, action, event or connection is missing, stop and fix it via the connector tools (`connector-building.md`), then resume. Never quietly design around the gap (polling because an event is missing, dropping a field because there is no update action).

- **No or broken connection (including a 401/403 at probe or test time): hard stop and tell the user immediately.** Hand over `get_connect_url`; the user enters credentials there, never in chat. Only after surfacing the blocker may work continue in `mockMode` to validate logic, and a live connection is required before shipping.
- Several connectors with similar names and none connected: ask which one, then connect only that one.

## Phase 1: PLAN

Order: understand, recommend, then ask only what is open. `list_connectors`, `analyze_entities` (summaries only), cheap feasibility checks (`get_connector_methods`, `get_action_schema`, `get_connector_events`), at most one bounded recon read (prefer `run_code`, which returns a compact computed summary). Verify entities by data, not by name; an empty entity is a red flag to investigate. **Real time requires an event trigger**: if the source exposes none, an ongoing sync is schedule-only polling, and the latency tradeoff (name the interval) must be surfaced, never silently downgraded.

Ask business questions only, batched in one `AskUserQuestion` call (max 4): which entities, direction and source of truth, initial load vs ongoing vs both, scope filters, and **tenancy (always)**. Technical choices (trigger type, pagination, matching keys, conflict rules) are the agent's. Exception: a schedule's **cadence and run time** is asked when arming it (BUILD step 7).

## Phase 2: MAP

Probe real fields (bounded: limit 1, field projection; prefer the properties/metadata action, then the entity's own list action; target side via its CREATE action). Author plain 1:1 leaf-field mappings (never map a container or array; field-path notation for nested fields; each with `reason` and `confidence`; a required scalar with no match at `confidence: low`; a required array/object reshape is built in code, not mapped). Suggested filter conditions come from real values seen (status, test or demo records, deleted or archived, dates), consolidated with `in` / `not_in`. Prefer dropdown-sourced values over typed literals. **Empty required target fields are never silently skipped**: name them, recommend skip / derive a placeholder (deterministic, probe-grounded, collision-free if used as a key) / fixed default, and let the user pick at the review page.

Ongoing syncs need a matching strategy with at least one natural key and a `searchAction`, even when the strategy is `state_mapping`, as the first-create existence guard so pre-existing target records are updated, not duplicated.

Then **one** `propose_configuration` call for the whole use case (all pairs, both directions in `directions`; per direction the probe ids and connector and action slugs). It returns a `reviewUrl`; the user approves in the browser; poll `check_config_status` for the `configId` (never fabricate it). Keep `integrationScope` exactly `<Source> <Entity> -> <Target> <Entity>` (singular nouns, no qualifiers). Never hand-author `configurationDecisions`. A replaced config mints a **new** `configId`: repoint every flow and re-verify.

## Gate: test cases (every build, config or not)

`submit_test_cases` returns a `reviewUrl`; the user approves the set in the browser before BUILD; the agent builds from the **approved** set returned, never its own. Cases carry a verifiable `pass` outcome and an executable fixture. Details: `verification-and-tests.md`.

## Phase 3: BUILD

Order: discover, list existing state keys and tables (create fresh, workflow-scoped names), confirm read-only env-config keys exist (do not create env configs during build, except write-only keys), **probe every action reads and writes with `run_code`** (real source record through the real mapping, name prefix `fastn-probe-test`, clean up), the approved test set, `create_workflow` (saves and auto-publishes), validate against the cases, bind triggers, create the widget, verify, hand off.

Rules that decide quality:
- Build the whole use case autonomously once cases are approved: decide the order (backfill first, then ongoing), do not stop between flows. Legitimate pauses are live-safety: writing more than a couple of live records, and arming a schedule (ask cadence and confirm in one step).
- **Do not clobber**: `create_workflow` upserts by slug. `list_workflows` first and ask before updating a related existing flow. Default to a fresh unique slug.
- `create_workflow` and `update_workflow` require `inputSchema` (JSON Schema draft 2020-12 with a non-empty `description` on every property, recursively), `testInput`, `testHeaders` (JSON text, at most 64 KB) and `testCases`. Successful non-empty `test_workflow` runs re-derive the contract, so the tested input is the contract. `create_workflow` and `update_workflow` take the complete module (never a diff); use `edit_workflow_code` for small fixes.
- **One execution shape per workflow**: a cursored schedule sync and a single-record event handler are separate workflows, never `if (ctx.input.id) ... else ...`, and never bind a schedule and an app-event trigger to one workflow.
- `ctx.input` controls **scope only** (limit, maxPages, modifiedSince). Mappings, filters and business values live in the config, never in `ctx.input` and never as code literals.
- Live by default: probe small, mock when unsure, clean up, and report un-deletable test records as **orphans** in the hand-off. Never run a batch workflow with empty input (that means a production run, paginate everything); always pass `{limit, maxPages}` bounds.
- The live/mock split is the agent's call: do not ask "sandbox or live?". Treat every account as production.

### Sync design rules (workflow-patterns)

- **Paginate fully.** One page is never all the data.
- **Skip-on-error** per record: catch, push `{sourceId, reason, errorMessage}`, continue. So a run that failed every record still returns 2xx: tests must assert `errors === 0` and a positive outcome on the **returned value**.
- **Return shape**: `{created, updated, skipped, errors, errorDetails}` (or named equivalents).
- **Skip is a diagnostic, not an outcome.** Skips are legitimate only for approved conditions. Reconcile: eligible = created + updated + filter-attributable skips. Zero writes against a non-empty source is a defect to root-cause, not a result to report.
- **Cursor rule**: manual or test runs (explicit `limit`, `maxPages`, `modifiedSince`) use the bounds but never advance the saved cursor; only production runs (empty input) advance it.
- **Cache contract** in `fastn.state` per source id: `{target_id, hash, status: created|updated|skipped|deleted, data}`. An unchanged hash skips the target call but **still writes state** (`status: skipped`). Second run must be cheaper than the first. A vanished source id triggers a target delete from stored `data` and `status: deleted`, not a dropped key.
- **Upsert order**: hash unchanged, skip (write state); `id_map` has a target id, update (on 404/410 fall through); otherwise **search the target by natural key** (found: update and record, else create and record). State is an optimisation to skip the search, never a licence to create blindly. Match by stable ids or indexed natural keys, never display names. When the empty-required policy derives a value, compute it first and use the same value for search and write.
- **Payloads**: build create and update bodies fresh per action (`toCreatePayload`, `toUpdatePayload`); server-set fields are accepted on create and rejected on update.
- **Never hardcode reference data** (account codes, stages, tax rates, folder ids): fetch at runtime.
- **Testability**: batch workflows accept optional `limit` and `maxPages`.
- **Two-way sync**: one workflow per direction, latest-write-wins, external-id map both ways, plus a **loop guard** (a write echoed back must not re-sync).
- **Topology for ongoing sync** per entity pair and direction: a schedule flow (cursored full-then-delta, completeness and reconcile safety net) plus an event flow (single record, latency), separate workflows, both reading the same `configId`. First run without a cursor is the full backfill; split a separate `long` backfill only when the first run will not fit `timeoutMs`.
- **Event-triggered workflows**: the `payloadSchema` from `get_connector_events` **is** `ctx.input`. No wrapper: never invent `ctx.input.data`, `.payload`, `.event` or `.body`. Bound triggers and code branches must be a bijection. `bind_app_event_trigger` can return `manualRegistrationRequired: true` with a `webhookUrl` the user must register at the provider; surface that as a blocker. To live-test an event flow, produce the event yourself (webhook sources: POST the sample payload; brokers: publish to a dedicated catch-all test subscription) and clean up.

### Trigger selection

| Choice | When |
| --- | --- |
| Schedule only | Batch reconcile, no events, completeness over latency |
| Event only | One-record automation where a missed event is acceptable |
| Schedule + event | Ongoing sync: events for latency, schedule for completeness (two workflows) |
| Inbound webhook | Workflow exposed as an HTTP endpoint for external callers |
| None | Callable API, invoked directly |

Every saved workflow is already an HTTP endpoint (`POST .../workflows/{idOrSlug}/execute`); triggers are extra ways to invoke it.

### Widget (one per use case, always)

`create_widget` **exactly once** after all workflows are built, tested, triggered and scoped. Name it for the third-party partner app and entity (for example "Shopify Orders"), not the user's own company and not with words like "Sync" or "Integration". `connectorIds` are the 1-3 connectors the flows touch (exclude the org-domain connector via `get_org_domain`); `workflowIds` all flows; `triggerIds` the bound triggers; `syncDirection`; short `description` and `agentContext` for the embed-side assistant; `configId` when a config exists (that is the binding; the call is idempotent). **Prefer unified**: if a unified entity covers the data, attach exactly one entity via `unifiedEntityIds` or `unifiedRefs` and do not also pass `configId` (`unified-api.md`). Multi-tenant knobs: `lifecycleHooks` (onActivation, onDeactivation, onConfigurationCreated/Change/Delete, each `{workflowId, version?, enabled}`), `activationMode` (`SINGLE_ACTIVATION` default or `MULTI_CONNECTION`), `allowedEndOrgIds` (`null` all, list restricted, `[]` hidden), `status` (`active` default or `draft`). Publishing auto-binds already-connected customers and returns `sync: {installationsTouched, endOrgsCovered}`: report it. Read the widget back with `get_widget` and assert linkage; `list_widgets` should show no sibling for the same use case.

Hand-off: how to test the flow (a bounded manual run, the Activity tab, or the triggering action), how to reach the widget (dashboard Widgets tab, Configure edits mappings and filters that flow into live runs with no redeploy; Embed tab for embedding), and any orphaned test data.

## Dynamic config: the contract between widget and flow

`propose_configuration` to `reviewUrl` to approval to `configId`. The flow reads it every run, so a mapping or filter edit in the widget or dashboard takes effect on the next run with no code change.

```js
const config = await fastn.config.get(CONFIG_ID);            // Path B: getByTemplate(TEMPLATE_ID)
const flows = config.entities ?? config.directions ?? [];     // entities canonical; directions legacy
const dir = flows.find(d =>
  (d.source?.entity ?? d.sourceEntity) === SOURCE_ENTITY &&
  (d.target?.entity ?? d.targetEntity) === TARGET_ENTITY);
for (const record of records) {
  if (!fastn.evaluator.evaluateConditions(record, dir.conditions).pass) { skipped++; continue; }
  const target = fastn.evaluator.applyMappings(record, dir.mappings);
  // ... write target
}
```
Config shape: `entities[]` each with `source:{connector,entity}`, `target:{connector,entity}`, `integrationScope`, `mappings[{id,sourceField,targetField,required,reason}]`, `conditions[{field,operator,value,reason}]`, `actions[]`; top-level `matching`. Condition operators: equals, not_equals, contains, not_contains, greater_than, less_than, is_empty, is_not_empty, in, not_in, matches (regex). Advanced transforms (combine, conditional, fallback, split, ai, fixed value, value mapping) are implemented as plain JS from the config; **never call an LLM at runtime for mapping**; keep the parameters in the config so they stay editable. `fastn.evaluator` maps fields but cannot aggregate, bucket or combine rows: reshapes are code, parameters stay in config.

Cascading dropdowns in the config editor use an `enrich` spec: `{action, connector, valueKey, labelKey, params?, paramDeps?, autoPaginate?}`. `paramDeps` maps action parameter names to sibling field keys (chains and self-references for drill-down; auto-pagination 100 per page, up to 20 pages). `propose_configuration` derives these from `inputContract.required` on lookup actions, so an incomplete `required` array on a connector action breaks cascading dropdowns.

**config vs envConfig**: `fastn.config.get(configId)` holds the integration's mappings and conditions (edited by the customer in the widget); `fastn.envConfig.get(key, env?)` holds static per-environment values (base URLs, limits, flags, derived caches). Not a secret store: secrets go in `fastn.secrets`. Always `await` both (a missing `await` passes a Promise downstream and reads "[object Promise]"). `fastn.envConfig.set(key, value, env?)` upserts from workflow code and needs the executing token to carry `workflows.update`.

## Executing a workflow over HTTP

`POST {orgId}/api/v1/workflows/{idOrSlug}/execute` with `{"input": {...}}`. `?env=` selects code (omitted or `test` = latest published/dev code, a named env = its active deployment, 404 if none). `Idempotency-Key` header dedupes (a repeated key returns the original execution). Instant tier responds `{data: <return>}` plus `X-Execution-*` headers; standard and long respond `202 {data: {executionId, status: "queued"}}`, poll `get_execution`. Multi-tenant form: `POST {ownerOrgId}/api/v1/{resourceOrgId}/workflows/{idOrSlug}/execute`, with `x-fastn-user-id` scoping to one end user's connection. Failures return `errorCategory` and `fixSuggestion`; a thrown user-code error is 422, a timeout 408. (The product docs describe `x-fastn-env` and a different tier ceiling: see `sources-and-conflicts.md`.)

## Steering the agent when time is short

- Say the scope up front (one entity pair, ongoing only, one direction at a time) so PLAN questions collapse to confirmations and the test set stays in the "Small" band (about 15 to 25 cases).
- The approval gates are browser steps (mapping review, test-case review). Budget for them and keep the review URLs open.
- Have connections ACTIVE and test data ready before starting: a missing connection is a hard stop.
- Do not let the agent build a second widget, an extra entity, or extra features. One config, one widget.
- Ask it to close with the verification report (`verification-and-tests.md`): it doubles as submission evidence.
