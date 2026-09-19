# Sources, freshness and known conflicts

Contents: where the docs live, how to query them live, trust ranking, conflicts between pages, the Verify list, docs map.

## Where the documentation lives

- Published site: `https://docs.fastn.ai/` (GitBook). Source repo: `github.com/fastn-ai/docs` (V2 sections `getting-started`, `tutorials`, `build`, `embed`, `operate`, `manage`, `reference`; V1 lives under `classic` and is in maintenance mode, also older `tutorials-1` and `flow-setup-essentials`).
- Machine-readable, no setup:

| Path | Contains |
| --- | --- |
| `/llms.txt` | Curated index of all pages |
| `/llms-full.txt` | The entire documentation as one markdown file (best for a bulk load) |
| `<any page URL>.md` | That page as raw markdown |
| `<page>.md?ask=<question>&goal=<end goal>` | GitBook answers a natural-language question with excerpts and sources |
| `/~gitbook/mcp` | The documentation as an MCP server |

Tooling note: some fetch tools only open URLs that already appeared in the conversation or search results. If a direct fetch of a docs page is refused, search for it first, or clone the repo (`git clone --depth 1 https://github.com/fastn-ai/docs`) and read the markdown locally.

Product surfaces that beat any document: a workflow's **Docs** tab (runtime call shapes and header formats), **Contract** tab (real input and output), **API** tab (ready curl with your host and workflow id), **Connectors** tab (which connectors and action versions are actually bound, per customer or workspace), and the connector detail page (action list and Select all). When a page and a generated tab disagree, the tab is right. The Embed tab's generated snippet beats the embed pages.

## Trust ranking

1. Generated product tabs and the live product itself (workflow Docs, Contract, API, Connectors tabs; the Embed tab snippet; tool schemas from `tools/list` and `get_action_schema`).
2. The **installed gateway skills** at their published version (`gateway`, `integration_builder`, `connector_builder`, `unified_api`, `workflow_verifier`): they are written against the running sandbox and gateway and versioned server-side. The GitHub mirror (`fastn-mcp-skills`) can lag: compare the `<!-- fastn skill: <slug> v<N> -->` tag with `skill {"slugs":[...]}`.
3. Non-hidden V2 docs pages, above all `reference/ai-agents.md`, `reference/api.md`, `reference/workflow-runtime.md`, `build/*`, `operate/*`, `manage/*`, `embed/*`.
4. Hidden V2 tutorials (`hidden: true`: How Embedding Works, Embedding Quickstart, Generating Embed Tokens, Authentication and API Keys, Finding Your Org Identifier, Understanding Tenancy, Deployment, MCP Gateway Integration, Creating a Workflow via AI, Building Your Widget, Managing Customers, Configuring a Connector, developer Troubleshooting, and others). Hands-on and full of practical gotchas, but earlier and inconsistent with the current pages.
5. Glossary and Core concepts details noted below; repo READMEs for older generations (`fastn-mcp`, `fastn-sdk`, classic UCL).

## Known conflicts and how to resolve

| Topic | Says A | Says B | Use |
| --- | --- | --- | --- |
| Embed token lifetime | 8 hours (28800 s), refresh cap 7 days (reference/api, embed/token-api) | 15 minutes (hidden tutorials, glossary) | Treat as 8 hours but always fetch fresh per page load; confirm on the Embed tab |
| Token response shape | `{token, endOrgId, role, expiresIn}` at top level | `{data: {token, ...}}` | Parse both |
| Token request | `x-org-id` header, or `endOrgId` in body for pinned keys | Body `{endOrgId, userEmail, userName}` | Send `endOrgId` (and header); include user fields for user-level embeds |
| API host | `https://app.fastn.dev` (API reference, workflow API tab) | `live.gcp.fastn.ai` (hidden tutorials, docs PR mentions the live host) | Copy the host from the workflow's API tab or the Embed tab |
| Unified API categories | Three (Core concepts) | Five (Unified APIs page, ai-agents): CRM, Documents, Knowledge Base, Messaging, Project Management | Five |
| Execution tiers | V2 docs: Instant 30s, Standard 15 min, Long 36 h | Glossary and the gateway sandbox skill: Instant about 60s, Long 6 h; wall-clock governed by `timeoutMs` (default 120 s, max 6 h) | Design for the tighter numbers; read the Configuration slider |
| MCP endpoint | `https://mcp.fastn.dev`, Bearer `fsk_live_` (current) | `mcp.live.fastn.ai/shttp` (repo README), `mcp.ucl.dev/mcp/?...api_key=` (hidden tutorial, V1 UCL) | The **Connect to Claude** dialog in the product |
| MCP native tools | Repo: `find_tools`, `execute_tool`, ... | Hidden tutorial: `fastn_list_integrations`, ... | Whatever `tools/list` returns from the endpoint you connect |
| SDK availability | SDK variants available (embed/embedding/sdk) | "SDK coming soon" (hidden tutorials, glossary-era) | Available; copy props from the generated snippet |
| `fastn.connector` vs `fastn.connectors` | Docs tab: singular | Connectors tab: extracts plural | Check the workspace; confirm the Connectors tab populates on save |
| Workflow editor Save | "Autosaves, no Save button" (ai-agents) | Save workflow button and unsaved-changes prompt (editor page) | Look at the editor |
| Code editing | On only for the parent organisation | Hidden tutorials and hackathon material assume code is visible | Check the workspace; ask Fastn to enable |
| `ctx` fields | `ctx.input`, `ctx.headers`, `ctx.connectors` (docs runtime page) | Sandbox skill: `ctx` has exactly `input` and `headers`; `ctx.connectors`, `ctx.log`, `ctx.env`, `ctx.secrets` do not exist (yet its envConfig example returns `ctx.env`) | Use only `input` and `headers`; use `fastn.envConfig`, `fastn.secrets` |
| Connector call result | Docs sketches use the return value directly | Sandbox skill: returns `{output, success, status, error, durationMs}`, always unwrap `.output` | Unwrap `.output` (BigCommerce may nest `.output.data`) |
| Environment selection over HTTP | `x-fastn-env` header | `?env=` query param | Copy the curl from the workflow's API tab |
| Gateway host | Plugin and docs: `https://mcp.fastn.dev` | Skills repo: `connect.fastn.dev` serves skill downloads | Use the plugin or Connect to Claude dialog; try the other if blocked |
| Unified category names | Docs: CRM, Documents, Knowledge Base, Messaging, Project Management | Unified skill examples: `crm`, `ecommerce`, `communication` | `list_unified_categories` in your workspace |
| Who builds workflows | Docs: the Platform Agent in the dashboard | Skills: Claude or another agent through the gateway (`create_workflow`, `bind_*`, `create_widget`) | Both exist; they upsert the same objects by slug, so use one per use case |
| `bind_app_event_trigger` name | `integration_builder` uses `bind_app_event_trigger` | `workflow_verifier` says `bind_app_trigger` (and notes tool names vary by gateway) | Use whatever `tools/list` shows |
| Home suggestion chips | Seeded per workspace, differ | Docs quote four | Do not rely on them |
| Agent entry | Docs PR notes live has no `/agent` route in some versions; entered from Home prompt | Build docs describe Integrations, Agent (`/agent`) | Either; both open the same screen |

