# Test cases, verification and the report

Contents: the test-case gate, sizing, kill matrix, the verification matrix, data parity, intent conformance, regression protocol, trigger checks, the report template.

From the `integration_builder` GATE (`test-cases.md`) and the `workflow_verifier` skill (v2, with `verify-matrix.md`). Non-negotiable idea: **code that looks right is not evidence, a 2xx is not evidence.** The oracle is the returned value, the target system's state, and the execution record. This is also the strongest material you can hand judges (implementation, submission and Platform Agent lines all score it).

## The test-case gate

Every workflow, data-movement or single-system, goes through `submit_test_cases`, which returns a `reviewUrl` where the user reviews, edits and approves in the browser before BUILD. The agent never authors cases and self-validates, and builds from the approved set the tool returns. Writing real records against a live system needs the user's eyes more, not less.

Payload: `scope` and `testCases[]` of `{id (TC-01...), group, scenario, pass, mode: live|mock, input, headers, mockScenarios}` plus optional `groups[]`. The `input`, `headers` and `mockScenarios` fields are the executable fixture that makes a case replayable through `test_workflow`. The agent assigns each case's mode: mock for logic breadth, `live` only to prove the real-write boundary (every entity pair and direction needs at least one live happy path). Cases are attached to flows via `create_workflow`'s `testCases` and become the flow's permanent regression suite.

**A `pass` must be an outcome, never "it ran".** Sync workflows return `{created, updated, skipped, errors, errorDetails}`; a happy path requires `errors === 0` **and** the expected outcome (`created >= 1` or `updated >= 1`), and for a live write, a read-back of the target confirming the mapped fields. `errors > 0`, or zero created and updated on a happy path, is a FAIL even at HTTP 200.

Always-present classes: **data parity** (live case whose pass is the parity audit below), **config liveness** (edit a marker value in the config, re-run, the run reflects it: catches the "I changed the config but the sync ignores it" bug), **trigger fire** (a bound trigger fired for real produces a completed execution).

## Sizing: derive from surface area, never a round number

Per entity pair and direction: create and update as separate cases; one case per required mapping field; each transform branch (combine, conditional both branches, fallback present and absent, split, value-mapped and unmapped pass-through, fixed value); each condition with a PASS and a SKIP case asserting the reason; custom properties; match logic (found by id, found by natural key, not found, stale-mapping self-heal on 404 or 410); cursor first run and delta run (and a manual run must not advance the cursor); idempotency (unchanged re-run is `skipped` with no target write); pagination (multi-page and empty page); edge and failure (missing required field, empty optionals, malformed record, duplicate match, deletion, rate limit through `mockScenarios`, target not-found); two-way adds conflict and loop-guard cases. Bands: small (one entity, one way) about 15-25, medium about 40-70, large about 90-130. A single-system automation is about 10-20 but the gate is mandatory. Single-system cases come from the workflow's own logic: trigger fires and does-not-fire, every business-rule branch including threshold boundaries, at least one **live case per write action with target read-back**, idempotency (the same trigger twice must not double-apply), edge and failure, and every business-rule ambiguity as an explicit reviewable case (encode the interpretation, for example "refund one item's price, item stays fulfilled", so the user can correct it before it writes).

## Case power: the kill matrix

