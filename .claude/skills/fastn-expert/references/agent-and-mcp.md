# The Platform Agent and the MCP gateway

Contents: the dashboard Platform Agent, approval mode, credits, what to do when code editing is off, which MCP endpoint is which, what Claude can do through the gateway, and how to capture evidence for scoring.

Two builders exist: the **dashboard Platform Agent** (below) and **Claude (or another agent) driving the gateway with Fastn's skills** (`gateway-and-skills.md`, `mcp-build-method.md`). They produce the same kind of artifacts (connectors, workflows, triggers, widgets). The dashboard agent is friendlier for a first build; the gateway path exposes every step (probing, approvals, verification) and is what the hackathon rubric most likely rewards. Do not run both against the same use case at once: `create_workflow` upserts by slug.

## The Platform Agent (chat-driven builder)

Entry points: the **What do you want to build?** prompt on Home, or Integrations, then **Agent** (`/agent`). Both open the same screen headed "Build an integration". Its contract: describe what you need in plain words, the agents pick connectors, draft the workflow, and show the diff before anything runs.

What one session does, in order:
1. Works out the systems involved, reuses existing connectors, creates missing ones.
2. Handles auth inside the chat (inline API-key fields, or an OAuth form asking for client ID, secret and prefilled scopes with a link to the provider portal). Fastn-managed OAuth apps exist for some platforms so you may not need your own.
3. Asks **clarifying questions** as selectable cards (typical: sync scope "ongoing only" vs "initial import + ongoing", and tenancy "internal" vs "for customers (multi-tenant)"). Every question has **Other...** for free text. These answers change generated code materially.
4. Writes an **Integration Plan**: a markdown document in a side panel (for example `plan-hubspot-to-sheets.md`) with trigger, actions, connectors, a field-mapping table with a worked example per row, and a tenancy section. It has a download button. Read it: correcting a wrong assumption here costs one sentence.
5. Tracks **BUILD PROGRESS** (for example 0/6 to 6/6) across four phases: 1 Use cases (plan and confirm), 2 Connectors (create and authorise), 3 Workflows (approve mappings and test cases, build and test, **bind the trigger**), 4 Embed (expose as a widget). Builds with no customer-facing surface have no Embed phase.
6. Posts **Proposed Field Mappings** for approval (the moment to say "put first and last name in separate columns"), generates test cases on the editor's Test cases tab grouped `happy-path`, `pagination`, `fields`, `edge-cases`, `error-handling`, each badged LIVE or MOCK, and opens the workflow.
7. What you get is an ordinary workflow: test it, publish a snapshot, deploy.

Reading it back: tool calls collapse into "Worked - N steps" with Show details. Documents appear as artifact chips that reopen panels. The **context meter** (for example 19k / 1000k) shows session context used. **AI credits** in the top bar are drawn down by agent runs; the popover breaks usage down by agent (Orchestrator V2 Orchestrator, Docs Agent, Error Diagnosis, Orchestrator V2 Title). Each session keeps its full history in the left **Sessions** rail (search with Cmd+K), so you can return weeks later.

**Attach a file** takes an API spec, a sample payload or a mapping spreadsheet. A real payload is the fastest route to accurate mappings.

Iterating: follow-ups refine what exists ("Add error handling for when the API is down", "Filter out records without an email", "Change the schedule to hourly", "Notify Slack on failure"). The agent updates code, mappings and tests together so they do not drift.

### Approval mode

The chip under the composer. **Auto** (default) does not ask. **Manual** posts an approval card before any create, update or delete, showing the tool name and exact JSON payload, with **Accept** (this call only), **Always allow** (this tool for the rest of the session), **Reject** (with a note to the agent). A bare Reject usually produces the same call again, so always type a note ("use the sandbox sheet, not the production one"). Recommended: Manual for the first few steps so you learn which tools it uses, then Auto. Keep Manual on when touching production data.

### Role and code editing

Using the AI assistant is gated by role. **Code editing is off in almost every workspace** (enabled for the parent organisation). Without it the editor has no code column and workflows are generated and updated only by the agent; you still test, wire connectors, edit the contract, publish and deploy. To write code yourself, ask Fastn to enable it. Consequence for advice: give agent prompts, not paste-in code.

Prompt-writing formula and ready templates are in `agent-prompts.md`.

