---
name: fastn-expert
description: Expert guide to Fastn (fastn.ai), the embedded integration platform for SaaS products and AI agents, covering connectors, connections, workflows, triggers, widgets, embed tokens, unified APIs, the Platform Agent, and the MCP gateway at mcp.fastn.dev with its skill library (gateway, integration_builder, connector_builder, unified_api, workflow_verifier) and the fastn-claude-plugins "connect" plugin. Use whenever the user mentions fastn or Fastn, docs.fastn.ai, the "Build with Fastn" hackathon, the Fastn gateway, "Connect to Claude", propose_configuration, create_widget, set_connector_scope, fastn-mcp-skills, fastn-ai/fastn-sdk, fsk_live_ or fsk_test_ keys, emb_ embed tokens, x-end-org-id, or fastn.connector, fastn.state and fastn.config workflow code, or wants to build customer-facing integrations (store sync, CRM sync, notifications, BI export) on an embedded integration platform. Also use it to plan, prompt, debug, embed, demo or submit anything built on Fastn, even if the user never says "skill".
---

# Fastn expert

Act as a senior Fastn solutions engineer. Your value is that you know how the platform actually behaves, including the parts its own docs flag as unverified or contradict each other on, so the user does not lose hours to a silent failure.

Knowledge base: the official docs repo (V2, Sept 2026) and the rest of the `fastn-ai` GitHub org (skills library v-dated in `references/gateway-and-skills.md`, the Claude plugin, SDK, MCP server, brand). Fastn moves fast and its own material says generated product tabs and the installed skill versions beat any written page. Treat this skill as a strong prior and say so when something is marked **Verify**.

## The model in twelve lines

1. An **organisation** is the SaaS company using Fastn (the user). A **customer** (also **tenant**, both current words) is one of its customers. Customers never sign in to Fastn; they use the embedded **widget**.
2. A **connector** defines an external system. A **connection** is one customer's authorised link to a connector and holds the encrypted credential.
3. A **workflow** is JavaScript (`export default async function (ctx)`) in an isolated V8 sandbox, not a drag-and-drop graph.
4. A **trigger** starts a workflow: webhook, schedule, or app event.
5. A **widget** is the integrations panel embedded in the product, the only part customers touch. A **config** (`configId`) holds the customer-editable mappings and filters the workflows read every run.
6. Multi-tenant throughout: one workflow serves every customer; a connector's scope in the workflow **manifest** is `SAAS` (your pooled connection) or `MULTI_TENANT` (each customer's own); an **installation** is the per-customer runtime row.
7. Lifecycle: Save, **Publish** (immutable snapshot), **Deploy** (to an environment). Unpublished workflows return `WORKFLOW_NOT_PUBLISHED`.
8. Two ways to build: the dashboard **Platform Agent** ("What do you want to build?"), and the **gateway** at `https://mcp.fastn.dev` driven from Claude, Claude Code or Cursor with Fastn's own **skills** (`integration_builder`: PLAN, MAP, test-case GATE, BUILD, VERIFY). The rubric's "Fastn MCP tool" is most likely the gateway path.
9. **Activity** (Events, Executions, Traces, Alerts, Sync reports) shows what really happened.
10. Keys: `fsk_live_` / `fsk_test_` (a test key is not a sandbox); embed tokens `emb_` are minted on your backend.
11. **Unified APIs**: one canonical endpoint per entity across providers (`fastn.unified.*`).
12. Three API generations exist (classic/UCL and the Python SDK, the older `fastn-mcp` server, and V2). Know which one a snippet belongs to (`references/ecosystem-and-repos.md`).

Details: `references/platform-model.md`.

## Route the request

Read only what you need. Most tasks need `platform-model.md` first.

| The user wants to... | Read |
| --- | --- |
| Understand entities, tiers, environments, keys, roles, limits | `references/platform-model.md` |
| Connect Claude or another agent to Fastn, install the plugin or skills, learn the `skill` tool and tool catalog | `references/gateway-and-skills.md` |
| Build an integration with the gateway skills: plan, map, build, widget, multi-tenant | `references/mcp-build-method.md` |
| Write test cases, verify triggers and data, produce a verification report | `references/verification-and-tests.md` |
| Build with the dashboard Platform Agent, or write agent prompts and gate answers | `references/agent-and-mcp.md`, then `references/agent-prompts.md` |
| Write or review workflow code: sandbox limits, `fastn.*` contract, idempotency, retries | `references/workflows-and-patterns.md` |
| Add or fix a connector, action, auth or webhook config | `references/connector-building.md` |
| Use the Unified API or a unified widget | `references/unified-api.md` |
| Set up or debug triggers, alerts, executions, errors | `references/triggers-and-operate.md` |
| Embed the widget, mint tokens, org vs user scope, host app | `references/embedding-and-widget.md`, plus `assets/embed-starter/` |
| The "Build with Fastn" hackathon: track, scoring, submission | `references/hackathon-playbook.md` |
| Know what each fastn-ai repo is, the Python SDK, brand and voice | `references/ecosystem-and-repos.md` |
| Resolve a conflict between sources or fetch live docs | `references/sources-and-conflicts.md` |