Trace every case to a requirement (a mapping id, a condition, the user's own phrase), and for each defect class that applies name the case that would fail if the defect existed. No killer means underpowered.

| Defect class | Killing case |
| --- | --- |
| Wrong or swapped field mapping | Field-exact read-back of the value per required field ("amount = 240.00"), not "a record exists" |
| Write linkage silently dropped (200 but the relation never created) | A case asserting the relation on read-back |
| Unmapped enum or value passthrough | A source value outside the mapped set with the expected translation or explained skip |
| Filter inverted or too broad | PASS and SKIP pair per condition asserting counts and the skip reason |
| Pagination stops at page 1 | A source spanning more than one page, asserting the total |
| Update path re-creates | Idempotency and update pair: re-run gives `skipped`, an edit gives `updated: 1`, and a target search by key returns exactly one record |
| Missing `await` ("[object Promise]") | Any case asserting field values |
| Wrapper shape (handler reads `.data`/`.payload` that production events do not have) | The trigger-fire case with a payloadSchema-shaped event |
| Stale config read | The config-liveness case |

## The regression gate

Any `update_workflow`, `edit_workflow_code`, config repoint or connector-action change re-runs the **full** attached suite for every affected flow (mock always, plus the affected live anchor), asserts each `pass` on the returned value, then `save_validation` records it. Then read the workflow back with `get_workflow` and confirm the intended change is in the saved code (description-only edits have shipped while the bug lived on). "Edited and published" is never "done". A human-reported bug becomes a **failing case first** (reproduce, fix, re-run the full suite, keep the case forever).

## Verification matrix (PHASE 4, mandatory after every build and every update)

| Surface | Proven by |
| --- | --- |
| Workflow logic | Every case run in its mode, each `pass` asserted on the returned value; live writes read back from the target |
| Data parity | Counts reconcile and a field-by-field sample audit (below) |
| Intent conformance | Independent re-read of the built code, diffed against the request, the approved config and the approved cases: no missing intent, no unrequested behavior, no silent reinterpretation. Green is not intended |
| Real execution | One `execute_workflow`: execution row completed, sane output, clean logs and trace |
| Schedule trigger | Read back enabled with the approved cadence and timezone; `trigger_scheduler_now` returns an `eventId`; find the execution carrying it (`list_executions`, header `x-fastn-event-id`); processed counter up, DLQ empty. Run-now is a real run and advances cursors |
| App-event trigger | `subscriptionStatus` ACTIVE (retry the subscription once on FAILED/NONE, `manualRegistrationRequired` becomes a blocker with the exact `webhookUrl`); a synthetic event shaped exactly like `payloadSchema` (`send_test_app_event`; only accepted when no webhook secret is configured); correlated execution and the right code branch; bijection of events and handler branches |
| Webhook trigger | Read back `triggerUrl`; sample POST (and an auth-rejected negative) produces a correlated execution |
| Widget | `get_widget` readback: all workflows, triggers, connectors attached, type right, config template linked (via `list_configs`), exactly one widget for the use case, publish fan-out count as expected, per-tenant trigger instances exist |
| Config liveness | Marker edit, re-run, reflected (multi-tenant: the resolved config is the tenant's clone) |
| Multi-tenant | Self-install passes under `installationId`, no-context call errors by design, cleanup verified |
| Connections and env | Every manifest connection ACTIVE now; every env-config key resolves |

A fire that produced no execution is diagnosed at the trigger's monitoring or DLQ, never shrugged off. On a failure: diagnose from the execution detail (`error`, `errorCategory`, `fixSuggestion`, logs, trace; list rows do not carry them), fix (code, config repoint, `retry_trigger_subscription`, DLQ replay), re-run the full suite, at most **3 attempts**, name every applied fix, then report what remains.

### Data parity procedure

1. **Count reconciliation**: eligible source records = created + updated + explained skips, zero unexplained residue, and the target holds the created and updated records.
2. **Field-by-field sample audit**: for a sample, source record, then the approved mapping, then the expected payload, compared with the record read back from the target, field-exact (dates, enums, lengths, encodings).
3. **Identity, duplicates, idempotency**: no duplicates; an unchanged re-run is all `skipped` with no writes.
4. **Update parity**: edit one field at the source, the next run gives `updated: 1` and only that field changed.

Persist per-case results with `save_validation {status: pass|partial|fail, mode, results:[{id, status, evidence, error?, fix?}]}`. Record failures too: a stale green panel is worse than a red one.

## Verification report (Markdown, for a human, lead with the verdict)

```markdown
# Verification Report: <use case>

**Verdict: PASS | PASS WITH BLOCKERS | FAIL**: <one plain sentence on what this means for the user>
**Environment:** <test | live> · **Verified:** <date/time> · **Workflows:** N · **Triggers:** N

## What's running
| Surface | Status | Evidence |
|---|---|---|
| Workflow `<slug>` | PASS | exec `<id>` completed in <s>: created C / updated U / skipped S / errors 0 |
| Trigger <type> "<name>" | PASS | fired (event `<id>`) -> exec `<id>` completed; processed +1, DLQ 0 |
| Widget "<name>" | PASS | readback: N workflows, M triggers, config `<cfg_id>` linked |
| Config `<cfg_id>` | PASS | liveness: marker edit reflected in exec `<id>` |

## Data parity: <source> -> <target>   (omit only for flows that move no data)
- Counts reconcile: eligible E = created C + updated U + skipped S (all approved reasons) + 0 unexplained
- Duplicates: none · Idempotent re-run: all skipped, no writes
- Sample audit: N/N records field-exact (K mapped fields each)
- Update parity: 1 field edited -> `updated: 1`, only that field changed
(Mismatch table only when found: Record | Field | Expected | Actual in target)

## Failures
| Surface | Error | Category | Fix applied / proposed |

## Blockers: needs you
- [ ] <action with the exact artifact: webhook URL to register, connector to connect, review link to approve>

## Coverage
Test cases N/M passed (live L, mock K) · Triggers T/T verified · Widget OK · Config OK · Parity OK · Intent OK

## Cleanup
<test records created and removed; orphans: what, where, id, why not removable, or "All test data removed.">

## Next steps
<what happens on its own, and anything the user should do, or "Nothing needed.">
```

Rules: the verdict is first and unhedged; every PASS carries evidence in the same row (execution id, eventId, counts, record keys, never a bare "OK"); a surface that could not be verified goes under Failures or Blockers with the reason, never silently omitted; sections with nothing to report say "None". The hand-off (how to test, how to reach the widget) comes after the report, not instead of it.
