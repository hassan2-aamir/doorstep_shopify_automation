# Workflows, the sandbox contract, and patterns

Contents: anatomy, the sandbox contract (what exists, what does not), runtime surface, tiers and timeouts, contract and testing, code sketches, patterns, things agents get wrong.

Two sources feed this page and they differ in places: the V2 docs (`reference/workflow-runtime`, `build/patterns`) and the gateway skill's `sandbox.md` (written against the running sandbox). Where they disagree this page says so; the workflow's **Docs**, **Contract**, **API** and **Connectors** tabs beat both. Code below is a **sketch** for reviewing what an agent generated: connector slugs and action names are placeholders (`get_action_schema` gives the real ones). Do not generate TypeScript: workflows are JavaScript.

## Anatomy

```javascript
export default async function (ctx) {
  const { input, headers } = ctx;
  const res = await fastn.connector.hubspot.getContact({ recordId: input.recordId });
  const contact = res.output;                      // ALWAYS unwrap .output
  return { ok: true, id: contact.id };
}
```

- One ES module, default async export, file `<slug>.js`. **No `import` or `require` of any kind** (`fastn` and `Fastn` are ambient globals).
- Return value must match the output contract. Throwing marks the execution **Failed** and retries only where a retry policy is on. A `UserCodeError` surfaces as 422, a timeout as 408 over HTTP.
- The **Diagram** tab (Flow, Sequence, Docs) is generated from the code, read-only.
- The docs disagree on whether the workflow editor autosaves (one page says no Save button; the editor page lists **Save workflow** and **Publish**). Look at the editor. Alerts do autosave, and triggers are created with **Create trigger**. Via the gateway, `create_workflow` saves **and auto-publishes**.

## Sandbox contract (gateway `sandbox.md`)