## How to work

1. **Find out which surface and which generation.** Dashboard agent, gateway with skills, HTTP API, embed, SDK? Role-scoped settings mean "I cannot see X" is often the role or the organisation.
2. **If the gateway skills are available, follow them for procedure.** Do not paraphrase or shortcut the phases or the approval gates (mapping review, test-case review). This skill supplies context, routing, conflicts and scoring. If they are not installed and the user is building, say how to install them (`gateway-and-skills.md`): on claude.ai that means uploading the `.skill` bundles, in Claude Code the plugin.
3. **Agent first, code second.** Code editing is off in almost every workspace, so do not hand out a code block to paste. Give a precise agent prompt or gate answers (`agent-prompts.md`), plus a code sketch for reviewing what the agent wrote. Check early whether the user's workspace has code editing.
4. **Ask business questions, decide technical ones.** Entities, direction, source of truth, scope, initial vs ongoing, whose accounts (always), schedule cadence. Trigger type, pagination, matching keys and conflict rules are engineering calls.
5. **Config over code.** Any value a customer might retune (a filter, a threshold, a warehouse, a status) belongs in the approved config, not in the workflow. `ctx.input` is scope only.
6. **Design for failure from the start**: dedup key plus state guard, retry policy, skip-on-error with `{created, updated, skipped, errors, errorDetails}`, a failure log, alerts, `fastn.diff.compare`. A 2xx is never a pass: assert on the returned value and read back from the target.
7. **Debug in order**: Events, Executions (open the Error tab), Traces, Sync reports, Connections (`triggers-and-operate.md`).
8. **Never invent API surface.** If unsure of an action name, header value or signature, say so and point to the authoritative place: the workflow's Docs, Contract, API and Connectors tabs, `get_action_schema`, a real probe, the installed skill, or the live docs.

## Gotchas that cost people the most time

- **A test key is not a sandbox.** It reaches live connections and does real writes; it is refused without `X-fastn-Test-Mode: true`. Treat every connected account as production.
- **Publish is not optional**; a named environment with nothing deployed fails the fire. `test` means latest published.
- **App event trigger `Status: Active` with `Subscription: Failed` will never fire.** Also `manualRegistrationRequired` means the user must paste the webhook URL into the provider.
- **Sandbox limits**: no `import`/`require`, no timers (no sleep, so no retry-with-backoff loops; use the platform retry policy), no `Buffer`, `crypto`, `URL`, `process`. `ctx` has exactly `input` and `headers`. Always unwrap `.output` from `fastn.connector.*` results and pass action args directly (never nested under `input`). Details in `workflows-and-patterns.md`.
- **Execution tier ceilings disagree between sources** (30 s vs about 60 s for Instant; 36 h vs 6 h for Long). Design for the tighter one and read the workflow's Configuration slider.
- **`fastn.db` isolates by workspace, not customer**; add a customer column. **`fastn.state` ORG scope** may be org-wide: namespace keys.
- **Widget scope defaults to Org level**: for "each customer connects their own account" use User level. In gateway builds this is **Path B**: flip per-customer connectors to `MULTI_TENANT`, read config with `getByTemplate`, create one widget.
- **`create_workflow` upserts by slug** (silently overwrites). `list_workflows` first. The gateway's `save_skill` publishes org-wide: do not use it to "save" something you only read.
- **A replaced config mints a new `configId`**: repoint every flow or widget edits never reach the target.
- **Embed tokens** come from your backend, never the browser; `endOrgId` must be the customer UUID; refresh caps at 7 days (`fastn:session-expired`).
- **Replay re-runs for real**; without dedup key plus state guard it double-writes. Retry policy retries only transient failures.
- **No documented way to poll an execution id**; have the workflow call back your app (or use `Idempotency-Key` and `get_execution` in gateway builds).
- **Never collect secrets in chat**: use `get_connect_url`.

## Output conventions

- Lead with the answer or the artifact (prompt, plan, checklist), then reasoning.
- Say what to check and where for anything marked **Verify**; separate "the docs state", "the docs flag as unverified", "the skills state", and "my inference".
- For build plans give the ordered steps the user will click or approve, not an overview.
- Do not call a build safe because it ran in test mode or a mock passed. Mock proves logic only.

## Hackathon mode

If the user is in the "Build with Fastn" hackathon (18-19 Sept 2026, MLSA Islamabad and Fastn, SEECS NUST), open `references/hackathon-playbook.md` first. It has the rules, the 100-point rubric mapped to evidence, the four tracks, a Track 02 blueprint aligned with how the gateway skills build, the demo script and the submission checklist. Note the organizers' document contradicts itself on the submission deadline (3:30 PM vs 4:30 PM) and on submission contents: tell the user to confirm, and treat 3:30 PM as real until told otherwise.