## Three API generations (do not mix them)

Classic / UCL and the Python SDK (`project_id`, `tenant_id`, `x-fastn-api-key`, stages LIVE/STAGING/DEV), the older `fastn-mcp` server (`mcp.live.fastn.ai`), and V2 (organisation and customer, `fsk_` keys, `mcp.fastn.dev`, skills). Table in `ecosystem-and-repos.md`.

## The Verify list (docs explicitly mark these unsettled)

- `fastn.connector` spelling and whether saving extracts calls.
- Exact `fastn.db.query(sql, params)` signature and `$1` placeholders.
- Whether `fastn.state` `ORG` scope is org-wide or per workflow (namespace keys either way).
- Exact multi-tenant header value formats (see the Docs tab).
- Consecutive-failure threshold that auto-disables schedule triggers, and the cooldown length.
- Whether Developer role holds `deploy prod`; how overlapping secret scopes resolve.
- How to register your own OAuth app so customers do not see "fastn.ai" on the consent screen.
- Which Billing sections (Customer tiers, Usage by customer, Payment) behave how; populated Sync report and Trace row shapes were never captured by the doc authors.

## Docs map (paths under docs.fastn.ai, append `.md` for raw markdown)

- **Getting started**: `/fastn/readme`, `/fastn/readme/getting-started`, `.../platform-tour`, `.../quickstart`, `.../concepts`
- **Tutorials**: `/tutorials/saas-admin/*` (setting-up-your-organization, configuring-a-connector, creating-a-workflow-via-ai, configuring-a-workflow-in-code, setting-up-triggers, building-your-widget, managing-customers, roles-and-permissions-setup), `/tutorials/developer/*` (how-embedding-works, embedding-quickstart, generating-embed-tokens, authentication-and-api-keys, finding-your-org-identifier, understanding-tenancy, deployment, mcp-gateway-integration, troubleshooting), `/tutorials/end-user/*`
- **Build**: `/build/agent` (+ approval-mode, worked-example), `/build/connectors/*`, `/build/unified-apis/*`, `/build/connections/*`, `/build/workflows/*` (the-editor, the-tabs, lifecycle), `/build/triggers/*` (webhooks, schedulers, app-events), `/build/connector-updates`, `/build/mcp-gateway`, `/build/patterns`
- **Embed**: `/embed/embed`, `/embed/widget-builder/*` (layout, style, features), `/embed/embedding/*` (iframe, sdk, token-api)
- **Operate**: `/operate/*` (events, traces, alerts, executions, sync-reports, customers, troubleshooting)
- **Manage**: `/manage/*` (people, roles, general, api-keys, secrets, configs, environments, database, saas-connectors, billing, audit-log, trash, profile)
- **Reference**: `/reference/workflow-runtime`, `/reference/api`, `/reference/errors`, `/reference/ai-agents`, `/reference/faqs`, `/reference/glossary`
- **Classic (V1)**: `/classic/*` including Fastn UCL (Unified Context Layer), scheduling flows, deployment releases and pipelines.
- Repos: `fastn-ai/fastn-mcp` (MCP server, MIT), `fastn-ai/fastn-sdk`, example `fastnai/embedded-multitenant-ai-assistant` (classic UCL sample).