**What exists**
- `ctx` has **exactly two fields**: `ctx.input` (caller data) and `ctx.headers` (sanitised; auth headers stripped). `ctx.log`, `ctx.secrets` and `ctx.connectors` do **not** exist (the docs' runtime page lists `ctx.connectors`: do not rely on it), and the skill also says `ctx.env` does not exist even though its own `fastn.envConfig` example returns `ctx.env` and says `.get` resolves against it. Use `fastn.envConfig.get(key)` and do not read `ctx.env` yourself; verify on the Docs tab if you need the environment name.
- `fastn.connector.<slug>.<action>(args)` returns `{ output, success, status, error, durationMs }`. **Always unwrap `.output`** (`result.output.results`, never `result.results`): forgetting this is the most common bug. Failed calls throw; use try/catch for graceful fallback.
  - **Pass the action's own argument object directly, never nested under `input`.** `args` is the action's parameters (`$top`, `$select`, `entitySet`, `limit`, `id`), not `ctx.input`. Nesting silently drops every parameter and the call falls back to a bare list against the service root, which times out.
  - **Read `get_action_schema` before the first call** to any action for exact param names, types and the required set. A wrong or missing required arg returns terse errors (a bare timeout, `Missing required input fields`, a silent service-root call). The schema says what to send; a real 2xx proves it works (schemas can be wrong).
  - **Community connectors** (`scope === "community"` in `list_connectors`) are unreachable via the bare form. Declare them: `const fastn = new Fastn({ connectors: { hubspotCrm: { orgId: "managed" } } })`; custom ones use `orgId: "custom"`; declare **every** connector the workflow calls once you use `new Fastn`. Options per connector: `{ orgId, connectionId, version }`. A code-level `connectionId` pin is for throwaway `run_code` probes only, never saved workflows (pin on the manifest with `set_connector_scope`).
- `fastn.state` `.get(key)` / `.set(key, value)` / `.delete(key)`: durable; default ORG scope persists across runs (cursors, id maps, hashes); `{ scope: "INVOCATION" }` resets per run.
- `fastn.db.query("... WHERE x = $1", [v])`: the **workspace** Postgres, `$1` placeholders always, `CREATE TABLE IF NOT EXISTS` allowed, tables persist. Not the DB connector.
- `fastn.cache` (platform Redis, sub-ms): `.get(key, {scope:"PROJECT"})`, `.set(key, value, {ttl, scope:"PROJECT"})` (default TTL 300 s), `.invalidate(key, {scope:"PROJECT"})`. Reference data caches. Distinct from `fastn.connector.redis.*` (the user's own Redis).
- `fastn.secrets.get(name)`: vault secrets. `fastn.files` `.write/.read/.delete/.exists` (text only).
- `fastn.config.get(configId)` / `fastn.config.getByTemplate(templateId)` and `fastn.evaluator` (`evaluateConditions`, `applyMappings`, `applyDefaults`): the runtime-editable integration config (`mcp-build-method.md`).
- `fastn.envConfig.get(key, env?)`, `.set(key, value, env?)` (upsert; needs the `workflows.update` role), `.delete(key, env?)`: static per-environment JSONB values, not secrets. **Always `await`.**
- `fastn.unified.<category>.<entity>.list|get|create` (`unified-api.md`).
- `fastn.diff.compare(...)`: produces a sync report (the docs); without it there is no report.
- `fastn.flow.invoke(slug, input, opts?)` (synchronous, returns the child's value; the child's tier must be at most the caller's) and `fastn.flow.invokeAsync(...)` (fire-and-forget, returns `{executionId}`). `opts.headers` merges over the parent's, auth headers stripped; the child inherits tenant binding and mock mode. Guards: depth at most 5, `invoke` cycle detection, `invokeAsync` has none.
- `fetch(url, opts)` and `console.log/warn/error` (captured in execution logs). `fetch` has a 30 s timeout and returns `{ok, status, statusText, text(), json(), data}`, not a full WHATWG Response. It is a **last resort**: it bypasses connector auth, rate limiting and observability. Fine for calling **your own** backend (for example a status callback) when no connector exists.

**What does not work** (fails at parse or throws at run time): `setTimeout`, `setInterval`, `setImmediate` and any sleep (`await new Promise(r => setTimeout(r, x))` throws, so no retry-with-backoff loops: use the platform retry policy); `require` and `import` (static or dynamic); Node built-ins (`fs`, `crypto`, `http`, `Buffer`, `process`: no `crypto.randomUUID()`, no `process.env`); browser APIs (`XMLHttpRequest`, `WebSocket`, `URL`, `URLSearchParams`, `TextEncoder`, `TextDecoder`).

## Runtime surface in the V2 docs (for cross-checking)

`fastn.connector.<slug>.<action>`, `fastn.unified`, `fastn.db.query(sql, params)`, `fastn.state` (scopes `ORG`, `INVOCATION`), `fastn.secrets.get("UPPER_SNAKE")`, `fastn.envConfig.get`, `fastn.diff.compare`. The docs' Docs tab uses `fastn.connector` (singular) while the Connectors tab describes extracting `fastn.connectors.X.Y(...)` (plural) on save; the gateway skill and the manifest scan use the singular `fastn.connector.<slug>.<action>(`. Confirm the Connectors tab populates on save.

## Tiers and timeouts (sources disagree)

| Tier | Route | V2 docs | Gateway skill |
| --- | --- | --- | --- |
| Instant | Synchronous, inline result | 1 to 30 s, default 30 s | "good for flows up to 60 s" |
| Standard | Queued on Temporal, 202 + executionId | 5 s to 15 min, default 2 min | "up to 15 min" |
| Long | Queued, separate queue | 30 s to 36 h, default 15 min | "up to 6 h" |

The gateway skill adds that wall-clock is governed by the workflow's **`timeoutMs`** (default 120 s, max 6 h), **not** the tier, so a Standard sync looping longer than 2 minutes times out unless `timeoutMs` is set on `create_workflow`. `test_workflow` always runs synchronously regardless of tier: for long bounded tests use `execute_workflow` and poll `get_execution`. Design for the tighter numbers, treat any loop over records as never-instant (choose Standard, size the timeout to the worst case), and read the actual slider range in the Configuration panel.

## Contract and testing

- **Contract tab**: input and output as JSON or Schema; paste an example payload and the schema generates live. Via the gateway, `inputSchema`, `testInput`, `testHeaders` and `testCases` are required on every `create_workflow` and `update_workflow`, and a successful non-empty `test_workflow` re-derives the contract, so the last tested input is the contract.
- **Test tab modes**: Live, Partial Mock, Fully Mock. Gateway `test_workflow` takes `mockMode` and `mockScenarios` (`{"connector.action": "not found"}`), plus `installationId` or `endOrgId` for multi-tenant flows. A mock pass proves logic only and is blind to what the real target rejects.
- **Configuration panel**: Name, Slug (fixed after creation), Description, tier and timeout, Status toggle, **Retry policy** (Max attempts 1-10 default 3, Initial interval 5000 ms, Backoff coefficient 2, Max interval 60000 ms), Escalate on timeout, Publish snapshot, Deploy to environment.
- Retry policy retries **transient** failures only. Code errors, data errors, out-of-memory (default ceiling 512 MB; read `peakSandboxMB` against `sandboxMemoryLimitMB`) and Dependency Errors never retry.
- Execute over HTTP: `POST /api/v1/workflows/{idOrSlug}/execute` with `{input}`; `Idempotency-Key` header dedupes; env selection by `x-fastn-env` header (docs) or `?env=` (gateway skill).

## Code sketches

### Idempotent event handler (webhook or app event)

```javascript
export default async function (ctx) {
  const order = ctx.input;                        // for app events the payloadSchema IS ctx.input, no wrapper
  const customerId = ctx.headers['x-end-org-id'];
  const key = `orders-to-sheet:${customerId}:${order.id}`;   // workflow + customer + record

  const seen = await fastn.state.get(key);
  if (seen) return { created: 0, updated: 0, skipped: 1, errors: 0, errorDetails: [], reason: 'already_processed' };

  // ... destination call, e.g. const res = await fastn.connector.googleSheets.appendValues({ ... });
  // (slug and action names: check the Connectors tab / get_action_schema; always unwrap res.output)

  await fastn.state.set(key, { processedAt: new Date().toISOString(), status: 'created' });  // after the side effect
  return { created: 1, updated: 0, skipped: 0, errors: 0, errorDetails: [] };
}
```

Pair with a **deduplication key** on the webhook trigger and, if two events for one record can race, **Sequential** execution mode. Verify the guard under a real **Replay**. If the side effect succeeds and the state write fails, the retry duplicates: for spreadsheet destinations prefer an upsert by key over an append (upsert order in `mcp-build-method.md`).

### Failure log with a tenant column

```javascript
await fastn.db.query(`
  CREATE TABLE IF NOT EXISTS sync_failures (
    id SERIAL PRIMARY KEY, customer_id TEXT NOT NULL, workflow TEXT,
    record_id TEXT, step TEXT, error TEXT, created_at TIMESTAMP DEFAULT NOW())`);
try {
  // ... work ...
} catch (err) {
  await fastn.db.query(
    `INSERT INTO sync_failures (customer_id, workflow, record_id, step, error) VALUES ($1,$2,$3,$4,$5)`,
    [customerId, 'orders-to-sheet', order.id, 'append_row', String(err.message)]);
  throw err;    // rethrow so the run shows Failed and the retry policy and alerts see it
}
```
For a per-record loop, catch, push `{sourceId, reason, errorMessage}` into `errorDetails` and continue instead (skip-on-error), returning `errors` so the test asserts it. Rows of all your customers share one schema: always include and filter on the customer column, and never interpolate `ctx.input` into SQL.

### Callback to your own app (surface status to the customer)

There is no documented endpoint to poll a Standard or Long execution id, so report outcomes from the workflow:

```javascript
const secret = await fastn.secrets.get('CALLBACK_SECRET');
await fetch(`${await fastn.envConfig.get('appBaseUrl')}/api/sync-events`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-callback-secret': secret },
  body: JSON.stringify({ customerId, orderId: order.id, workflow: 'orders-to-sheet', outcome: 'success' }),
});
```
(no `URL`, `Buffer` or timers in the sandbox; `fetch` returns `{ok, status, json()}`). See `assets/embed-starter/` for a receiver and a Sync health panel.

### Change detection with a hash (scheduled sync)

Hash the fields you care about (no `crypto`: write a small pure-JS hash or compare a canonical JSON string), store it in `fastn.state` per record id (namespaced), skip the target call when it matches but **still write state** with `status: 'skipped'`.

## Patterns (V2 docs `build/patterns`; the agent builds any of these from one sentence)

1. **Idempotent event sync**: trigger dedup key, then `fastn.state` guard, then Sequential mode if races are possible.
2. **Change detection with a hash** for scheduled pulls of thousands of records.
3. **Two-stage sync for large volumes**: Ingestion (Long) pulls into `fastn.db`, Publishing (Standard) pushes in batches, each retries independently.
4. **Per-customer business rules**: structured rules in a `fastn.db` table with a tenant column, sensitive ones in a customer-scoped secret, same-for-everyone-but-varies-by-environment in a config. In gateway builds the per-customer rules of an integration live in the **config** (`getByTemplate` clone), which supersedes hand-rolled rule tables for anything the customer edits.
5. **Fan-out from one webhook**: one trigger, several routes, each its own workflow.
6. **Backfill without disturbing the live sync**: separate Long workflow, manual or API trigger, shared guard in `fastn.db` (not `INVOCATION` state), one customer first. In gateway builds the schedule flow's first run (no cursor) is the backfill unless it will not fit `timeoutMs`.
7. **Workspace-level notifications**: an account-level connection you own (no "Per customer" badge); for failure notice an Alert with a Slack destination is simpler and catches a workflow that never ran.
8. **Let the platform retry** before writing a retry loop (and there is no sleep in the sandbox anyway).
9. **One code path across CRMs**: `fastn.unified` plus direct connector for vendor-specific parts.
10. **Reconciliation**: nightly compare of counts or checksums written to `fastn.db`, plus an alert on "Records failed above 0".
11. **Composition**: `fastn.flow.invoke` for a result you need, `invokeAsync` for independent work.
12. **Reference data caching**: `fastn.cache` with PROJECT scope and a TTL, not a hardcoded table.

## Things agents get wrong

- Emitting TypeScript, `import` statements, timers, `Buffer`, `URL`, or Node APIs.
- Forgetting `.output` on connector results, or nesting args under `input`.
- Reading `ctx.connectors`, `ctx.env` or `ctx.secrets`; nesting business config into `ctx.input`; inventing an event wrapper (`ctx.input.data`).
- Handing a code block to paste into an editor that has no code column.
- `fastn.state` `ORG` assumed per workflow; `fastn.db` assumed to scope by customer; SQL by string interpolation.
- Instant tier for a multi-system sequence; a loop over records on Instant; forgetting `timeoutMs`.
- Forgetting Publish (and Deploy for named environments); treating a test key as safe.
- Storing connector credentials in secrets (they live on connections; Fastn refreshes OAuth).
- Assuming an execution id can be polled; using `INVOCATION` state for cross-run dedup.
- Hardcoding mappings, filters, category lists or warehouse names instead of reading the config.
- Calling an LLM at runtime to do field mapping.
- `create_workflow` over an existing slug (silent overwrite) and skipping the regression suite after an edit.