## MCP and the gateway: which thing is which

Do not conflate these. Check which one the user means. Full detail on the gateway, the `skill` tool, plugin install and the tool catalog is in `gateway-and-skills.md`; the build procedure is in `mcp-build-method.md`.

| | Product gateway (current, V2) | Docs MCP | Older servers |
| --- | --- | --- | --- |
| URL | `https://mcp.fastn.dev` | `<docs-site>/~gitbook/mcp` | `https://mcp.live.fastn.ai/shttp` (repo `fastn-mcp`), `mcp.ucl.dev` (classic UCL) |
| Exposes | Your connected apps as `app__action` tools **and** Fastn's build tools and skill library (Workflow MCP, Connector MCP; 200+ tools) | This documentation as searchable tools | Older tool sets (`find_tools`/`execute_tool`, or `fastn_*` tools) |
| Auth | OAuth via the plugin or client, or `Authorization: Bearer fsk_live_<key>` (a test key also works with `X-fastn-Test-Mode: true`) | Public | OAuth 2.1 or Bearer plus project id; api key in URL for mcp.ucl (avoid) |
| Use for | Building and running integrations from Claude; acting on real customer systems | Answering questions about Fastn | Reference only |

The dashboard's **Connect to Claude** (top bar, and under the Home prompt) offers the URL, a deep link that opens Claude's custom-connector modal prefilled, a Claude Code command (`claude mcp add --transport http fastn https://mcp.fastn.dev`, which carries no key: expect an OAuth step or add the header your version supports), a Claude Desktop `mcp-remote` config, and an org-wide add link. In Claude Code, `/mcp` shows whether it connected. The **fastn-claude-plugins** `connect` plugin does the registration and loads the usage rules for you.

Scoping and governance are inherited from the platform: customer scope (the key's "Customers it can reach"), permissions (key preset plus matrix), and action scope (a connector's **Select all** narrows which actions are exposed, so "read-only Jira for one customer" is configuration, not a promise). Activity: runs appear in Executions with the calling identity in **Triggered by**; key-attributed calls appear in the audit log (owners and admins); credits by agent in the top-bar popover. Mint a dedicated key per client, narrowest preset, named after the client. **A2A** (the customer's own agent reaching your integrations) is listed on the widget Embed tab as "soon".

### What Claude can do through the gateway

1. **Build**: with the `integration_builder` skill Claude plans, maps, gets your approval in the browser, creates workflows, binds triggers, creates the widget and verifies. This is the highest-leverage use and the likely target of the "Fastn MCP tool" rubric line.
2. **Test and inspect**: probe real connector payloads, run bounded live or mock tests, read executions and logs, replay a fix.
3. **In-product assistant**: a chat in the customer's app answering "where is my order?" from live data through scoped tool calls, escalating when unsure (customer-facing replies must come from verified data).
4. **Support and ops**: look up a customer's integration status, recent events and failures; a monitoring agent that checks health on a schedule.

Caveats: an MCP client acts with exactly what its key allows; test keys still write to live systems; anything writing to production should sit behind Manual approval or a narrow read-only key.

### Legacy `fastn-mcp` repo and UCL (verify before use)

The repo README (hosted `https://mcp.live.fastn.ai/shttp`, OAuth 2.1, self-hostable) lists `find_tools`, `execute_tool`, `list_connectors`, `list_skills`, `list_projects`, `list_flows`, `run_flow`, `delete_flow`, `configure_custom_auth`, with `create_flow` and `update_flow` marked under development. A hidden tutorial describes `fastn_list_integrations` and friends at `mcp.ucl.dev` with an api key in the URL. Both predate the gateway. Classic UCL is in maintenance mode.

## Evidence for scoring (hackathon or otherwise)

Judges score submissions, so process must be visible. Screenshot or export: the agent session or transcript, the approval and review gates (mapping `reviewUrl`, test-case `reviewUrl`), the plan, BUILD PROGRESS (dashboard agent), field-mapping approval, Test cases, a failed run debugged through the Error tab's AI Diagnosis or `get_execution`, the widget Save and publish and `get_widget` readback, alerts configured, and above all the **verification report** (`verification-and-tests.md`). Say in the document exactly which parts the agent produced and what you corrected by hand.
